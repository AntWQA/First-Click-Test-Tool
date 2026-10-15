import { useCallback, useState } from "react";
import { defaultRecentSearches } from "./content";

const KEY = "storefront-demo-recent-searches";

const read = (): string[] => {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as string[]) : defaultRecentSearches; } catch { return defaultRecentSearches; }
};
const write = (list: string[]) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage unavailable: keep in memory only */ } };

/** Recent searches, persisted in localStorage when available. Seeded with a few dummy entries for the demo. */
export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>(read);
  const add = useCallback((term: string) => {
    const t = term.trim(); if (!t) return;
    setRecent((cur) => { const next = [t, ...cur.filter((c) => c.toLowerCase() !== t.toLowerCase())].slice(0, 6); write(next); return next; });
  }, []);
  const remove = useCallback((term: string) => setRecent((cur) => { const next = cur.filter((c) => c !== term); write(next); return next; }), []);
  const clear = useCallback(() => { write([]); setRecent([]); }, []);
  return { recent, add, remove, clear };
}
