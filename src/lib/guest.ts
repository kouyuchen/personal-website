import cloudbase from "@cloudbase/js-sdk";
import {
  CLOUDBASE_ENV_ID,
  CLOUDBASE_PUBLISHABLE_KEY,
  CLOUDBASE_REGION,
} from "../gomoku/config";

export type CloudbaseApp = ReturnType<typeof cloudbase.init>;

let app: CloudbaseApp | null = null;
let sessionPromise: Promise<void> | null = null;

export function getCloudbaseApp(): CloudbaseApp {
  if (!app) {
    app = cloudbase.init({
      env: CLOUDBASE_ENV_ID,
      region: CLOUDBASE_REGION,
      accessKey: CLOUDBASE_PUBLISHABLE_KEY,
      persistence: "local",
    });
  }
  return app;
}

/**
 * 游客身份：首次进入自动匿名登录，之后复用浏览器里的会话。
 * 不做注册、不收集资料；服务端只信任 JWT 里的 uid。
 */
export async function ensureGuestSession(): Promise<void> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const auth = getCloudbaseApp().auth();
      const current = await auth.getSession();
      if (!current.error && current.data.session) return;

      const result = await auth.signInAnonymously();
      if (result.error) {
        throw new Error(result.error.message || "匿名登录失败");
      }
    })().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}
