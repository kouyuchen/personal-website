"use strict";

const crypto = require("crypto");

const BOARD_SIZE = 15;
const WIN_LENGTH = 5;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
const DEFAULT_COLORS = { host: 1, guest: 2 };
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function isValidRequestId(value) {
  return typeof value === "string" && REQUEST_ID_RE.test(value);
}

function normalizeColors(colors) {
  if (
    colors &&
    (colors.host === 1 || colors.host === 2) &&
    (colors.guest === 1 || colors.guest === 2) &&
    colors.host !== colors.guest
  ) {
    return { host: colors.host, guest: colors.guest };
  }
  return { host: DEFAULT_COLORS.host, guest: DEFAULT_COLORS.guest };
}

function isValidCoord(row, col) {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < BOARD_SIZE &&
    col >= 0 &&
    col < BOARD_SIZE
  );
}

function normalizeMoveRecord(move) {
  if (!move || typeof move !== "object") return null;
  const row = Number(move.row);
  const col = Number(move.col);
  const color = Number(move.color);
  if (!isValidCoord(row, col)) return null;
  if (color !== 1 && color !== 2) return null;
  return { row, col, color };
}

function normalizeHistory(raw, moveCount, lastMove, board) {
  let history = [];
  if (Array.isArray(raw)) {
    history = raw.map(normalizeMoveRecord).filter(Boolean);
  }

  // 旧版本没有 history：用 lastMove 播种最近一手。
  // 这样旧中盘局再落一子后，最近两步就都已知，可以悔棋。
  if (history.length === 0 && moveCount > 0) {
    const last = normalizeMoveRecord(lastMove);
    if (last && board[last.row * BOARD_SIZE + last.col] === last.color) {
      history = [last];
    }
  }
  return history;
}

function normalizeUndoRequest(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = isValidRequestId(raw.id) ? raw.id : "";
  const by = raw.by === "host" || raw.by === "guest" ? raw.by : "";
  const byColor = raw.byColor === 1 || raw.byColor === 2 ? raw.byColor : 0;
  const round = Number(raw.round);
  const moveCount = Number(raw.moveCount);
  const baseVersion = Number(raw.baseVersion);
  const status = raw.status === "active" || raw.status === "finished" ? raw.status : "";
  const boardHash = typeof raw.boardHash === "string" ? raw.boardHash : "";

  if (
    !id ||
    !by ||
    !byColor ||
    !Number.isInteger(round) ||
    round < 1 ||
    !Number.isInteger(moveCount) ||
    moveCount < 2 ||
    !Number.isInteger(baseVersion) ||
    baseVersion < 0 ||
    !status ||
    !boardHash
  ) {
    return null;
  }

  return { id, by, byColor, round, moveCount, boardHash, status, baseVersion };
}

function normalizeState(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  const board =
    Array.isArray(base.board) && base.board.length === CELL_COUNT
      ? base.board.slice()
      : new Array(CELL_COUNT).fill(0);
  const moveCount =
    Number.isInteger(base.moveCount) && base.moveCount >= 0 ? base.moveCount : 0;
  const lastMove =
    base.lastMove && typeof base.lastMove === "object" ? base.lastMove : null;
  const history = normalizeHistory(base.history, moveCount, lastMove, board);

  return Object.assign({}, base, {
    board,
    history,
    turn: base.turn === 2 ? 2 : 1,
    moveCount,
    result:
      base.result === "black" || base.result === "white" || base.result === "draw"
        ? base.result
        : null,
    winningLine: Array.isArray(base.winningLine) ? base.winningLine.slice() : null,
    lastMove,
    round: Number.isInteger(base.round) && base.round > 0 ? base.round : 1,
    colors: normalizeColors(base.colors),
    rematch: {
      host: !!(base.rematch && base.rematch.host),
      guest: !!(base.rematch && base.rematch.guest),
    },
    undoRequest: normalizeUndoRequest(base.undoRequest),
  });
}

function createState(round, colors) {
  return {
    board: new Array(CELL_COUNT).fill(0),
    history: [],
    turn: 1,
    moveCount: 0,
    result: null,
    winningLine: null,
    lastMove: null,
    round: round || 1,
    colors: normalizeColors(colors),
    rematch: { host: false, guest: false },
    undoRequest: null,
  };
}

function colorForSeat(state, seat) {
  if (seat !== "host" && seat !== "guest") return 0;
  return normalizeColors(state && state.colors)[seat];
}

function swapColors(colors) {
  const normalized = normalizeColors(colors);
  return { host: normalized.guest, guest: normalized.host };
}

