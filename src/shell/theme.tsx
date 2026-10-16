import { useCallback, useEffect, useRef, useState } from "react";
import { MoonIcon, SunIcon } from "./brand.tsx";

type Theme = "light" | "dark";
const KEY = "wc.theme";

const systemTheme = (): Theme => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
const stored = (): Theme | null => { try { const v = window.localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : null; } catch { return null; } };

/** Light or dark, as the other tools do: the system setting until the person picks one, then their choice. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? systemTheme());
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      try { window.localStorage.setItem(KEY, next); } catch { /* the choice just lasts for this visit */ }
      return next;
    });
  }, []);
  return [theme, toggle];
}

/**
 * For the participant edition. By default it follows whoever is in charge of the page's theme: the host (claude.ai sets
 * data-theme on the root element when the viewer picks light or dark) or, when nobody has chosen, the computer's own
 * setting, and it keeps following either as they change. The button in the header makes an explicit choice of its own,
 * which is remembered. Whichever was changed last wins, so the host's control and this one never fight.
 */
export function useFollowedTheme(): [Theme, () => void] {
  const root = document.documentElement;
  const host = (): Theme | null => { const v = root.getAttribute("data-theme"); return v === "light" || v === "dark" ? v : null; };
  const [theme, setTheme] = useState<Theme>(() => stored() ?? host() ?? systemTheme());
  const state = useRef<{ ours: Theme | null; chose: boolean }>({ ours: null, chose: false });
  useEffect(() => {
    const st = state.current;
    st.chose = stored() !== null || host() !== null;   // someone has already made an explicit choice
    const set = (t: Theme) => { st.ours = t; setTheme(t); if (root.getAttribute("data-theme") !== t) root.setAttribute("data-theme", t); };
    set(stored() ?? host() ?? systemTheme());
    const watch = new MutationObserver(() => {
      const v = host();
      if (v !== null && v === st.ours) return;           // our own write
      st.chose = v !== null;
      if (v === null) { try { window.localStorage.removeItem(KEY); } catch { /* ignore */ } }
      else { try { window.localStorage.setItem(KEY, v); } catch { /* ignore */ } }   // the host's latest choice is the one to remember
      set(v ?? systemTheme());
    });
    watch.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => { if (!st.chose) set(systemTheme()); };
    mq.addEventListener("change", onSystem);
    return () => { watch.disconnect(); mq.removeEventListener("change", onSystem); };
  }, [root]);
  const toggle = useCallback(() => {
    const st = state.current;
    const next: Theme = (root.getAttribute("data-theme") === "dark" ? "dark" : "light") === "dark" ? "light" : "dark";
    st.chose = true; st.ours = next; setTheme(next);
    root.setAttribute("data-theme", next);
    try { window.localStorage.setItem(KEY, next); } catch { /* the choice just lasts for this visit */ }
  }, [root]);
  return [theme, toggle];
}

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button type="button" className="icon-btn" onClick={onToggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
