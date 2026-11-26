import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "gomoku"; roomId?: string };

const ROOM_RE = /^\/gomoku\/([A-Za-z0-9_-]{8,64})$/;

function parseHash(hash: string): Route {
  const clean = hash.replace(/^#/, "");
  if (clean === "/gomoku" || clean === "/gomoku/") {
    return { name: "gomoku" };
  }
  const match = clean.match(ROOM_RE);
  if (match) {
    return { name: "gomoku", roomId: match[1] };
  }
  return { name: "home" };
}

function parseInitialRoute(): Route {
  const hash = window.location.hash;
  if (hash && hash !== "#") return parseHash(hash);

  // 邀请链接使用查询参数：默认域名的「确定访问」中间页会保留查询参数，
  // 但会丢掉 hash，因此 ?room=xxx 是更可靠的邀请方式。
  const room = new URLSearchParams(window.location.search).get("room");
  if (room && /^[A-Za-z0-9_-]{8,64}$/.test(room)) {
    return { name: "gomoku", roomId: room };
  }
  return { name: "home" };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseInitialRoute());

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}
