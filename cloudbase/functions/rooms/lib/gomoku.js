"use strict";

const BOARD_SIZE = 15;
const WIN_LENGTH = 5;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

function createState(round) {
  return {
    board: new Array(CELL_COUNT).fill(0),
    turn: 1,
    moveCount: 0,
    result: null,
    winningLine: null,
    lastMove: null,
    round: round || 1,
  };
}

function colorForSeat(seat) {
  if (seat === "host") return 1;
  if (seat === "guest") return 2;
  return 0;
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
  const invalid = validateMove(state, row, col, color);
  if (invalid) return { error: invalid };

  const board = state.board.slice();
  const index = row * BOARD_SIZE + col;
  board[index] = color;
  const moveCount = state.moveCount + 1;
  const winningLine = findWinningLine(board, index, color);
  const result = winningLine
    ? color === 1
      ? "black"
      : "white"
    : moveCount >= CELL_COUNT
      ? "draw"
      : null;

  return {
    state: Object.assign({}, state, {
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
  createState,
  colorForSeat,
  isValidCoord,
  validateMove,
  applyMove,
  findWinningLine,
};
