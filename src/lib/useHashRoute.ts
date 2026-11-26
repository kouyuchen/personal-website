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

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

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
