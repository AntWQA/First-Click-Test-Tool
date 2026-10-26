import type { Breakpoint, CapturedEvent } from "../../shared/protocol.ts";
import { OTHER_OPTION } from "./tasks.ts";
import type { Arrival, ClosingQuestion, Content, Task } from "./tasks.ts";
import { applyOverrides, arrivalFor, buildPlan, deviceFor, runsOn, sessionOrder } from "./order.ts";
import { suggest } from "./scoring.ts";
import type { EndReason, Suggestion, Tier, WrongClickCode } from "./scoring.ts";

export type Group = "" | "non-member" | "WA" | "WC";

/**
 * setup, debrief and ended belong to the moderator; intro, task, rating, offer and handBack belong to the participant. The
 * participant goes from one task straight to the next; the only hand-back is once the last task is done. Findings are
 * added afterwards, from the Ledger or the session record, for any completed run.
 * The surface comes from the phase and lives in session state, never in the URL, so the participant cannot navigate to
 * a moderator screen with the back button.
 */
export type Phase = "setup" | "intro" | "task" | "rating" | "offer" | "handBack" | "debrief" | "ended";
export type RunStatus = "presented" | "active" | "completed" | "interrupted" | "superseded";

export const surfaceOf = (phase: Phase): "moderator" | "participant" =>
  phase === "intro" || phase === "task" || phase === "rating" || phase === "offer" || phase === "handBack" ? "participant" : "moderator";

export interface RunModerator {
  /** Overrides. Left undefined, the suggestion stands. The raw suggestion is never overwritten. */
  tier?: Tier;
  code?: WrongClickCode | null;
  level1?: boolean | null;
  /** Code 7 in the plan: U the menu opened unaided, P it opened after a prompt. */
  menu: "U" | "P" | null;
  observed: string;
  interpretation: string;
  expected: string;
  secondChance: string;
  overrideReason: string;
  /** The coded answers the task asks for (task.codes), by code id: the chosen option. A code left out has not been coded. */
  codes: Record<string, string>;
  /** Where the first doubt moment happened (a zone of the page) and what was said. Empty when there was none. */
  doubtZone: string;
  doubt: string;
  /** True once the moderator has added or changed anything for this run. */
  reviewed: boolean;
}

export interface Run {
  runId: string;
  taskId: string;
  attempt: number;
  retakeOf: string | null;
  status: RunStatus;
  /** The breakpoint this task ran at: it can differ from task to task within one session. */
  breakpoint: Breakpoint;
  /** Place in the session (0 for the first task), so a result can be read against how much of the navigation the person had already seen. */
  position: number;
  /** Scale factor the frame was shown at (1 means true size). Recorded once per task. */
  scale: number;
  presentedAt: number;
  beginAt: number | null;
  endAt: number | null;
  /** Scenario shown to Begin pressed. */
  readingMs: number | null;
  /** Begin pressed to the task ending. */
  durationMs: number | null;
  end: EndReason | null;
  events: CapturedEvent[];
  windowResized: boolean;
  ease: number | null;
  /** The 1 to 7 confidence rating, for tasks that ask one (task.confidence). */
  confidence: number | null;
  participantNotes: string;
  suggestion: Suggestion | null;
  moderator: RunModerator;
}

/** Where an imported session came from, recorded by the tool at import time. A file can never supply it for itself. */
export interface Provenance { file: string; sha256: string; size: number; at: number }

/**
 * A participant code compared as a person would read it: Unicode-normalised, with invisible and direction-control
 * characters removed, and case ignored. P3, p3 and "P3" followed by a zero-width space are the same person.
 */
export const normaliseCode = (id: string): string =>
  id.normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, "").trim().toLowerCase();

/**
 * When a session counts as "newest". A participant's own file says when it was made, which anyone can forge, so for those
 * the time the researcher imported it decides. Sessions run in this tool keep the time they were created.
 */
export const recency = (s: Session): number => (s.selfRun ? (s.imported?.at ?? s.createdAt) : s.createdAt);

