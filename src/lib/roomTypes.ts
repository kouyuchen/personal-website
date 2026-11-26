export type RoomStatus = "waiting" | "active" | "finished";
export type RoomSeat = "host" | "guest";
export type GomokuResult = "black" | "white" | "draw" | null;

export interface GomokuState {
  board: number[];
  turn: 1 | 2;
  moveCount: number;
  result: GomokuResult;
  winningLine: number[] | null;
  lastMove: { row: number; col: number; color: 1 | 2 } | null;
  round: number;
}

export interface RoomSnapshot {
  id: string;
  kind: string;
  status: RoomStatus;
  version: number;
  state: GomokuState;
  seat: RoomSeat | null;
  guestJoined: boolean;
  hostOnline: boolean;
  guestOnline: boolean;
  createdAt: string;
  lastActiveAt: string;
  serverNow: string;
}
