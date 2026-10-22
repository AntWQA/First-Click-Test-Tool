import { ARRIVALS } from "./tasks.ts";
import type { Arrival, Content, Task } from "./tasks.ts";
import type { Breakpoint } from "../../shared/protocol.ts";
import { lookupHeader } from "../../shared/navIndex.ts";

/**
 * Seeded task orders. The algorithm and its call order match the one that produced the roster on the FigJam
 * facilitation board, so the tool and the board agree (a test compares them with a golden file read from the board).
 */
export const ORDER_SEED = 13102026;

/** mulberry32: a small seeded generator. Do not change: the orders in existing sessions and on the board depend on it. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Pairs of tasks that must not sit next to each other because they probe each other's wording. T1 and T2 (goal and symptom wording) are the original pair. */
export type ApartPairs = ReadonlyArray<readonly [string, string]>;
const LEGACY_PAIRS: ApartPairs = [["T1", "T2"]];

const adjacent = (order: string[], pairs: ApartPairs): boolean =>
  pairs.some(([x, y]) => { const a = order.indexOf(x), b = order.indexOf(y); return a >= 0 && b >= 0 && Math.abs(a - b) === 1; });

/**
 * Reshuffles until T1 and T2 are apart. Guarded: after 1000 tries it places T2 at the end furthest from T1, which always
 * separates them when the list has three or more tasks. With fewer they cannot be separated and the shuffle is returned as is.
 */
export function shuffleApart(items: string[], rand: () => number, notFirst: ReadonlySet<string> = new Set(), pairs: ApartPairs = LEGACY_PAIRS): string[] {
  const firstOk = (o: string[]) => !notFirst.has(o[0]!) || o.every((x) => notFirst.has(x));
  for (let tries = 0; tries < 1000; tries++) {
    const o = shuffle(items, rand);
    if ((!adjacent(o, pairs) || o.length < 3) && firstOk(o)) return o;
  }
  // Fallback for the first pair: put its second task at whichever end is furthest from the first.
  const [first, second] = pairs[0] ?? LEGACY_PAIRS[0]!;
  const rest = shuffle(items, rand).filter((x) => x !== second);
  rest.splice(rest.indexOf(first) < rest.length / 2 ? rest.length : 0, 0, second);
  if (!firstOk(rest)) { const i = rest.findIndex((x) => !notFirst.has(x)); [rest[0], rest[i]] = [rest[i]!, rest[0]!]; }
  return rest;
}

const DESKTOP_BASE = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10"];
const MOBILE_BASE = ["T1", "T3", "T5", "T7", "T9", "T10"];

/** The roster: P1 to P10 take the ten desktop tasks, M1 to M8 the six mobile tasks, from one stream in that order. */
export function rosterOrders(seed: number = ORDER_SEED): Record<string, string[]> {
  const rand = mulberry32(seed);
  const out: Record<string, string[]> = {};
  for (let i = 1; i <= 10; i++) out["P" + i] = shuffleApart(DESKTOP_BASE, rand);
  for (let i = 1; i <= 8; i++) out["M" + i] = shuffle(MOBILE_BASE, rand);
  return out;
}

const hashId = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
};

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Order for one participant over a list of task ids. Roster participants whose task list matches the roster get the
 * roster order; anyone else (extra participants, edited content) gets a repeatable order seeded
 * from their id.
 */
export function orderFor(participantId: string, taskIds: string[], seed: number = ORDER_SEED, notFirst: ReadonlySet<string> = new Set()): string[] {
  const roster = rosterOrders(seed)[participantId];
  if (roster && (sameSet(roster, taskIds))) return roster.slice();
  const rand = mulberry32((seed ^ hashId(participantId)) >>> 0);
  // A roster participant keeps the board's order for the tasks the board knew about; tasks added since are placed among
  // them at repeatable positions, never first when they must not be.
  if (roster && roster.every((id) => taskIds.includes(id))) {
    const out = roster.slice();
    for (const id of taskIds.filter((t) => !roster.includes(t))) out.splice(1 + Math.floor(rand() * out.length), 0, id);
    return out;
  }
  return shuffleApart(taskIds, rand, notFirst);
}

/**
 * True when none of the task's answers is in the header navigation: it can only be done from the footer. The first task
 * of a session is where H6 (does the menu open unaided) is read, so it must be a header task.
 */
export const isFooterTask = (task: Task): boolean => task.kind === "nav" && [...task.primary, ...task.acceptable, ...task.separate].every((t) => !t.href || !lookupHeader(t.href));

/** True when the task can run on this device. With no device (a navigation-only session) every task can. */
export const runsOn = (task: Task, device: Breakpoint | undefined): boolean => device === undefined || task.breakpoints.includes(device);

