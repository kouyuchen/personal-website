import { useEffect, useState } from "react";
import Board from "./Board";
import { gomokuMove, gomokuRematch, RoomApiError } from "../lib/roomApi";
import { useRoomSync } from "../lib/useRoomSync";
import type { RoomSnapshot } from "../lib/roomTypes";

const LAST_ROOM_KEY = "gomoku:last-room";
const DEFAULT_COLORS: { host: 1 | 2; guest: 1 | 2 } = { host: 1, guest: 2 };

function colorsOf(room: RoomSnapshot) {
  return room.state.colors || DEFAULT_COLORS;
}

function myColorNumber(room: RoomSnapshot): 0 | 1 | 2 {
  if (!room.seat) return 0;
  const colors = colorsOf(room);
  return room.seat === "host" ? colors.host : colors.guest;
}

function myColorLabel(room: RoomSnapshot): string {
  return myColorNumber(room) === 1 ? "黑棋" : "白棋";
}

function rematchVotes(room: RoomSnapshot) {
  return room.state.rematch || { host: false, guest: false };
}

function statusText(room: RoomSnapshot, isMyTurn: boolean): string {
  if (room.status === "waiting") return "等待对方加入";
  if (room.status === "finished") return resultText(room);
  return isMyTurn ? "轮到你落子" : "等待对方落子";
}

function resultText(room: RoomSnapshot): string {
  const result = room.state.result;
  const myColor = myColorNumber(room);
  if (result === "draw") return "平局";
  if (result === "black") return myColor === 1 ? "黑棋获胜，你赢了！" : "黑棋获胜";
  if (result === "white") return myColor === 2 ? "白棋获胜，你赢了！" : "白棋获胜";
  return "";
}

function resultTone(room: RoomSnapshot): "win" | "lose" | "draw" | "none" {
  if (room.status !== "finished") return "none";
  const result = room.state.result;
  const myColor = myColorNumber(room);
  if (result === "draw") return "draw";
  if (result === "black") return myColor === 1 ? "win" : "lose";
  if (result === "white") return myColor === 2 ? "win" : "lose";
  return "none";
}

