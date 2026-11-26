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

        const color = gomoku.colorForSeat(room.seat);
        if (!color) return fail("NOT_IN_ROOM");

        const applied = gomoku.applyMove(room.state, row, col, color);
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

      case "gomokuRestart": {
        const roomId = readRoomId(event);
        if (!roomId) return fail("INVALID_ROOM_ID");

        const current = await rooms.get(app, roomId, uid);
        if (!current) return fail("INTERNAL");
        if (current.error) return fail(current.error);
        const room = current.room;
        if (!room) return fail("INTERNAL");
        if (room.status !== "finished") return fail("GAME_NOT_OVER");

        const nextRound = ((room.state && room.state.round) || 1) + 1;
        const state = gomoku.createState(nextRound);
        const committed = await rooms.commit(
          app,
          roomId,
          uid,
          room.version,
          "finished",
          state,
          "active",
        );
        return roomResponse(committed);
      }

      default:
        return fail("UNKNOWN_ACTION");
    }
  } catch (err) {
    console.error("[rooms]", action, (err && err.stack) || err);
    return fail("INTERNAL");
  }
};
