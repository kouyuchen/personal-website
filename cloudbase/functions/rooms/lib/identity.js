"use strict";

function getUid(app, context) {
  try {
    const info = app.auth().getUserInfo();
    if (info && info.uid) return info.uid;
  } catch (err) {
    // 非请求上下文或 SDK 版本差异时忽略，继续回退
  }
  try {
    if (context && context.userInfo && context.userInfo.uid) {
      return context.userInfo.uid;
    }
  } catch (err) {
    // ignore
  }
  return "";
}

module.exports = { getUid };