export default function Room({ roomId }: { roomId: string }) {
  const { room, status, connectionMessage, joinError, applyRoom, refresh } = useRoomSync(roomId);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);

  const roomForStorage = room?.id;
  useEffect(() => {
    if (!roomForStorage) return;
    try {
      window.localStorage.setItem(LAST_ROOM_KEY, roomForStorage);
    } catch {
      // 忽略本地存储失败
    }
  }, [roomForStorage]);

  if (joinError) {
    return (
      <div className="game-message">
        <h1 className="game-title">进不去这个房间</h1>
        <p className="game-lead">{joinError.message}</p>
        <a className="game-button game-button--primary" href="#/">
          返回首页
        </a>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="game-message">
        <p className="game-lead">
          {status === "reconnecting" || status === "offline"
            ? connectionMessage || "连接中断，正在重试…"
            : "正在进入房间…"}
        </p>
        <a className="game-back" href="#/">
          ← 返回首页
        </a>
      </div>
    );
  }

  const myColor = myColorLabel(room);
  const myTurnColor = myColorNumber(room);
  const isMyTurn = room.status === "active" && room.state.turn === myTurnColor;
  const opponentOnline = room.seat === "host" ? room.guestOnline : room.hostOnline;
  const opponentJoined = room.seat === "host" ? room.guestJoined : true;
  const inviteLink = window.location.origin + window.location.pathname + "?room=" + room.id;
  const tone = resultTone(room);
  const boardDisabled = room.status !== "active" || !isMyTurn || pending;

  const votes = rematchVotes(room);
  const mySeat = room.seat;
  const otherSeat = mySeat === "host" ? "guest" : "host";
  const myVoted = mySeat ? !!votes[mySeat] : false;
  const otherVoted = mySeat ? !!votes[otherSeat] : false;
  const rematchLabel = myVoted
    ? "等待对方同意重新开始"
    : otherVoted
      ? "同意重新开始"
      : "重新开始";

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      const input = document.getElementById("invite-link") as HTMLInputElement | null;
      if (input) {
        input.focus();
        input.select();
        document.execCommand("copy");
      }
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function handlePlay(row: number, col: number) {
    if (!room || boardDisabled) return;
    if (room.state.board[row * 15 + col] !== 0) {
      setActionError("这个位置已经有棋子");
      return;
    }
    setPending(true);
    setActionError("");
    try {
      const next = await gomokuMove(room.id, row, col);
      applyRoom(next);
    } catch (err) {
      const apiError = err instanceof RoomApiError ? err : new RoomApiError("NETWORK", "网络连接失败");
      setActionError(apiError.message);
      if (apiError.code === "CONFLICT") refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleRematch() {
    if (!room || room.status !== "finished" || pending || myVoted) return;
    setPending(true);
    setActionError("");
    try {
      const next = await gomokuRematch(room.id);
      applyRoom(next);
    } catch (err) {
      const apiError = err instanceof RoomApiError ? err : new RoomApiError("NETWORK", "网络连接失败");
      setActionError(apiError.message);
      if (apiError.code === "CONFLICT") refresh();
    } finally {
      setPending(false);
    }
  }

  const oppositeLabel = !opponentJoined
    ? "等待加入"
    : opponentOnline
      ? "在线"
      : "离线（棋局保留）";

  return (
    <>
      <div className="game-topbar">
        <a className="game-back" href="#/">
          ← 返回首页
        </a>
        <span className="game-guest">游客身份 · 无需注册</span>
      </div>

      <div className="game-room">
        <section className="game-panel">
          <div className="game-status">
            <div>
              <p className="game-status__main" role="status">
                {statusText(room, isMyTurn)}
              </p>
              <p className="game-hint">
                第 {room.state.round || 1} 局 · 你执{myColor} · 房间{" "}
                <span className="game-code">{room.id}</span>
              </p>
            </div>
            <span className="game-badge">
              <span
                className={
                  "game-dot " +
                  (!opponentJoined ? "" : opponentOnline ? "game-dot--online" : "game-dot--offline")
                }
              />
              对方：{oppositeLabel}
            </span>
          </div>

          {room.status === "finished" && (
            <p className={"game-result game-result--" + tone}>{resultText(room)}</p>
          )}

          {room.status === "finished" && (myVoted || otherVoted) && (
            <p className="game-rematch" role="status">
              {myVoted
                ? "已同意重新开始，等待对方同意重新开始…"
                : "对方已同意重新开始，点击下方按钮确认。"}
            </p>
          )}

          {room.status === "finished" && !myVoted && !otherVoted && (
            <p className="game-hint">双方都同意后才开始下一局，并自动交换黑白。</p>
          )}

          {(status === "reconnecting" || status === "offline") && (
            <p className="game-alert" role="status">
              {connectionMessage || "连接中断，正在重试…"}
            </p>
          )}

          {actionError && (
            <p className="game-alert" role="alert">
              {actionError}
            </p>
          )}
        </section>

        <section className="game-panel game-invite">
          <label className="game-label" htmlFor="invite-link">
            邀请链接
          </label>
          <div className="game-invite__row">
            <input
              id="invite-link"
              className="game-input"
              type="text"
              readOnly
              value={inviteLink}
              onFocus={(event) => event.currentTarget.select()}
            />
            <button className="game-button" type="button" onClick={copyInvite}>
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <p className="game-hint">
            {room.status === "waiting"
              ? "对方打开链接会自动加入并执白棋。"
              : "把链接发给朋友，双方棋盘会保持同步。"}
          </p>
        </section>

        <Board
          board={room.state.board}
          disabled={boardDisabled}
          lastMove={room.state.lastMove}
          winningLine={room.state.winningLine}
          onPlay={handlePlay}
        />

        <div className="game-actions">
          {room.status === "finished" && (
            <button
              className="game-button game-button--primary"
              type="button"
              onClick={handleRematch}
              disabled={pending || myVoted}
            >
              {pending ? "处理中…" : rematchLabel}
            </button>
          )}
          <a className="game-button" href="#/">
            返回网站首页
          </a>
        </div>

        {room.status === "active" && (
          <p className="game-hint">
            点击棋盘交叉点落子；不是你的回合或已有棋子的位置不会生效。
          </p>
        )}
      </div>
    </>
  );
}
