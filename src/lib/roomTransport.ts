import { getRoom } from "./roomApi";
import type { RoomSnapshot } from "./roomTypes";

/**
 * 房间同步传输层接口。
 *
 * 当前是短轮询；未来接入 WebSocket/Realtime 时，
 * 新增一个实现即可，页面和游戏逻辑不用改。
 */
export interface RoomTransport {
  readonly mode: "polling";
  fetchRoom(roomId: string): Promise<RoomSnapshot>;
}

export const pollingTransport: RoomTransport = {
  mode: "polling",
  fetchRoom: getRoom,
};
