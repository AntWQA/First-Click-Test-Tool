import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { browserBacking, createStore } from "./domain/storage.ts";
import type { SaveResult } from "./domain/storage.ts";
import { createSession, IllegalTransition, reduce } from "./domain/session.ts";
import type { Action, NewSessionParams, RunModerator, Session } from "./domain/session.ts";
import type { Content } from "./domain/tasks.ts";
import { mergeSessions } from "./domain/exports.ts";

export type SaveProblem = null | "quota" | "verify" | "unavailable";

export interface AppApi {
  /** False when the browser would not give us storage: nothing survives a reload, so say so loudly. */
  persistent: boolean;
  skippedOnLoad: number;
  /** The stored custom content could not be read, so the plan's tasks are in use. */
  contentFellBack: boolean;
  content: Content;
  saveContent: (c: Content) => SaveResult;
  sessions: Session[];
  active: Session | null;
  lastSavedAt: number | null;
  saveProblem: SaveProblem;
  notice: string | null;
  clearNotice: () => void;
  start: (p: Omit<NewSessionParams, "id" | "now" | "content">) => void;
  dispatch: (a: Action) => void;
  /** Adds the moderator's findings to one completed run of any session, now or later. */
  reviewRun: (sessionId: string, runId: string, patch: Partial<RunModerator>) => void;
  openSession: (id: string) => void;
  closeSession: () => void;
  deleteSession: (id: string) => void;
  importSessions: (list: Session[]) => { added: number; updated: number; kept: number };
}

const Ctx = createContext<AppApi | null>(null);
export const useApp = (): AppApi => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
};

export const makeId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** High-frequency actions (recorded events, and typing in the review, setup and debrief fields) are saved on a short delay; every step change straight away, which also flushes any pending save. */
const DEBOUNCED: Action["type"][] = ["event", "scale", "reviewRun", "setup", "debrief"];
/** The frame can report an event a moment after the task has ended: that is not an error. */
const QUIET: Action["type"][] = ["event", "scale"];

export function AppProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createStore(browserBacking(), Date.now), []);
  const [initial] = useState(() => ({ ...store.loadSessions(), content: store.loadContent() }));
  const [sessions, setSessions] = useState<Session[]>(initial.sessions);
  const [content, setContent] = useState<Content>(initial.content);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveProblem, setSaveProblem] = useState<SaveProblem>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sessionsRef = useRef(sessions);
  const activeRef = useRef(activeId);
  const pending = useRef<Session | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const record = useCallback((r: SaveResult) => {
    if (r.ok) { setLastSavedAt(r.at); setSaveProblem(null); } else setSaveProblem(r.reason);
  }, []);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (pending.current) { record(store.saveSession(pending.current)); pending.current = null; }
  }, [store, record]);

  const commit = useCallback((next: Session, delayed: boolean) => {
    const list = sessionsRef.current.some((s) => s.id === next.id) ? sessionsRef.current.map((s) => (s.id === next.id ? next : s)) : [...sessionsRef.current, next];
    sessionsRef.current = list;
    setSessions(list);
    pending.current = next;
    window.clearTimeout(timer.current);
    if (delayed) timer.current = window.setTimeout(flush, 400); else flush();
  }, [flush]);

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener("beforeunload", onHide);
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("beforeunload", onHide); window.removeEventListener("pagehide", onHide); };
  }, [flush]);

  useEffect(() => { if (!store.persistent) setSaveProblem("unavailable"); }, [store]);

  const dispatch = useCallback((a: Action) => {
    const cur = sessionsRef.current.find((s) => s.id === activeRef.current);
    if (!cur) return;
    try {
      commit(reduce(cur, a), DEBOUNCED.includes(a.type));
    } catch (e) {
      if (e instanceof IllegalTransition && QUIET.includes(a.type)) return;
      setNotice(e instanceof IllegalTransition ? e.message : "Something unexpected happened. Your data is safe; reload the page if this repeats.");
    }
  }, [commit]);

  const reviewRun = useCallback((sessionId: string, runId: string, patch: Partial<RunModerator>) => {
    const cur = sessionsRef.current.find((s) => s.id === sessionId);
    if (!cur) return;
    // A save waiting for another session must not be replaced by this one.
    if (pending.current && pending.current.id !== sessionId) flush();
    try {
      commit(reduce(cur, { type: "reviewRun", at: Date.now(), runId, patch }), true);
    } catch (e) {
      setNotice(e instanceof IllegalTransition ? e.message : "Something unexpected happened. Your data is safe; reload the page if this repeats.");
    }
  }, [commit, flush]);

  const api: AppApi = {
    persistent: store.persistent,
    skippedOnLoad: initial.skipped,
    contentFellBack: store.contentFellBack,
    content,
    saveContent: (c) => { const r = store.saveContent(c); record(r); if (r.ok) setContent(c); return r; },
    sessions,
    active: sessions.find((s) => s.id === activeId) ?? null,
    lastSavedAt,
    saveProblem,
    notice,
    clearNotice: () => setNotice(null),
    start: (p) => {
      const s = createSession({ ...p, id: makeId("s"), now: Date.now(), content });
      activeRef.current = s.id;
      setActiveId(s.id);
      commit(s, false);
    },
    dispatch,
    reviewRun,
    openSession: (id) => {
      const s = sessionsRef.current.find((x) => x.id === id);
      if (!s) return;
      activeRef.current = id;
      setActiveId(id);
      const resumed = reduce(s, { type: "resume", at: Date.now() });
      if (resumed.phase !== s.phase) commit(resumed, false);
    },
    closeSession: () => { flush(); activeRef.current = null; setActiveId(null); },
    deleteSession: (id) => {
      store.removeSession(id);
      sessionsRef.current = sessionsRef.current.filter((s) => s.id !== id);
      setSessions(sessionsRef.current);
      if (activeRef.current === id) { activeRef.current = null; setActiveId(null); }
    },
    importSessions: (list) => {
      const { merged, added, updated, kept } = mergeSessions(sessionsRef.current, list);
      for (const s of merged) if (list.some((l) => l.id === s.id)) record(store.saveSession(s));
      sessionsRef.current = merged;
      setSessions(merged);
      return { added, updated, kept };
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
