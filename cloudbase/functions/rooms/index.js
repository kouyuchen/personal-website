"use strict";

const cloudbase = require("@cloudbase/node-sdk");
const { getUid } = require("./lib/identity");
const { ok, fail } = require("./lib/errors");
const rooms = require("./lib/rooms");
const gomoku = require("./lib/gomoku");

const app = cloudbase.init({});

function roomResponse(data) {
  if (!data) return fail("INTERNAL");
  if (data.error) return fail(data.error);
  if (!data.room) return fail("INTERNAL");
  return ok({ room: data.room });
}

function readRoomId(event) {
  const roomId = String((event && event.roomId) || "");
  return rooms.isValidRoomId(roomId) ? roomId : "";
}

exports.main = async (event, context) => {
  const action = event && event.action ? String(event.action) : "";

  try {
    if (action === "whoami") {
      const uid = getUid(app, context);
      return uid ? ok({ uid }) : fail("UNAUTHENTICATED");
    }

    const uid = getUid(app, context);
    if (!uid) return fail("UNAUTHENTICATED");

    switch (action) {
      case "createRoom": {
        const state = gomoku.createState(1);
        const created = await rooms.create(app, uid, state);
        return roomResponse(created.data);
      }

      case "joinRoom": {
        const roomId = readRoomId(event);
        if (!roomId) return fail("INVALID_ROOM_ID");
        return roomResponse(await rooms.join(app, roomId, uid));
      }

      case "getRoom": {
        const roomId = readRoomId(event);
        if (!roomId) return fail("INVALID_ROOM_ID");
        return roomResponse(await rooms.get(app, roomId, uid));
      }

      case "gomokuMove": {
        const roomId = readRoomId(event);
        if (!roomId) return fail("INVALID_ROOM_ID");
        const row = Number(event && event.row);
        const col = Number(event && event.col);
        if (!gomoku.isValidCoord(row, col)) return fail("INVALID_MOVE");

        const current = await rooms.get(app, roomId, uid);
        if (!current) return fail("INTERNAL");
        if (current.error) return fail(current.error);
        const room = current.room;
        if (!room) return fail("INTERNAL");
        if (room.status === "waiting") return fail("WAITING_FOR_OPPONENT");
        if (room.status !== "active") return fail("GAME_OVER");

        const state = gomoku.normalizeState(room.state);
        const color = gomoku.colorForSeat(state, room.seat);
        if (!color) return fail("NOT_IN_ROOM");

        const applied = gomoku.applyMove(state, row, col, color);
        if (applied.error) return fail(applied.error);

        const committed = await rooms.commit(
          app,
          roomId,
          uid,
          room.version,
          "active",
          applied.state,
          applied.status,
        );
        return roomResponse(committed);
      }

      // 旧 action 名保留为别名：老页面调用时也只会投一票，不会单方面重置。
      case "gomokuRematch":
      case "gomokuRestart": {
        const roomId = readRoomId(event);
        if (!roomId) return fail("INVALID_ROOM_ID");

        for (let attempt = 0; attempt < 5; attempt += 1) {
          const current = await rooms.get(app, roomId, uid);
          if (!current) return fail("INTERNAL");
          if (current.error) return fail(current.error);
          const room = current.room;
          if (!room) return fail("INTERNAL");

          // 对局已经被对方的重开请求启动：幂等返回最新房间。
          if (room.status === "active") return roomResponse(current);
          if (room.status === "waiting") return fail("WAITING_FOR_OPPONENT");
          if (room.status !== "finished") return fail("GAME_NOT_OVER");

          const state = gomoku.normalizeState(room.state);
          const seat = room.seat;
          if (!seat) return fail("NOT_IN_ROOM");

          // 自己已同意、但对方还没同意：不重复写版本。
          if (state.rematch[seat] && !(state.rematch.host && state.rematch.guest)) {
            return roomResponse(current);
          }

          const vote = gomoku.applyRematchVote(state, seat);
          if (vote.error) return fail(vote.error);

          const committed = await rooms.commit(
            app,
            roomId,
            uid,
            room.version,
            "finished",
            vote.state,
            vote.status,
          );

          if (committed && committed.error === "CONFLICT") {
            continue;
          }
          return roomResponse(committed);
        }

        return fail("CONFLICT");
      }

      default:
        return fail("UNKNOWN_ACTION");
    }
  } catch (err) {
    console.error("[rooms]", action, (err && err.stack) || err);
    return fail("INTERNAL");
  }
};
