import { useEffect, useState } from "react";

/** Current viewport height in px, so a panel can be sized to the space under the fixed header. */
export function useViewportHeight(): number {
  const [height, setHeight] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 0));
  useEffect(() => {
    const on = () => setHeight(window.innerHeight);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return height;
}
