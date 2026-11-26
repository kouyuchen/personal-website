"use strict";

const MESSAGES = {
  UNAUTHENTICATED: "身份初始化失败，请刷新重试",
  ROOM_NOT_FOUND: "房间不存在或已过期",
  ROOM_FULL: "房间已满，已有两位玩家",
  NOT_IN_ROOM: "你不在这个房间",
  NOT_YOUR_TURN: "还没轮到你落子",
  WAITING_FOR_OPPONENT: "等待对方加入后再开始",
  CELL_TAKEN: "这个位置已经有棋子",
  GAME_OVER: "本局已经结束",
  GAME_NOT_OVER: "本局还没有结束",
  CONFLICT: "棋局已更新，请重试",
  INVALID_MOVE: "落子位置无效",
  INVALID_ROOM_ID: "房间号格式不正确",
  INVALID_STATE: "棋局状态无效",
  INVALID_STATUS: "房间状态无效",
  UNSUPPORTED_KIND: "不支持的游戏类型",
  RATE_LIMITED: "创建房间过于频繁，请稍后再试",
  UNKNOWN_ACTION: "未知操作",
  INTERNAL: "服务暂时不可用，请稍后重试",
};

function ok(payload) {
  return Object.assign({ ok: true }, payload || {});
}

function fail(code, message) {
  return { ok: false, code, message: message || MESSAGES[code] || MESSAGES.INTERNAL };
}

module.exports = { ok, fail, MESSAGES };
