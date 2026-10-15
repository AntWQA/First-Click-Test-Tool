import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { emitReady, emitRoute, emitSearch, resetDrill, setNavigator, startClock, startMenuObserver } from "./recorder.ts";

/**
 * Rendered inside the router, next to the app. Reports routes and searches, starts the clock and the menu observer when
 * the app mounts, and says "ready" once the page has painted. A remount (the shell's reset) mounts it again, so the
 * clock restarts and a fresh "ready" follows, which is what the shell waits for.
 */
export function RecorderBridge() {
  const navigate = useNavigate();
  const nav = useRef(navigate);
  nav.current = navigate;
  const { pathname, search } = useLocation();
  const lastSearch = useRef<string | null>(null);

  useEffect(() => {
    startClock();
    resetDrill();
    setNavigator((to) => nav.current(to));
    const stopMenus = startMenuObserver();
    let raf2 = 0;
    // Ready is reported after the page has painted (two frames), so timing does not include startup work.
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(emitReady); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); stopMenus(); setNavigator(null); };
  }, []);

  useEffect(() => {
    emitRoute(pathname + search);
    if (pathname === "/search") {
      const q = new URLSearchParams(search).get("q") ?? "";
      if (q !== "" && q !== lastSearch.current) emitSearch(q);
      lastSearch.current = q;
    } else lastSearch.current = null;
  }, [pathname, search]);

  return null;
}
