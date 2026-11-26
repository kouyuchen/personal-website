"use strict";

const BOARD_SIZE = 15;
const WIN_LENGTH = 5;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
const DEFAULT_COLORS = { host: 1, guest: 2 };

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

function normalizeState(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  const board =
    Array.isArray(base.board) && base.board.length === CELL_COUNT
      ? base.board.slice()
      : new Array(CELL_COUNT).fill(0);

  return Object.assign({}, base, {
    board,
    turn: base.turn === 2 ? 2 : 1,
    moveCount:
      Number.isInteger(base.moveCount) && base.moveCount >= 0 ? base.moveCount : 0,
    result:
      base.result === "black" || base.result === "white" || base.result === "draw"
        ? base.result
        : null,
    winningLine: Array.isArray(base.winningLine) ? base.winningLine.slice() : null,
    lastMove:
      base.lastMove && typeof base.lastMove === "object" ? base.lastMove : null,
    round: Number.isInteger(base.round) && base.round > 0 ? base.round : 1,
    colors: normalizeColors(base.colors),
    rematch: {
      host: !!(base.rematch && base.rematch.host),
      guest: !!(base.rematch && base.rematch.guest),
    },
  });
}

function createState(round, colors) {
  return {
    board: new Array(CELL_COUNT).fill(0),
    turn: 1,
    moveCount: 0,
    result: null,
    winningLine: null,
    lastMove: null,
    round: round || 1,
    colors: normalizeColors(colors),
    rematch: { host: false, guest: false },
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

  return {
    state: Object.assign({}, normalized, {
      board,
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
};
