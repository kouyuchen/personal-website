"use strict";

const cloudbase = require("@cloudbase/node-sdk");
const app = cloudbase.init({});

const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

exports.main = async () => {
  try {
    const before = new Date(Date.now() - DEFAULT_RETENTION_MS).toISOString();
    const res = await app.rdb().rpc("room_cleanup", { p_before: before });
    if (res && res.error) {
      throw new Error(res.error.message || "room_cleanup failed");
    }
    return { ok: true, removed: res ? res.data : 0 };
  } catch (err) {
    console.error("[roomsCleanup]", (err && err.stack) || err);
    return { ok: false, code: "INTERNAL" };
  }
};
