"use strict";

const crypto = require("crypto");

const ROOM_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function generateRoomId() {
  return crypto.randomBytes(12).toString("base64url");
}

function isValidRoomId(value) {
  return typeof value === "string" && ROOM_ID_RE.test(value);
}

function parsePayload(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }
  return raw;
}

async function rpc(app, name, params) {
  const res = await app.rdb().rpc(name, params || {});
  if (res && res.error) {
    throw new Error(res.error.message || "rpc " + name + " failed");
  }
  return parsePayload(res ? res.data : null);
}

async function create(app, uid, state) {
  const roomId = generateRoomId();
  const data = await rpc(app, "room_create", {
    p_room_id: roomId,
    p_kind: "gomoku",
    p_host_uid: uid,
    p_state: state,
  });
  return { roomId, data };
}

async function join(app, roomId, uid) {
  return rpc(app, "room_join", { p_room_id: roomId, p_uid: uid });
}

async function get(app, roomId, uid) {
  return rpc(app, "room_get", { p_room_id: roomId, p_uid: uid });
}

async function commit(app, roomId, uid, expectedVersion, expectedStatus, state, status) {
  return rpc(app, "room_commit_state", {
    p_room_id: roomId,
    p_uid: uid,
    p_expected_version: expectedVersion,
    p_expected_status: expectedStatus,
    p_state: state,
    p_status: status,
  });
}

async function cleanup(app, beforeIso) {
  const res = await app.rdb().rpc("room_cleanup", { p_before: beforeIso });
  if (res && res.error) {
    throw new Error(res.error.message || "cleanup failed");
  }
  return res ? res.data : 0;
}

module.exports = {
  generateRoomId,
  isValidRoomId,
  create,
  join,
  get,
  commit,
  cleanup,
};
