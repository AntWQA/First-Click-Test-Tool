import { useCallback, useEffect, useState } from "react";
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

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button type="button" className="icon-btn" onClick={onToggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
