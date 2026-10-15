import type { Breakpoint } from "../../shared/protocol.ts";
import { BREAKPOINT_IDS } from "../../shared/protocol.ts";
import { countedRuns, effective } from "./session.ts";
import type { Run, Session } from "./session.ts";

/** Proposed thresholds (decision D4): Pass 80 percent or more, Watch 60 to 79, Fail under 60. */
export const THRESHOLDS = { pass: 0.8, watch: 0.6 } as const;

export type Verdict = "pass" | "watch" | "fail" | "n/a";

/** Integer arithmetic, so exactly 8 of 10 is a Pass and 6 of 10 is a Watch with no floating point drift. */
export function rateVerdict(hits: number, den: number): Verdict {
  if (den === 0) return "n/a";
  if (hits * 5 >= den * 4) return "pass";
  if (hits * 5 >= den * 3) return "watch";
  return "fail";
}

const ORDER: Verdict[] = ["fail", "watch", "pass"];
export const worstVerdict = (a: Verdict, b: Verdict): Verdict => (a === "n/a" ? b : b === "n/a" ? a : ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(b))]!);

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const v = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

export interface Rate { hits: number; den: number; rate: number | null }

export interface TaskTally {
  taskId: string;
  title: string;
  breakpoint: Breakpoint;
  highRisk: boolean;
  /** Counted runs: completed, not practice, latest attempt per participant, one per participant across sessions. */
  n: number;
  /** Content versions the counted runs were scored against. More than one means the targets changed part-way through. */
  contentVersions: number[];
  /** Mean place of the task in the session (1 is first). Someone who meets a task late has seen more of the navigation already. */
  meanPosition: number | null;
  level1: Rate;
  level2: Rate;
  verdictLevel1: Verdict;
  verdictLevel2: Verdict;
  /** The worse of the two levels. */
  verdict: Verdict;
  /** Runs recorded as search (R) and as a separately recorded answer (S): reported, never scored as hit or miss. */
  recordedOnly: number;
  separate: number;
  medianFirstInteractionMs: number | null;
  meanEase: number | null;
  /** A wrong click with ease 5 or more: the label or layout is persuasive, not unclear. */
  confidentWrong: number;
  /** Final link column for hits and misses, for tasks where the same answer lives in two places. */
  routeSplit: Record<string, number>;
  /** Final section for misses. */
  misreads: Record<string, number>;
  codes: Record<string, number>;
  prompts: { unaided: number; prompted: number };
  /** Runs where the participant reached the page via the footer. */
  viaFooter: number;
  /** Counted runs where the moderator has added or changed findings. The rest show the tool's suggestion. */
  reviewed: number;
}

const rate = (hits: number, den: number): Rate => ({ hits, den, rate: den === 0 ? null : hits / den });
/** Keys come from recorded data, so a key like "constructor" or "__proto__" must not reach the object's own machinery. */
const bump = (m: Record<string, number>, k: string) => { if (k === "__proto__") return; m[k] = (Object.hasOwn(m, k) ? m[k]! : 0) + 1; };

interface Counted { session: Session; run: Run }

/**
 * The runs that count for one task at one breakpoint: each participant once per task, whichever session or breakpoint it
 * came from. If the same participant ID was run more than once (a repeat, or a session ended early and started again),
 * the newest session with a counted run for the task wins, and only then is the breakpoint applied, so a repeat that
 * landed on a different breakpoint never puts one person in two cells. A breakpoint comes from each run, because a
 * participant now does different tasks at different breakpoints.
 */
function countedFor(sessions: Session[], taskId: string, breakpoint: Breakpoint): Counted[] {
  const latest = new Map<string, Counted>();
  for (const s of sessions) {
    if (s.practice) continue;
    const key = s.participantId || s.id;
    for (const r of countedRuns(s)) {
      if (r.taskId !== taskId) continue;
      const have = latest.get(key);
      if (!have || s.createdAt > have.session.createdAt) latest.set(key, { session: s, run: r });
    }
  }
  return [...latest.values()].filter((c) => c.run.breakpoint === breakpoint);
}

