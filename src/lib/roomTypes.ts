export type RoomStatus = "waiting" | "active" | "finished";
export type RoomSeat = "host" | "guest";
export type GomokuResult = "black" | "white" | "draw" | null;

export interface GomokuColors {
  host: 1 | 2;
  guest: 1 | 2;
}

export interface GomokuRematchVotes {
  host: boolean;
  guest: boolean;
}

export interface GomokuState {
  board: number[];
  turn: 1 | 2;
  moveCount: number;
  result: GomokuResult;
  winningLine: number[] | null;
  lastMove: { row: number; col: number; color: 1 | 2 } | null;
  round: number;
  // 旧房间可能没有这两个字段，前端按 host=黑、guest=白、未同意处理。
  colors?: GomokuColors;
  rematch?: GomokuRematchVotes;
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