export interface Session {
  schemaVersion: 1;
  id: string;
  createdAt: number;
  updatedAt: number;
  participantId: string;
  group: Group;
  practice: boolean;
  /** Set up and run by the participant alone (the participant edition), with no moderator present. */
  selfRun: boolean;
  /** Present on sessions imported from a participant file: which file, its hash, and when it was imported. */
  imported?: Provenance;
  /** The breakpoint for each task in this session, counterbalanced across participants. Fixed with the order when the session starts. */
  plan: Record<string, Breakpoint>;
  /** Breakpoints the moderator chose by hand at setup; they win over the rotation where the task allows them. */
  planOverrides: Record<string, Breakpoint>;
  /** Combined test: the one device for the whole session when the moderator overrides the participant-number rule. */
  deviceOverride?: Breakpoint;
  /** Combined test: how this participant reaches the product page (from the participant number, group and any override). */
  arrival: Arrival;
  arrivalOverride?: Arrival;
  /** The task definitions this session ran against. A later content edit never rescores it. */
  content: Content;
  /** Fixed at creation, so changing the ordering algorithm later cannot alter an existing session. */
  order: string[];
  cursor: number;
  phase: Phase;
  status: "active" | "ended" | "ended-early";
  runs: Run[];
  /** Set by an interrupted resume: the next run presented follows this one. */
  retakeOf: string | null;
  interruptions: number;
  debriefNotes: string;
  /** The participant's answers to the closing questions (the participant edition's debrief). Absent until they have seen that screen; a text answer is a string, a rank answer the items in order. */
  closing?: Record<string, string | string[]>;
}

export const MAX_EVENTS_PER_RUN = 600;

export interface NewSessionParams {
  id: string;
  now: number;
  participantId: string;
  group?: Group;
  practice?: boolean;
  selfRun?: boolean;
  planOverrides?: Record<string, Breakpoint>;
  content: Content;
}

/** The one device a combined-test participant uses: the moderator's choice, else the participant-number rule. Undefined when devices rotate per task. */
export const sessionDevice = (s: Pick<Session, "content" | "participantId" | "deviceOverride">): Breakpoint | undefined =>
  s.deviceOverride ?? deviceFor(s.content, s.participantId);

/** The scenario's first line for the route this participant arrived by (tasks with leadIns), or "". */
export const leadInFor = (task: Task, s: Pick<Session, "arrival">): string => task.leadIns?.[s.arrival] ?? "";

/** Recomputes the order, the per-task breakpoints and the arrival route from the setup fields. */
function arrange(s: Session): void {
  const device = sessionDevice(s);
  s.order = sessionOrder(s.content, s.participantId, undefined, device);
  s.plan = applyOverrides(buildPlan(s.content, s.order, s.participantId, device), s.planOverrides, s.content);
  s.arrival = s.arrivalOverride ?? arrivalFor(s.participantId, s.group);
}

export function createSession(p: NewSessionParams): Session {
  const s: Session = {
    schemaVersion: 1, id: p.id, createdAt: p.now, updatedAt: p.now,
    participantId: p.participantId.trim(), group: p.group ?? "", practice: p.practice ?? false, selfRun: p.selfRun ?? false,
    plan: {}, planOverrides: p.planOverrides ?? {}, arrival: "homepage",
    content: structuredClone(p.content), order: [], cursor: 0, phase: "setup", status: "active", runs: [], retakeOf: null, interruptions: 0, debriefNotes: "",
  };
  arrange(s);
  return s;
}

export type SetupPatch = Partial<Pick<Session, "participantId" | "group" | "practice" | "planOverrides" | "deviceOverride" | "arrivalOverride">>;

export type Action =
  | { type: "setup"; at: number; patch: SetupPatch }
  | { type: "start"; at: number }
  | { type: "acceptReserve"; at: number }
  | { type: "declineReserves"; at: number }
  | { type: "present"; at: number; runId: string }
  /** tourMs: time the onboarding tour was on screen before Begin, left out of the reading time. */
  | { type: "begin"; at: number; scale: number; tourMs?: number }
  | { type: "event"; event: CapturedEvent }
  | { type: "scale"; scale: number }
  | { type: "end"; at: number; reason: EndReason; frameAt?: number }
  | { type: "rate"; at: number; ease: number; notes: string; confidence?: number | null }
  | { type: "unlock"; at: number }
  | { type: "reviewRun"; at: number; runId: string; patch: Partial<RunModerator> }
  | { type: "endEarly"; at: number }
  | { type: "stopSession"; at: number }
  | { type: "closing"; at: number; answers: Record<string, string | string[]> }
  | { type: "complete"; at: number; notes: string }
  | { type: "debrief"; at: number; notes: string }
  | { type: "finish"; at: number }
  | { type: "resume"; at: number };