function stateFingerprint(state) {
  const payload = {
    board: state.board,
    history: state.history,
    turn: state.turn,
    moveCount: state.moveCount,
    round: state.round,
    result: state.result,
    winningLine: state.winningLine,
  };
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function canRequestUndo(state, seat) {
  if (seat !== "host" && seat !== "guest") return false;
  if (!state || state.undoRequest) return false;
  const color = colorForSeat(state, seat);
  if (!color || state.turn !== color) return false;
  if (!Number.isInteger(state.moveCount) || state.moveCount < 2) return false;
  if (!Array.isArray(state.history) || state.history.length < 2) return false;

  const last = state.history[state.history.length - 1];
  const prev = state.history[state.history.length - 2];
  if (!last || !prev) return false;
  if (last.color === prev.color) return false;
  if (prev.color !== state.turn) return false;
  if (!isValidCoord(prev.row, prev.col) || !isValidCoord(last.row, last.col)) return false;
  if (state.board[prev.row * BOARD_SIZE + prev.col] !== prev.color) return false;
  if (state.board[last.row * BOARD_SIZE + last.col] !== last.color) return false;
  return true;
}

function createUndoRequest(state, seat, id, baseVersion, status) {
  if (!isValidRequestId(id)) return { error: "INVALID_REQUEST" };
  if (status !== "active" && status !== "finished") return { error: "GAME_NOT_OVER" };
  if (!canRequestUndo(state, seat)) return { error: "UNDO_UNAVAILABLE" };

  return {
    request: {
      id,
      by: seat,
      byColor: colorForSeat(state, seat),
      round: state.round,
      moveCount: state.moveCount,
      boardHash: stateFingerprint(state),
      status,
      baseVersion,
    },
  };
}

function applyUndo(state, request) {
  const normalized = normalizeState(state);
  const current = normalized.undoRequest;
  if (!current || !request || current.id !== request.id) {
    return { error: "UNDO_NOT_FOUND" };
  }
  if (
    normalized.round !== request.round ||
    normalized.moveCount !== request.moveCount ||
    normalized.turn !== request.byColor ||
    stateFingerprint(normalized) !== request.boardHash
  ) {
    return { error: "UNDO_STALE" };
  }
  if (!Array.isArray(normalized.history) || normalized.history.length < 2) {
    return { error: "UNDO_UNAVAILABLE" };
  }

  const last = normalized.history[normalized.history.length - 1];
  const prev = normalized.history[normalized.history.length - 2];
  if (
    !last ||
    !prev ||
    prev.color !== request.byColor ||
    prev.color !== normalized.turn ||
    prev.color === last.color ||
    !isValidCoord(prev.row, prev.col) ||
    !isValidCoord(last.row, last.col)
  ) {
    return { error: "UNDO_STALE" };
  }

  const board = normalized.board.slice();
  if (board[prev.row * BOARD_SIZE + prev.col] !== prev.color) {
    return { error: "UNDO_STALE" };
  }
  if (board[last.row * BOARD_SIZE + last.col] !== last.color) {
    return { error: "UNDO_STALE" };
  }
  board[prev.row * BOARD_SIZE + prev.col] = 0;
  board[last.row * BOARD_SIZE + last.col] = 0;

  const history = normalized.history.slice(0, -2);
  return {
    state: Object.assign({}, normalized, {
      board,
      history,
      moveCount: normalized.moveCount - 2,
      turn: prev.color,
      result: null,
      winningLine: null,
      lastMove: history.length > 0 ? history[history.length - 1] : null,
      undoRequest: null,
      rematch: { host: false, guest: false },
    }),
    status: "active",
  };
}

/**
 * 记录一次“同意重新开始”。
 * - 只有一方同意：保留原棋盘/胜负，只写 rematch。
 * - 双方都同意：开新局，交换黑白，清空棋盘，黑棋先手。
 */
function applyRematchVote(state, seat) {
  if (seat !== "host" && seat !== "guest") {
    return { error: "NOT_IN_ROOM" };
  }

  const normalized = normalizeState(state);
  const rematch = {
    host: normalized.rematch.host,
    guest: normalized.rematch.guest,
    [seat]: true,
  };

  if (rematch.host && rematch.guest) {
    return {
      state: createState(normalized.round + 1, swapColors(normalized.colors)),
      status: "active",
      started: true,
    };
  }

  return {
    state: Object.assign({}, normalized, { rematch }),
    status: "finished",
    started: false,
  };
}

function findWinningLine(board, index, color) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (const [dr, dc] of directions) {
    const line = [index];
    for (const sign of [-1, 1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        const i = r * BOARD_SIZE + c;
        if (board[i] !== color) break;
        if (sign < 0) line.unshift(i);
        else line.push(i);
        r += dr * sign;
        c += dc * sign;
      }
    }
    if (line.length >= WIN_LENGTH) return line;
  }
  return null;
}

function validateMove(state, row, col, color) {
  if (!isValidCoord(row, col)) return "INVALID_MOVE";
  if (!state || !Array.isArray(state.board) || state.board.length !== CELL_COUNT) {
    return "INTERNAL";
  }
  if (state.turn !== color) return "NOT_YOUR_TURN";
  if (state.board[row * BOARD_SIZE + col] !== 0) return "CELL_TAKEN";
  return null;
}

function applyMove(state, row, col, color) {
  const normalized = normalizeState(state);
  const invalid = validateMove(normalized, row, col, color);
  if (invalid) return { error: invalid };

  const board = normalized.board.slice();
  const index = row * BOARD_SIZE + col;
  board[index] = color;
  const moveCount = normalized.moveCount + 1;
  const winningLine = findWinningLine(board, index, color);
  const result = winningLine
    ? color === 1
      ? "black"
      : "white"
    : moveCount >= CELL_COUNT
      ? "draw"
      : null;
  const history = normalized.history.slice();
  history.push({ row, col, color });

  return {
    state: Object.assign({}, normalized, {
      board,
      history,
      turn: color === 1 ? 2 : 1,
      moveCount,
      result,
      winningLine,
      lastMove: { row, col, color },
    }),
    status: result ? "finished" : "active",
  };
}

module.exports = {
  BOARD_SIZE,
  WIN_LENGTH,
  CELL_COUNT,
  DEFAULT_COLORS,
  normalizeColors,
  normalizeState,
  createState,
  colorForSeat,
  swapColors,
  applyRematchVote,
  isValidCoord,
  validateMove,
  applyMove,
  findWinningLine,
  isValidRequestId,
  stateFingerprint,
  canRequestUndo,
  createUndoRequest,
  applyUndo,
};
