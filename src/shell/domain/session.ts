import type { Breakpoint, CapturedEvent } from "../../shared/protocol.ts";
import type { Content } from "./tasks.ts";
import { applyOverrides, buildPlan, sessionOrder } from "./order.ts";
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
  participantNotes: string;
  suggestion: Suggestion | null;
  moderator: RunModerator;
}

export interface Session {
  schemaVersion: 1;
  id: string;
  createdAt: number;
  updatedAt: number;
  participantId: string;
  group: Group;
  practice: boolean;
  /** The breakpoint for each task in this session, counterbalanced across participants. Fixed with the order when the session starts. */
  plan: Record<string, Breakpoint>;
  /** Breakpoints the moderator chose by hand at setup; they win over the rotation where the task allows them. */
  planOverrides: Record<string, Breakpoint>;
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
}

export const MAX_EVENTS_PER_RUN = 600;

export interface NewSessionParams {
  id: string;
  now: number;
  participantId: string;
  group?: Group;
  practice?: boolean;
  planOverrides?: Record<string, Breakpoint>;
  content: Content;
}

/** Recomputes the order and the per-task breakpoints from the setup fields. */
function arrange(s: Session): void {
  s.order = sessionOrder(s.content, s.participantId);
  s.plan = applyOverrides(buildPlan(s.content, s.order, s.participantId), s.planOverrides, s.content);
}

export function createSession(p: NewSessionParams): Session {
  const s: Session = {
    schemaVersion: 1, id: p.id, createdAt: p.now, updatedAt: p.now,
    participantId: p.participantId.trim(), group: p.group ?? "", practice: p.practice ?? false,
    plan: {}, planOverrides: p.planOverrides ?? {},
    content: structuredClone(p.content), order: [], cursor: 0, phase: "setup", status: "active", runs: [], retakeOf: null, interruptions: 0, debriefNotes: "",
  };
  arrange(s);
  return s;
}

export type SetupPatch = Partial<Pick<Session, "participantId" | "group" | "practice" | "planOverrides">>;

export type Action =
  | { type: "setup"; at: number; patch: SetupPatch }
  | { type: "start"; at: number }
  | { type: "acceptReserve"; at: number }
  | { type: "declineReserves"; at: number }
  | { type: "present"; at: number; runId: string }
  | { type: "begin"; at: number; scale: number }
  | { type: "event"; event: CapturedEvent }
  | { type: "scale"; scale: number }
  | { type: "end"; at: number; reason: EndReason; frameAt?: number }
  | { type: "rate"; at: number; ease: number; notes: string }
  | { type: "unlock"; at: number }
  | { type: "reviewRun"; at: number; runId: string; patch: Partial<RunModerator> }
  | { type: "endEarly"; at: number }
  | { type: "stopSession"; at: number }
  | { type: "debrief"; at: number; notes: string }
  | { type: "finish"; at: number }
  | { type: "resume"; at: number };

export class IllegalTransition extends Error {}

const fail = (s: Session, a: Action): never => { throw new IllegalTransition(`${a.type} is not allowed in phase ${s.phase}`); };
const need = (s: Session, a: Action, ...phases: Phase[]) => { if (!phases.includes(s.phase)) fail(s, a); };

/** Reserve tasks that have not been added to this session yet. */
/** Reserve tasks the participant has not been given yet, in content order. */
export const reserveTasksLeft = (s: Session) => s.content.tasks.filter((t) => t.reserve && !s.order.includes(t.id));

export const currentRun = (s: Session): Run | undefined => s.runs[s.runs.length - 1];
export const currentTaskId = (s: Session): string | undefined => s.order[s.cursor];

const IN_FLIGHT: RunStatus[] = ["presented", "active"];

function emptyModerator(): RunModerator {
  return { menu: null, observed: "", interpretation: "", expected: "", secondChance: "", overrideReason: "", reviewed: false };
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
      s.plan = applyOverrides(buildPlan(s.content, s.order, s.participantId), s.planOverrides, s.content);
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
        ease: null, participantNotes: "", suggestion: null, moderator: emptyModerator(),
      });
      s.retakeOf = null;
      s.phase = "task";
      return s;
    }
    case "begin": {
      need(s, a, "task");
      const run = currentRun(s)!;
      if (run.status !== "presented") fail(s, a);
      run.status = "active"; run.beginAt = a.at; run.scale = a.scale; run.readingMs = a.at - run.presentedAt;
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
