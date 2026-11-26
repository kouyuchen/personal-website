import { ensureGuestSession, getCloudbaseApp } from "./guest";
import type { RoomSnapshot } from "./roomTypes";
import { ROOMS_FUNCTION } from "../gomoku/config";

export class RoomApiError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RoomApiError";
    this.code = code;
  }
}

interface ApiBody {
  ok: boolean;
  code?: string;
  message?: string;
  room?: RoomSnapshot;
  uid?: string;
}

async function call<T extends ApiBody>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  await ensureGuestSession();

  const response = await getCloudbaseApp().callFunction({
    name: ROOMS_FUNCTION,
    data: { action, ...data },
    parse: true,
  });

  if (response.code) {
    throw new RoomApiError(response.code, response.message || "服务暂时不可用");
  }

  let body = response.result as ApiBody | string | undefined;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body) as ApiBody;
    } catch {
      body = undefined;
    }
  }

  if (!body) {
    throw new RoomApiError("INTERNAL", "服务没有返回数据");
  }
  if (!body.ok) {
    throw new RoomApiError(body.code || "INTERNAL", body.message || "操作失败");
  }
  return body as T;
}

export async function createRoom(): Promise<RoomSnapshot> {
  const body = await call<ApiBody>("createRoom");
  if (!body.room) throw new RoomApiError("INTERNAL", "创建房间失败");
  return body.room;
}

export async function joinRoom(roomId: string): Promise<RoomSnapshot> {
  const body = await call<ApiBody>("joinRoom", { roomId });
  if (!body.room) throw new RoomApiError("INTERNAL", "加入房间失败");
  return body.room;
}

export async function getRoom(roomId: string): Promise<RoomSnapshot> {
  const body = await call<ApiBody>("getRoom", { roomId });
  if (!body.room) throw new RoomApiError("INTERNAL", "读取房间失败");
  return body.room;
}

export async function gomokuMove(roomId: string, row: number, col: number): Promise<RoomSnapshot> {
  const body = await call<ApiBody>("gomokuMove", { roomId, row, col });
  if (!body.room) throw new RoomApiError("INTERNAL", "落子失败");
  return body.room;
}

export async function gomokuRematch(roomId: string): Promise<RoomSnapshot> {
  const body = await call<ApiBody>("gomokuRematch", { roomId });
  if (!body.room) throw new RoomApiError("INTERNAL", "重新开始失败");
  return body.room;
}
