import { validateContent } from "./content.ts";
import { sanitiseSession } from "./exports.ts";
import type { Session } from "./session.ts";
import { DEFAULT_CONTENT } from "./tasks.ts";
import type { Content } from "./tasks.ts";

/**
 * Browser storage with honest failure modes. There is no server, so a save that did not land must be loud: callers get
 * a result they can show, and a verify step catches a write the browser accepted but did not keep.
 */
export interface Backing {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export function memoryBacking(initial: Record<string, string> = {}): Backing {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); }, keys: () => [...m.keys()] };
}

/** localStorage, or null when the browser blocks it (private window, blocked site data, some file:// setups). */
export function browserBacking(): Backing | null {
  try {
    const ls = globalThis.localStorage;
    ls.setItem("__wc_probe", "1");
    ls.removeItem("__wc_probe");
    return {
      getItem: (k) => ls.getItem(k),
      setItem: (k, v) => ls.setItem(k, v),
      removeItem: (k) => ls.removeItem(k),
      keys: () => Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k): k is string => k !== null),
    };
  } catch {
    return null;
  }
}

const PREFIX = "wc.v1.";
const SESSION = PREFIX + "session.";
const CONTENT = PREFIX + "content";

export type SaveResult = { ok: true; at: number } | { ok: false; reason: "quota" | "verify" | "unavailable" };

const isQuota = (e: unknown): boolean => {
  const err = e as { name?: string; code?: number } | null;
  return !!err && (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED" || err.code === 22 || err.code === 1014);
};

export interface Store {
  /** False when the browser would not give us storage: everything lives in memory and is lost on reload. */
  persistent: boolean;
  lastSavedAt: number | null;
  /** True when saved custom content existed but could not be read, so the defaults were used. */
  contentFellBack: boolean;
  loadSessions(): { sessions: Session[]; skipped: number };
  saveSession(s: Session): SaveResult;
  removeSession(id: string): void;
  loadContent(): Content;
  saveContent(c: Content): SaveResult;
}

export function createStore(backing: Backing | null, now: () => number): Store {
  const b = backing ?? memoryBacking();
  const store: Store = {
    persistent: backing !== null,
    lastSavedAt: null,
    contentFellBack: false,
    loadSessions() {
      const sessions: Session[] = [];
      let skipped = 0;
      for (const key of b.keys().filter((k) => k.startsWith(SESSION))) {
        try {
          const s = sanitiseSession(JSON.parse(b.getItem(key) ?? "null"));
          if (s) sessions.push(s); else skipped += 1;
        } catch { skipped += 1; }
      }
      return { sessions: sessions.sort((x, y) => x.createdAt - y.createdAt), skipped };
    },
    saveSession(s) { return write(SESSION + s.id, JSON.stringify(s)); },
    removeSession(id) { b.removeItem(SESSION + id); },
    loadContent() {
      const raw = b.getItem(CONTENT);
      if (raw === null) return DEFAULT_CONTENT;
      try {
        const r = validateContent(JSON.parse(raw));
        if (r.ok) return r.content;
      } catch { /* fall through to the defaults */ }
      store.contentFellBack = true;
      return DEFAULT_CONTENT;
    },
    saveContent(c) { return write(CONTENT, JSON.stringify(c)); },
  };
  function write(key: string, value: string): SaveResult {
    if (!store.persistent) return { ok: false, reason: "unavailable" };
    try {
      b.setItem(key, value);
      if (b.getItem(key) !== value) return { ok: false, reason: "verify" };
    } catch (e) {
      return { ok: false, reason: isQuota(e) ? "quota" : "unavailable" };
    }
    const at = now();
    store.lastSavedAt = at;
    return { ok: true, at };
  }
  return store;
}