export class IllegalTransition extends Error {}

const fail = (s: Session, a: Action): never => { throw new IllegalTransition(`${a.type} is not allowed in phase ${s.phase}`); };
const need = (s: Session, a: Action, ...phases: Phase[]) => { if (!phases.includes(s.phase)) fail(s, a); };

/** Reserve tasks the participant has not been given yet, in content order, and that run on this participant's device. */
export const reserveTasksLeft = (s: Session) => s.content.tasks.filter((t) => t.reserve && !s.order.includes(t.id) && runsOn(t, sessionDevice(s)));

export const currentRun = (s: Session): Run | undefined => s.runs[s.runs.length - 1];
export const currentTaskId = (s: Session): string | undefined => s.order[s.cursor];

const IN_FLIGHT: RunStatus[] = ["presented", "active"];

export function emptyModerator(): RunModerator {
  return { menu: null, observed: "", interpretation: "", expected: "", secondChance: "", overrideReason: "", codes: {}, doubtZone: "", doubt: "", reviewed: false };
}

/**
 * The only way a session changes. Pure: it returns a new session and throws IllegalTransition for a move the current
 * phase does not allow. The caller supplies the time and any ids, so tests are exact.
 */
export function reduce(session: Session, a: Action): Session {
  const s = structuredClone(session);
  if ("at" in a) s.updatedAt = a.at;
  switch (a.type) {
    case "setup": {
      need(s, a, "setup");
      Object.assign(s, a.patch);
      s.participantId = s.participantId.trim();
      arrange(s);
      return s;
    }
    case "start": {
      need(s, a, "setup");
      if (s.participantId === "" || s.order.length === 0) fail(s, a);
      s.phase = "intro";
      return s;
    }
    case "acceptReserve": {
      // The participant takes the next reserve task. It is offered again after each one, so they can stop whenever they like.
      need(s, a, "offer");
      const next = reserveTasksLeft(s)[0];
      if (!next) return fail(s, a);
      s.order.push(next.id);
      // Reserves sit last in the content, so the breakpoints already planned for the core tasks do not move.
      s.plan = applyOverrides(buildPlan(s.content, s.order, s.participantId, sessionDevice(s)), s.planOverrides, s.content);
      s.phase = "intro";
      return s;
    }
    case "declineReserves": {
      need(s, a, "offer");
      s.phase = "handBack";
      return s;
    }
    case "present": {
      need(s, a, "intro");
      const taskId = currentTaskId(s);
      if (taskId === undefined) return fail(s, a);
      const attempt = s.runs.filter((r) => r.taskId === taskId).length + 1;
      s.runs.push({
        runId: a.runId, taskId, attempt, retakeOf: s.retakeOf, status: "presented", breakpoint: s.plan[taskId] ?? "desktop", position: s.cursor, scale: 1,
        presentedAt: a.at, beginAt: null, endAt: null, readingMs: null, durationMs: null, end: null, events: [], windowResized: false,
        ease: null, confidence: null, participantNotes: "", suggestion: null, moderator: emptyModerator(),
      });
      s.retakeOf = null;
      s.phase = "task";
      return s;
    }
    case "begin": {
      need(s, a, "task");
      const run = currentRun(s)!;
      if (run.status !== "presented") fail(s, a);
      run.status = "active"; run.beginAt = a.at; run.scale = a.scale; run.readingMs = Math.max(0, a.at - run.presentedAt - Math.max(0, a.tourMs ?? 0));
      return s;
    }
    case "event": {
      need(s, a, "task");
      const run = currentRun(s)!;
      if (run.status !== "active") fail(s, a);
      // Past the cap, only the events that decide the outcome are kept (a click that ends the task, a search), so menu
      // churn can never push the deciding click out of the record.
      const decisive = (a.event.type === "click" && a.event.ends) || a.event.type === "search-submit";
      if (run.events.length < MAX_EVENTS_PER_RUN || (decisive && run.events.length < MAX_EVENTS_PER_RUN + 20)) run.events.push(a.event);
      return s;
    }
    case "scale": {
      // The frame reports its fit once it is on screen, which is after Begin. A later change means the window was resized.
      need(s, a, "task");
      const run = currentRun(s)!;
      if (run.status !== "active" || !(a.scale > 0 && a.scale <= 1)) fail(s, a);
      // A change after the frame was on screen (it has reported ready) means the window was resized during the task.
      if (run.events.some((e) => e.type === "ready") && run.scale !== a.scale) run.windowResized = true;
      run.scale = a.scale;
      return s;
    }
    case "end": {
      need(s, a, "task");
      const run = currentRun(s)!;
      if (run.status !== "active" || run.beginAt === null) fail(s, a);
      const task = s.content.tasks.find((t) => t.id === run.taskId);
      if (!task) return fail(s, a);
      run.end = a.reason; run.endAt = a.at; run.durationMs = a.at - run.beginAt!;
      run.suggestion = suggest(task, run.events, a.reason, a.frameAt);
      s.phase = "rating";
      return s;
    }
    case "rate": {
      // The task is complete and counted from here: no moderator step sits between it and the next scenario.
      need(s, a, "rating");
      if (!Number.isInteger(a.ease) || a.ease < 1 || a.ease > 7) fail(s, a);
      const run = currentRun(s)!;
      const asked = (s.content.tasks.find((t) => t.id === run.taskId)?.confidence ?? "") !== "";
      // A confidence rating is required when the task asks one, and ignored when it does not.
      if (asked && !(Number.isInteger(a.confidence) && a.confidence! >= 1 && a.confidence! <= 7)) fail(s, a);
      run.confidence = asked ? a.confidence! : null;
      run.ease = a.ease; run.participantNotes = a.notes.trim().slice(0, 2000); run.status = "completed";
      s.cursor += 1;
      // Once the core tasks are done, the participant is offered the reserves (and offered the next one after each).
      s.phase = s.cursor < s.order.length ? "intro" : reserveTasksLeft(s).length > 0 ? "offer" : "handBack";
      return s;
    }
    case "unlock": {
      // The one hand-back: all the tasks are done, so the device goes back to the researcher.
      need(s, a, "handBack");
      s.phase = "debrief";
      return s;
    }
    case "reviewRun": {
      // Findings are added at any time after the task, to any completed run, in any session.
      const run = s.runs.find((r) => r.runId === a.runId);
      if (!run || run.status !== "completed") fail(s, a);
      Object.assign(run!.moderator, a.patch);
      run!.moderator.reviewed = true;
      return s;
    }
    case "stopSession": {
      // The participant chooses to stop between tasks (after confirming). Everything rated so far is kept; the device goes
      // back to the researcher through the usual hand-back screen.
      need(s, a, "intro");
      s.status = "ended-early";
      s.phase = "handBack";
      return s;
    }
    case "closing": {
      // The participant edition's debrief: typed answers to the closing questions, after the last task and before the results page.
      need(s, a, "handBack");
      s.closing = cleanClosing(closingQuestionsFor(s), a.answers);
      return s;
    }
    case "complete": {
      // The participant edition has no moderator debrief: from the hand-back screen the participant adds an optional note
      // and the session is closed in one step, ready to export. A session already stopped early stays marked as such.
      need(s, a, "handBack", "debrief");
      s.debriefNotes = a.notes.slice(0, 4000);
      s.phase = "ended";
      if (s.status === "active") s.status = "ended";
      return s;
    }
    case "endEarly": {
      if (s.phase === "setup" || s.phase === "debrief" || s.phase === "ended") fail(s, a);
      // After the last task there is nothing left to end: go to the debrief without marking the session early.
      if (s.phase === "handBack" || s.phase === "offer") { s.phase = "debrief"; return s; }
      const run = currentRun(s);
      if (run && IN_FLIGHT.includes(run.status)) run.status = "interrupted";
      s.status = "ended-early";
      s.phase = "debrief";
      return s;
    }
    case "debrief": {
      need(s, a, "debrief");
      s.debriefNotes = a.notes.slice(0, 4000);
      return s;
    }
    case "finish": {
      need(s, a, "debrief");
      s.phase = "ended";
      if (s.status === "active") s.status = "ended";
      return s;
    }
    case "resume": {
      // A reload during a task cannot resume honestly (timers are gone): the run is marked interrupted and the task is re-presented.
      if (s.phase !== "task") return s;
      const run = currentRun(s)!;
      run.status = "interrupted";
      s.retakeOf = run.runId;
      s.interruptions += 1;
      s.phase = "intro";
      return s;
    }
  }
}