/**
 * The tasks a session starts with. A navigation-only content has every core task shuffled for this participant. The
 * combined test keeps the homepage and product page tasks in content order (the first view has to be the first thing seen
 * of the site) and shuffles only the navigation tasks, keeping any pair marked apartFrom apart. Tasks that do not list the
 * participant's device are left out. Reserves are offered at the end of the session, not here.
 */
export function sessionOrder(content: Content, participantId: string, seed: number = ORDER_SEED, device?: Breakpoint): string[] {
  const core = content.tasks.filter((t) => !t.reserve && runsOn(t, device));
  if (core.some((t) => t.kind !== "nav")) {
    const fixed = core.filter((t) => t.block !== "navigation").map((t) => t.id);
    const nav = core.filter((t) => t.block === "navigation").map((t) => t.id);
    const pairs: [string, string][] = core.filter((t) => t.apartFrom !== "" && nav.includes(t.id) && nav.includes(t.apartFrom)).map((t) => [t.id, t.apartFrom]);
    const rand = mulberry32((seed ^ hashId(participantId)) >>> 0);
    return [...fixed, ...(pairs.length > 0 ? shuffleApart(nav, rand, new Set(), pairs) : shuffle(nav, rand))];
  }
  const footerOnly = new Set(core.filter(isFooterTask).map((t) => t.id));
  return orderFor(participantId, core.map((t) => t.id), seed, footerOnly);
}

/** The one device a participant uses for the whole combined session: odd numbers desktop, even numbers mobile, so six and six across twelve. Undefined for a content that rotates devices per task. */
export function deviceFor(content: Content, participantId: string): Breakpoint | undefined {
  if (!content.devicePerParticipant) return undefined;
  return participantIndex(participantId) % 2 === 1 ? "desktop" : "mobile";
}

/**
 * How the participant reaches the product page. The number sets it (1 homepage, 2 Google result, 3 shared link, then round
 * again), which with the odd and even device rule gives every route two participants on each device across twelve. An existing
 * customer (WA or WC) cannot arrive cold, so a Google arrival becomes a shared link for them.
 */
export function arrivalFor(participantId: string, group: string): Arrival {
  const i = (((participantIndex(participantId) - 1) % 3) + 3) % 3;
  const route = ARRIVALS[i]!;
  return route === "google" && (group === "WA" || group === "WC") ? "shared" : route;
}

/** P7 gives 7; an ID with no number gives a repeatable number from its characters. */
export function participantIndex(id: string): number {
  const m = /(\d+)\s*$/.exec(id);
  return m ? parseInt(m[1]!, 10) : hashId(id) % 1000;
}

/**
 * The breakpoint each task runs at for one participant, so a person does their tasks at different breakpoints and never
 * sees the same task twice. A task that lists one breakpoint always runs there. A task that lists several is rotated
 * across exactly those breakpoints (desktop, mobile, tablet) by the participant's number plus the task's place among such
 * tasks: across participants each task is seen about equally at each breakpoint it lists, and each participant gets an even mix.
 * Which breakpoints a task needs is decided in the task content, not at setup.
 * Content order, not session order, sets the slot, so a task sits at the same rotation position for every participant.
 */
export function buildPlan(content: Content, order: string[], participantId: string, device?: Breakpoint): Record<string, Breakpoint> {
  if (device) {
    // One device for the whole session: every task runs on it, or on its first listed breakpoint if it does not list it.
    const fixed: Record<string, Breakpoint> = {};
    for (const task of content.tasks) if (order.includes(task.id)) fixed[task.id] = task.breakpoints.includes(device) ? device : (task.breakpoints[0] ?? "desktop");
    return fixed;
  }
  const rotation: Breakpoint[] = ["desktop", "mobile", "tablet"];
  const index = participantIndex(participantId);
  const plan: Record<string, Breakpoint> = {};
  let slot = 0;
  for (const task of content.tasks) {
    if (!order.includes(task.id)) continue;
    const options = rotation.filter((b) => task.breakpoints.includes(b));
    if (options.length === 0) { plan[task.id] = task.breakpoints[0] ?? "desktop"; continue; }
    if (options.length === 1) { plan[task.id] = options[0]!; continue; }
    plan[task.id] = options[(index + slot) % options.length]!;
    slot += 1;
  }
  return plan;
}

/** The moderator's choices win, but only where the task lists that breakpoint: an override can never put a task somewhere it cannot run. */
export function applyOverrides(plan: Record<string, Breakpoint>, overrides: Record<string, Breakpoint>, content: Content): Record<string, Breakpoint> {
  const out = { ...plan };
  for (const [taskId, bp] of Object.entries(overrides)) {
    const task = content.tasks.find((t) => t.id === taskId);
    if (task && taskId in out && task.breakpoints.includes(bp)) out[taskId] = bp;
  }
  return out;
}

export { DESKTOP_BASE, MOBILE_BASE };
