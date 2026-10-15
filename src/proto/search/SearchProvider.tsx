import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useRecentSearches } from "./recent";

interface SearchContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  query: string;
  setQuery: (q: string) => void;
  /** Record the search, close the overlay and go to the results page. */
  submit: (q: string) => void;
  recent: ReturnType<typeof useRecentSearches>;
}

const Ctx = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const recent = useRecentSearches();

  // The field mirrors the query of the results page, and clears elsewhere.
  useEffect(() => {
    setQuery(pathname === "/search" ? new URLSearchParams(search).get("q") ?? "" : "");
    setOpen(false);
  }, [pathname, search]);

  // Esc closes search from anywhere inside the overlay, not only from the input.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = useCallback((q: string) => {
    const t = q.trim();
    if (!t) return;
    recent.add(t);
    setQuery(t);
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(t)}`);
  }, [navigate, recent]);

  const value = useMemo(() => ({ open, setOpen, query, setQuery, submit, recent }), [open, query, submit, recent]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSearch(): SearchContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSearch must be used inside SearchProvider");
  return v;
}

/** Like useSearch, but returns null outside a provider (lets SiteHeader reuse a provider mounted higher up). */
export function useSearchOptional(): SearchContextValue | null {
  return useContext(Ctx);
}