export interface Effective {
  tier: Tier | null;
  code: WrongClickCode | null;
  level1: boolean | null;
  level2: boolean | null;
  menu: "U" | "P" | null;
}

/** What the Ledger counts: the moderator's override where there is one, otherwise the suggestion. */
export function effective(run: Run): Effective {
  const sug = run.suggestion;
  const tier = run.moderator.tier ?? sug?.tier ?? null;
  // A code follows the tier the moderator chose, so changing P to X never leaves a stale code (or X to P a leftover one).
  const tierChanged = run.moderator.tier !== undefined && run.moderator.tier !== sug?.tier;
  const followedCode: WrongClickCode | null = !tierChanged ? (sug?.code ?? null) : tier === "R" ? 4 : tier === "X" ? (sug?.code ?? null) : null;
  return {
    tier,
    code: run.moderator.code !== undefined ? run.moderator.code : followedCode,
    level1: run.moderator.level1 !== undefined ? run.moderator.level1 : (sug?.level1 ?? null),
    level2: tier === "P" || tier === "A" ? true : tier === "X" ? false : null,
    menu: run.moderator.menu,
  };
}

/** The latest completed attempt per task: retakes and interrupted attempts never double count. */
export function countedRuns(s: Session): Run[] {
  const latest = new Map<string, Run>();
  for (const r of s.runs) if (r.status === "completed") latest.set(r.taskId, r);
  return [...latest.values()];
}