/** One task at one breakpoint, across every non-practice session. Titles and risk come from the sessions' own task snapshots. */
export function tallyTask(sessions: Session[], taskId: string, breakpoint: Breakpoint): TaskTally {
  const rows = countedFor(sessions, taskId, breakpoint);
  const newest = rows.slice().sort((a, b) => b.session.createdAt - a.session.createdAt)[0];
  const task = newest?.session.content.tasks.find((x) => x.id === taskId);
  const t: TaskTally = {
    taskId, title: task?.title ?? taskId, breakpoint, highRisk: task?.highRisk ?? false, n: 0, contentVersions: [], meanPosition: null,
    level1: rate(0, 0), level2: rate(0, 0), verdictLevel1: "n/a", verdictLevel2: "n/a", verdict: "n/a",
    recordedOnly: 0, separate: 0, medianFirstInteractionMs: null, meanEase: null, confidentWrong: 0,
    routeSplit: {}, misreads: {}, codes: {}, prompts: { unaided: 0, prompted: 0 }, viaFooter: 0, reviewed: 0,
  };
  let l1h = 0, l1d = 0, l2h = 0, l2d = 0;
  const times: number[] = [];
  const eases: number[] = [];
  const positions: number[] = [];
  const versions = new Set<number>();
  for (const { session, run: r } of rows) {
    t.n += 1;
    versions.add(session.content.version);
    const e = effective(r);
    if (e.level1 !== null) { l1d += 1; if (e.level1) l1h += 1; }
    if (e.level2 !== null) { l2d += 1; if (e.level2) l2h += 1; }
    if (e.tier === "R") t.recordedOnly += 1;
    if (e.tier === "S") t.separate += 1;
    if (r.suggestion?.firstInteractionMs != null) times.push(r.suggestion.firstInteractionMs);
    if (r.ease !== null) eases.push(r.ease);
    positions.push(r.position + 1);
    if (e.tier === "X" && r.ease !== null && r.ease >= 5) t.confidentWrong += 1;
    const sug = r.suggestion;
    if (sug?.finalColumn && (e.tier === "P" || e.tier === "A" || e.tier === "X" || e.tier === "S")) bump(t.routeSplit, sug.finalColumn);
    if (e.tier === "X" && sug?.finalSection) bump(t.misreads, sug.finalSection);
    if (e.code !== null) bump(t.codes, String(e.code));
    if (e.menu === "U") t.prompts.unaided += 1;
    if (e.menu === "P") t.prompts.prompted += 1;
    if (sug?.viaFooter) t.viaFooter += 1;
    if (r.moderator.reviewed) t.reviewed += 1;
  }
  t.contentVersions = [...versions].sort((a, b) => a - b);
  t.level1 = rate(l1h, l1d); t.level2 = rate(l2h, l2d);
  t.verdictLevel1 = rateVerdict(l1h, l1d); t.verdictLevel2 = rateVerdict(l2h, l2d);
  t.verdict = worstVerdict(t.verdictLevel1, t.verdictLevel2);
  t.medianFirstInteractionMs = median(times);
  t.meanEase = eases.length === 0 ? null : eases.reduce((a, b) => a + b, 0) / eases.length;
  t.meanPosition = positions.length === 0 ? null : positions.reduce((a, b) => a + b, 0) / positions.length;
  return t;
}

/**
 * Every task and breakpoint with at least one counted run, taken from what the sessions actually ran (their own task
 * snapshots), not from the current Content tab: renaming or removing a task later never drops or merges results.
 * Order follows the newest session's task list, then any older tasks.
 */
export function ledger(sessions: Session[]): TaskTally[] {
  const byNewest = sessions.slice().sort((a, b) => b.createdAt - a.createdAt);
  const ids: string[] = [];
  for (const s of byNewest) for (const t of s.content.tasks) if (!ids.includes(t.id)) ids.push(t.id);
  const out: TaskTally[] = [];
  for (const id of ids) for (const bp of BREAKPOINT_IDS) {
    const t = tallyTask(sessions, id, bp);
    if (t.n > 0) out.push(t);
  }
  return out;
}

/** Distinct participants with at least one counted run. */
export const countedSessions = (sessions: Session[]): number =>
  new Set(sessions.filter((s) => !s.practice && countedRuns(s).length > 0).map((s) => s.participantId || s.id)).size;
