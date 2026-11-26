import { useEffect, useState, type FormEvent } from "react";
import { createRoom, RoomApiError } from "../lib/roomApi";
import { navigate } from "../lib/useHashRoute";

const LAST_ROOM_KEY = "gomoku:last-room";

export function parseRoomInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hashMatch = trimmed.match(/#\/gomoku\/([A-Za-z0-9_-]{8,64})/);
  if (hashMatch) return hashMatch[1];

  const pathMatch = trimmed.match(/\/gomoku\/([A-Za-z0-9_-]{8,64})/);
  if (pathMatch) return pathMatch[1];

  if (/^[A-Za-z0-9_-]{8,64}$/.test(trimmed)) return trimmed;
  return null;
}

export default function Lobby() {
  const [roomInput, setRoomInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [lastRoom, setLastRoom] = useState("");

  useEffect(() => {
    try {
      setLastRoom(window.localStorage.getItem(LAST_ROOM_KEY) || "");
    } catch {
      setLastRoom("");
    }
  }, []);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const room = await createRoom();
      try {
        window.localStorage.setItem(LAST_ROOM_KEY, room.id);
      } catch {
        // 本地存储不可用时不影响进入房间
      }
      navigate("#/gomoku/" + room.id);
    } catch (err) {
      setError(err instanceof RoomApiError ? err.message : "创建棋局失败，请稍后重试");
    } finally {
      setCreating(false);
    }
  }

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (joining) return;
    const roomId = parseRoomInput(roomInput);
    if (!roomId) {
      setError("请输入有效的邀请链接或房间号");
      return;
    }
    setJoining(true);
    setError("");
    navigate("#/gomoku/" + roomId);
  }

  return (
    <>
      <div className="game-topbar">
        <a className="game-back" href="#/">
          ← 返回首页
        </a>
        <span className="game-guest">游客身份 · 无需注册</span>
      </div>

      <section className="lobby">
        <h1 className="game-title">在线五子棋</h1>
        <p className="game-lead">
          创建棋局后，把邀请链接发给朋友。双方用手机或电脑即可实时对战，刷新或断网都会保留棋局。
        </p>

        <div className="lobby__card">
          <button
            className="game-button game-button--primary"
            type="button"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? "正在创建…" : "创建棋局"}
          </button>

          <p className="lobby__divider">或者加入已有棋局</p>

          <form className="lobby__form" onSubmit={handleJoin}>
            <label className="sr-only" htmlFor="room-input">
              邀请链接或房间号
            </label>
            <input
              id="room-input"
              className="game-input"
              type="text"
              value={roomInput}
              onChange={(event) => setRoomInput(event.target.value)}
              placeholder="粘贴邀请链接或输入房间号"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <button className="game-button" type="submit" disabled={joining}>
              {joining ? "正在加入…" : "加入棋局"}
            </button>
          </form>

          {lastRoom && (
            <button
              className="game-link-button"
              type="button"
              onClick={() => navigate("#/gomoku/" + lastRoom)}
            >
              继续上次棋局（房间 {lastRoom.slice(0, 6)}…）
            </button>
          )}
        </div>

        {error && (
          <p className="game-alert" role="alert">
            {error}
          </p>
        )}

        <p className="game-hint">
          规则：15×15 棋盘，黑棋先手，横、竖、斜任意方向连成 5 子及以上获胜；棋盘下满且无人获胜为平局。
        </p>
      </section>
    </>
  );
}