export const taskProgress = (s: Session): { done: number; total: number } => ({ done: countedRuns(s).length, total: s.order.length });

/** How many of this session's tasks run at each breakpoint, for the sessions list and the debrief. */
export function planCounts(s: Session): Record<Breakpoint, number> {
  const out: Record<Breakpoint, number> = { desktop: 0, tablet: 0, mobile: 0 };
  for (const id of s.order) { const bp = s.plan[id]; if (bp) out[bp] += 1; }
  return out;
}


/** The closing questions this participant is asked: none after stopping early, and not the ones whose task they already completed. */
export function closingQuestionsFor(s: Pick<Session, "content" | "runs" | "status">): ClosingQuestion[] {
  if (s.status === "ended-early") return [];
  const done = new Set(s.runs.filter((r) => r.status === "completed").map((r) => r.taskId));
  return (s.content.closingQuestions ?? []).filter((q) => q.unlessRun === undefined || !done.has(q.unlessRun));
}

/**
 * A choice answer is the option, or the option and what the participant added, "Other: in their words". Only the options the question
 * offers count, and only Other and the options with a box (follow) can carry words. A text that is no option at all (from a version
 * that asked it as a typed question) is kept as Other when the question has one.
 */
function cleanChoice(q: ClosingQuestion, v: string): string | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  const offered = [...(q.options ?? []), ...(q.other ? [OTHER_OPTION] : [])];
  for (const opt of offered) {
    if (t === opt) return opt;
    if (t.startsWith(opt + ":") && (opt === OTHER_OPTION || q.follow?.[opt] !== undefined)) {
      const words = t.slice(opt.length + 1).trim().slice(0, 1500);
      return words === "" ? opt : `${opt}: ${words}`;
    }
  }
  return q.other ? `${OTHER_OPTION}: ${t.slice(0, 1500)}` : undefined;
}

/** Keeps only answers to the questions asked: text trimmed and capped, a choice only if it is one of the options, a ranking only if it puts every item in order exactly once. Blank answers are dropped. */
export function cleanClosing(asked: ClosingQuestion[], answers: unknown): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  if (typeof answers !== "object" || answers === null) return out;
  const given = answers as Record<string, unknown>;
  for (const q of asked) {
    const v = given[q.id];
    if (q.kind === "text" && typeof v === "string") {
      const t = v.trim().slice(0, 1500);
      if (t !== "") out[q.id] = t;
    } else if (q.kind === "choice" && typeof v === "string") {
      const c = cleanChoice(q, v);
      if (c !== undefined) out[q.id] = c;
    } else if (q.kind === "rank" && Array.isArray(v) && q.items && v.length === q.items.length && v.every((x) => typeof x === "string") && new Set(v).size === v.length && q.items.every((i) => v.includes(i))) {
      out[q.id] = v as string[];
    }
  }
  return out;
}
