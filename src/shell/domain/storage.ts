import { contentFingerprint, tasksFingerprint, validateContent } from "./content.ts";
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

/**
 * Fingerprints (tasksFingerprint of the validated tasks) of earlier shipped defaults. Saving in the Content tab stores a
 * copy of the tasks in the browser, so a copy of an old default would keep its old wording after a new release. A saved copy
 * that is exactly an earlier default is replaced by the current default; anything the researcher has edited is kept.
 * Add the fingerprint of the previous default whenever the default tasks change (print it with tasksFingerprint).
 */
const SUPERSEDED_DEFAULTS = new Set<string>([
  "f4e62947", // combined test as first shipped (22 Oct 2026): scenarios said "this" and "these"
  "8dc1e364", // version 5 (22 Oct 2026): products named, but R2 still began "Here is the page..."
]);

/** The same, for a default whose tasks did not change but whose other parts did (contentFingerprint of the whole content). */
const SUPERSEDED_CONTENT = new Set<string>([
  "a8baa120", // version 6 (22 Oct 2026): no closing questions for the participant
  "6c6cb6a4", // version 7 (22 Oct 2026): closing questions in the participant edition only, moderator's spoken debrief repeated them
  "ae6200d7", // version 8 (22 Oct 2026): the moderator's spoken debrief as a follow-up, still the Lavender product page
  "121db427", // version 9 (26 Oct 2026): the MetaPWR Advantage product page, closing questions all typed answers and a ranking by number
]);

const isSuperseded = (c: Content): boolean => SUPERSEDED_DEFAULTS.has(tasksFingerprint(c.tasks)) || SUPERSEDED_CONTENT.has(contentFingerprint(c));

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
  /** Removes this test's saved sessions and saved content edit only (keys it wrote itself), leaving the shipped defaults. Never touches other keys, other sites or other browser data. */
  clearAll(): void;
  loadContent(): Content;
  saveContent(c: Content): SaveResult;
}

/**
 * A session keeps a copy of the content it started with, so wording fixed after it began never reached it. For a session
 * that began on an earlier shipped default, the tasks the participant has not started take the current default's
 * participant-facing wording. Targets, order and everything already run are left alone: only the words change, and only
 * where nobody has yet read the old ones.
 */
export function refreshSupersededWording(s: Session): Session {
  if (!isSuperseded(s.content)) return s;
  const started = new Set(s.runs.map((r) => r.taskId));
  const tasks = s.content.tasks.map((t) => {
    const now = DEFAULT_CONTENT.tasks.find((d) => d.id === t.id);
    if (!now || started.has(t.id)) return t;
    return { ...t, scenario: now.scenario, questions: now.questions, leadIns: now.leadIns, confidence: now.confidence, notesPrompt: now.notesPrompt };
  });
  return { ...s, content: { ...s.content, tasks, debrief: DEFAULT_CONTENT.debrief ?? s.content.debrief, closingQuestions: DEFAULT_CONTENT.closingQuestions ?? s.content.closingQuestions } };
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
          const s = sanitiseSession(JSON.parse(b.getItem(key) ?? "null"), true);
          if (s) sessions.push(refreshSupersededWording(s)); else skipped += 1;
        } catch { skipped += 1; }
      }
      return { sessions: sessions.sort((x, y) => x.createdAt - y.createdAt), skipped };
    },
    saveSession(s) { return write(SESSION + s.id, JSON.stringify(s)); },
    removeSession(id) { b.removeItem(SESSION + id); },
    clearAll() { for (const key of b.keys()) if (key.startsWith(SESSION) || key === CONTENT) b.removeItem(key); },
    loadContent() {
      const raw = b.getItem(CONTENT);
      if (raw === null) return DEFAULT_CONTENT;
      try {
        const r = validateContent(JSON.parse(raw));
        if (r.ok && isSuperseded(r.content)) { b.removeItem(CONTENT); return DEFAULT_CONTENT; }
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
