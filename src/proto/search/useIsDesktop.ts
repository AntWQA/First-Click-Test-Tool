import { useEffect, useState } from "react";

/** True at Pure's lg breakpoint (1024px) and above. */
export function useIsDesktop(): boolean {
  const query = "(min-width: 1024px)";
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatch(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);
  return match;
}
