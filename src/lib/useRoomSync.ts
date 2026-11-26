import { useCallback, useEffect, useRef, useState } from "react";
import { joinRoom, RoomApiError } from "./roomApi";
import { pollingTransport, type RoomTransport } from "./roomTransport";
import type { RoomSnapshot } from "./roomTypes";

export type SyncStatus = "connecting" | "live" | "reconnecting" | "offline";

export interface UseRoomSyncResult {
  room: RoomSnapshot | null;
  status: SyncStatus;
  connectionMessage: string;
  joinError: RoomApiError | null;
  applyRoom: (room: RoomSnapshot) => void;
  refresh: () => void;
}

function nextDelay(room: RoomSnapshot | null): number {
  if (!room) return 1500;
  if (room.state.undoRequest) return 1000;
  if (room.status === "waiting") return 2000;
  if (room.status === "finished") {
    const votes = room.state.rematch;
    const anyVote = !!(votes && (votes.host || votes.guest));
    // 已经有人同意重开时，双方都需要更快看到另一方是否也同意。
    return anyVote ? 1000 : 3000;
  }
  const colors = room.state.colors || { host: 1, guest: 2 };
  const myColor = room.seat === "guest" ? colors.guest : colors.host;
  return room.state.turn === myColor ? 2500 : 1000;
}

/**
 * 可复用的房间同步 hook。
 *
 * - 进入房间先 join（幂等，刷新后恢复原席位）
 * - 之后按房间状态自适应轮询；页面隐藏时暂停，回到前台立即拉取
 * - 断线退避重试；只接受版本号不倒退的快照
 * - 传输层由 RoomTransport 决定，未来可换推送
 */
export function useRoomSync(
  roomId: string,
  transport: RoomTransport = pollingTransport,
): UseRoomSyncResult {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [joinError, setJoinError] = useState<RoomApiError | null>(null);

  const roomRef = useRef<RoomSnapshot | null>(null);
  const refreshRef = useRef<() => void>(() => {});

  const applyRoom = useCallback((next: RoomSnapshot) => {
    const previous = roomRef.current;
    if (previous && next.version < previous.version) return;
    roomRef.current = next;
    setRoom(next);
    setStatus("live");
    setConnectionMessage("");
  }, []);

  const refresh = useCallback(() => {
    refreshRef.current();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    let inFlight = false;
    let failures = 0;
    let nextIsJoin = false;

    roomRef.current = null;
    setRoom(null);
    setJoinError(null);
    setStatus("connecting");

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = (delay?: number) => {
      clearTimer();
      if (cancelled || document.visibilityState === "hidden") return;
      const wait = delay !== undefined ? delay : nextDelay(roomRef.current);
      timer = window.setTimeout(() => {
        const doJoin = nextIsJoin;
        nextIsJoin = false;
        void run(doJoin);
      }, wait);
    };

    const run = async (isJoin: boolean) => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const next = isJoin ? await joinRoom(roomId) : await transport.fetchRoom(roomId);
        if (cancelled) return;
        failures = 0;
        applyRoom(next);
        setJoinError(null);
        schedule();
      } catch (err) {
        if (cancelled) return;
        const apiError =
          err instanceof RoomApiError ? err : new RoomApiError("NETWORK", "网络连接失败，请检查网络");

        if (isJoin && ["ROOM_FULL", "ROOM_NOT_FOUND", "INVALID_ROOM_ID"].includes(apiError.code)) {
          setJoinError(apiError);
          setStatus("offline");
          return;
        }

        if (!isJoin && apiError.code === "NOT_IN_ROOM") {
          nextIsJoin = true;
          failures = 0;
          setStatus("reconnecting");
          setConnectionMessage("正在重新进入房间…");
          schedule(200);
          return;
        }

        failures += 1;
        setStatus(failures >= 3 ? "offline" : "reconnecting");
        setConnectionMessage(apiError.message);
        schedule(Math.min(8000, 1000 * 2 ** failures));
      } finally {
        inFlight = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        clearTimer();
        void run(false);
      }
    };

    refreshRef.current = () => {
      clearTimer();
      void run(false);
    };

    document.addEventListener("visibilitychange", onVisibility);
    void run(true);

    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      refreshRef.current = () => {};
    };
  }, [roomId, transport, applyRoom]);

  return { room, status, connectionMessage, joinError, applyRoom, refresh };
}
