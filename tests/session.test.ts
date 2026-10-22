import { test } from "node:test";
import assert from "node:assert/strict";
import { NAVIGATION_CONTENT } from "../src/shell/domain/tasks.ts";
import { countedRuns, createSession, currentRun, currentTaskId, effective, IllegalTransition, MAX_EVENTS_PER_RUN, planCounts, reduce, reserveTasksLeft, surfaceOf, taskProgress } from "../src/shell/domain/session.ts";
import type { Action, RunModerator, Session } from "../src/shell/domain/session.ts";
import { leaf, open, ready } from "./helpers.ts";

const T0 = 1_700_000_000_000;
let n = 0;
const fresh = (over: Partial<Parameters<typeof createSession>[0]> = {}): Session =>
  createSession({ id: "s1", now: T0, participantId: "P1", content: NAVIGATION_CONTENT, ...over });
const apply = (s: Session, ...actions: Action[]) => actions.reduce(reduce, s);
const present = (s: Session, at: number) => reduce(s, { type: "present", at, runId: "r" + ++n });
const winning = [ready(0), open("shop", 200), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 1500)];

/** Runs the next task of a session from the intro to rated (and so complete), using the recorded events given. */
function doTask(s: Session, events = winning, ease = 6): Session {
  let x = present(s, T0 + 10);
  x = reduce(x, { type: "begin", at: T0 + 2000, scale: 1 });
  for (const event of events) x = reduce(x, { type: "event", event });
  x = reduce(x, { type: "end", at: T0 + 9000, reason: "destination" });
  return reduce(x, { type: "rate", at: T0 + 10000, ease, notes: " fine " });
}

/** The moderator's findings on the last run, added after the fact. */
const review = (s: Session, patch: Partial<RunModerator>): Session =>
  reduce(s, { type: "reviewRun", at: T0, runId: currentRun(s)!.runId, patch });

test("setup recomputes the order and the breakpoint plan when the participant or options change", () => {
  const s = fresh();
  assert.equal(s.order.length, 12);
  const p2 = apply(s, { type: "setup", at: T0, patch: { participantId: "P2" } });
  assert.notDeepEqual(p2.plan, s.plan, "a different participant number rotates the breakpoints");
});

test("a moderator's breakpoint choice is kept through later setup changes, where the task allows it", () => {
  const s = fresh();
  const other = s.plan.T1 === "mobile" ? "desktop" : "mobile";
  let x = apply(s, { type: "setup", at: T0, patch: { planOverrides: { T1: other, T2: "mobile" } } });
  assert.equal(x.plan.T1, other);
  assert.equal(x.plan.T2, "desktop", "an override the task cannot honour is ignored");
  x = apply(x, { type: "setup", at: T0, patch: { group: "WA" } });
  assert.equal(x.plan.T1, other);
});

test("each run takes its breakpoint from the plan and records its place in the session, so tasks in one session can differ", () => {
  let s = reduce({ ...fresh(), order: ["T2", "T1", "T3"], plan: { T2: "desktop", T1: "mobile", T3: "desktop" } }, { type: "start", at: T0 });
  const seen: string[] = [];
  for (let i = 0; i < 3; i++) {
    s = present(s, T0 + i);
    seen.push(`${currentRun(s)!.taskId}:${currentRun(s)!.breakpoint}:${currentRun(s)!.position}`);
    s = reduce(s, { type: "begin", at: T0, scale: 1 });
    s = reduce(s, { type: "end", at: T0 + 10, reason: "gave-up" });
    s = reduce(s, { type: "rate", at: T0, ease: 4, notes: "" });
  }
  assert.deepEqual(seen, ["T2:desktop:0", "T1:mobile:1", "T3:desktop:2"]);
  assert.equal(planCounts(s).mobile, 1);
  assert.equal(planCounts(s).desktop, 2);
});

test("start needs a participant id and at least one task", () => {
  assert.throws(() => reduce(fresh({ participantId: "  " }), { type: "start", at: T0 }), IllegalTransition);
  assert.equal(reduce(fresh(), { type: "start", at: T0 }).phase, "intro");
});

test("a whole session runs task to task with no moderator step, then one hand-back at the very end", () => {
  let s = reduce(fresh({ id: "s2" }), { type: "start", at: T0 });
  assert.equal(surfaceOf(s.phase), "participant");
  for (let i = 0; i < s.order.length; i++) {
    s = doTask(s);
    assert.equal(currentRun(s)!.participantNotes, "fine");
    assert.equal(currentRun(s)!.status, "completed", "a rated task is complete and counted straight away");
    assert.equal(s.phase, i === 11 ? "offer" : "intro", `after task ${i + 1}`);
    assert.equal(surfaceOf(s.phase), "participant", "the participant never leaves their screens until the last task");
  }
  assert.deepEqual(taskProgress(s), { done: 12, total: 12 });
  s = reduce(s, { type: "declineReserves", at: T0 });
  assert.equal(s.phase, "handBack");
  s = reduce(s, { type: "unlock", at: T0 });
  assert.equal(s.phase, "debrief");
  assert.equal(surfaceOf(s.phase), "moderator");
  s = apply(s, { type: "debrief", at: T0, notes: "good session" }, { type: "finish", at: T0 });
  assert.equal(s.phase, "ended");
  assert.equal(s.status, "ended");
});

test("reserve tasks are offered to the participant after the core tasks, one at a time, and they can stop whenever they like", () => {
  let s = reduce(fresh({ id: "s3" }), { type: "start", at: T0 });
  assert.throws(() => reduce(s, { type: "acceptReserve", at: T0 }), IllegalTransition, "not before the core tasks are done");
  assert.deepEqual(s.order.filter((id) => id.startsWith("R")), []);
  for (let i = 0; i < 12; i++) s = doTask(s);
  assert.equal(s.phase, "offer");
  assert.equal(surfaceOf(s.phase), "participant", "the participant is asked, not the moderator");
  assert.throws(() => reduce(s, { type: "unlock", at: T0 }), IllegalTransition, "an offer is not a hand-back");
  const before = { ...s.plan };
  s = reduce(s, { type: "acceptReserve", at: T0 });
  assert.equal(s.phase, "intro");
  assert.equal(currentTaskId(s), "R1", "reserves come in content order");
  assert.equal(s.plan.R1, "desktop");
  for (const [id, bp] of Object.entries(before)) assert.equal(s.plan[id], bp, `${id} keeps its breakpoint`);
  s = doTask(s);
  assert.equal(s.phase, "offer", "offered again after each reserve");
  assert.deepEqual(reserveTasksLeft(s).map((t) => t.id), ["R2"]);
  s = reduce(s, { type: "declineReserves", at: T0 });
  assert.equal(s.phase, "handBack");
  assert.deepEqual(s.order.filter((id) => id.startsWith("R")), ["R1"], "R2 was declined, so it never ran");
  assert.deepEqual(taskProgress(s), { done: 13, total: 13 });
  assert.throws(() => reduce(s, { type: "acceptReserve", at: T0 }), IllegalTransition, "no second chance once declined");
});

test("after the last reserve there is nothing left to offer, so the participant goes straight to the hand-back", () => {
  let s = reduce(fresh({ id: "s5" }), { type: "start", at: T0 });
  for (let i = 0; i < 12; i++) s = doTask(s);
  s = reduce(s, { type: "acceptReserve", at: T0 }); s = doTask(s);
  s = reduce(s, { type: "acceptReserve", at: T0 }); s = doTask(s);
  assert.deepEqual(s.order.slice(-2), ["R1", "R2"]);
  assert.equal(s.phase, "handBack");
});

test("ending early from the offer goes to the debrief without calling the session early, and offers nothing more", () => {
  let s = reduce(fresh({ id: "s4" }), { type: "start", at: T0 });
  for (let i = 0; i < 12; i++) s = doTask(s);
  s = reduce(s, { type: "endEarly", at: T0 });
  assert.equal(s.phase, "debrief");
  assert.equal(s.status, "active");
  assert.throws(() => reduce(s, { type: "acceptReserve", at: T0 }), IllegalTransition);
});

test("a participant can end the session from the between-tasks screen: rated work is kept, and the device goes back via the hand-back screen", () => {
  let s = reduce(fresh({ id: "st" }), { type: "start", at: T0 });
  assert.throws(() => reduce(fresh({ id: "sx" }), { type: "stopSession", at: T0 }), IllegalTransition, "not during setup");
  s = doTask(s); s = doTask(s);
  assert.equal(s.phase, "intro");
  const stopped = reduce(s, { type: "stopSession", at: T0 + 1 });
  assert.equal(stopped.phase, "handBack");
  assert.equal(surfaceOf(stopped.phase), "participant");
  assert.equal(stopped.status, "ended-early");
  assert.equal(countedRuns(stopped).length, 2, "both rated tasks still count");
  const debrief = reduce(stopped, { type: "unlock", at: T0 + 2 });
  assert.equal(debrief.phase, "debrief");
  assert.equal(debrief.status, "ended-early");
  assert.throws(() => reduce(debrief, { type: "acceptReserve", at: T0 }), IllegalTransition, "no reserves after stopping");
  const mid = present(s, T0 + 5);
  assert.throws(() => reduce(mid, { type: "stopSession", at: T0 }), IllegalTransition, "only between tasks, never in the middle of one");
});

test("time the onboarding tour was on screen is left out of the reading time, and never makes it negative", () => {
  const started = present(reduce(fresh(), { type: "start", at: T0 }), T0);
  assert.equal(currentRun(reduce(started, { type: "begin", at: T0 + 20000, scale: 1 }))!.readingMs, 20000, "no tour: the whole wait counts");
  assert.equal(currentRun(reduce(started, { type: "begin", at: T0 + 20000, scale: 1, tourMs: 12000 }))!.readingMs, 8000);
  assert.equal(currentRun(reduce(started, { type: "begin", at: T0 + 5000, scale: 1, tourMs: 99000 }))!.readingMs, 0);
});

test("a self-run session is closed in one step from the hand-back screen, keeping the participant's note and any early end", () => {
  let s = reduce(fresh({ id: "sr", selfRun: true }), { type: "start", at: T0 });
  assert.equal(s.selfRun, true);
  assert.throws(() => reduce(s, { type: "complete", at: T0, notes: "x" }), IllegalTransition, "not before the scenarios are done");
  s = doTask(s);
  const early = reduce(reduce(s, { type: "stopSession", at: T0 }), { type: "complete", at: T0 + 5, notes: "  the menu was confusing  " });
  assert.equal(early.phase, "ended");
  assert.equal(early.status, "ended-early", "ending early stays marked as early");
  assert.equal(early.debriefNotes, "  the menu was confusing  ");
  assert.equal(countedRuns(early).length, 1);
  assert.throws(() => reduce(early, { type: "complete", at: T0, notes: "again" }), IllegalTransition, "closed once");
  let all = reduce({ ...fresh({ id: "sa", content: noReserves(), selfRun: true }), order: ["T1"] }, { type: "start", at: T0 });
  all = doTask(all);
  assert.equal(all.phase, "handBack");
  const finished = reduce(all, { type: "complete", at: T0, notes: "" });
  assert.equal(finished.status, "ended", "finishing every scenario is a normal end");
  assert.equal(reduce(fresh(), { type: "start", at: T0 }).selfRun, false, "the moderator's sessions are not self-run");
});

test("illegal moves throw and leave the session untouched", () => {
  const s = fresh();
  assert.throws(() => reduce(s, { type: "present", at: T0, runId: "x" }), IllegalTransition);
  const started = reduce(s, { type: "start", at: T0 });
  assert.throws(() => reduce(started, { type: "rate", at: T0, ease: 5, notes: "" }), IllegalTransition);
  assert.throws(() => reduce(started, { type: "unlock", at: T0 }), IllegalTransition);
  const task = present(started, T0);
  assert.throws(() => reduce(task, { type: "end", at: T0, reason: "gave-up" }), IllegalTransition, "cannot end before Begin");
  const begun = reduce(task, { type: "begin", at: T0 + 1, scale: 0.9 });
  assert.throws(() => reduce(begun, { type: "begin", at: T0 + 2, scale: 1 }), IllegalTransition, "Begin twice");
  assert.equal(currentRun(begun)!.scale, 0.9);
  assert.equal(currentRun(begun)!.readingMs, 1);
});

test("ease must be a whole number from 1 to 7", () => {
  let s = reduce(fresh(), { type: "start", at: T0 });
  s = present(s, T0);
  s = reduce(s, { type: "begin", at: T0, scale: 1 });
  s = reduce(s, { type: "end", at: T0 + 5, reason: "gave-up" });
  for (const bad of [0, 8, 3.5, Number.NaN]) assert.throws(() => reduce(s, { type: "rate", at: T0, ease: bad, notes: "" }), IllegalTransition);
  const rated = reduce(s, { type: "rate", at: T0, ease: 7, notes: "" });
  assert.equal(rated.phase, "intro", "straight on to the next scenario");
  assert.equal(rated.cursor, 1);
});

const noReserves = () => ({ ...NAVIGATION_CONTENT, tasks: NAVIGATION_CONTENT.tasks.filter((t) => !t.reserve) });

test("the hand-back screen comes only after the last task, and leads to the debrief", () => {
  let s = reduce({ ...fresh({ content: noReserves() }), order: ["T1", "T3"] }, { type: "start", at: T0 });
  assert.throws(() => reduce(s, { type: "unlock", at: T0 }), IllegalTransition);
  s = doTask(s);
  assert.equal(s.phase, "intro");
  assert.throws(() => reduce(s, { type: "unlock", at: T0 }), IllegalTransition, "no hand-back between tasks");
  s = present(s, T0); s = reduce(s, { type: "begin", at: T0, scale: 1 }); s = reduce(s, { type: "end", at: T0 + 1, reason: "gave-up" });
  assert.throws(() => reduce(s, { type: "unlock", at: T0 }), IllegalTransition, "not while rating");
  s = reduce(s, { type: "rate", at: T0, ease: 4, notes: "" });
  assert.equal(s.phase, "handBack", "with no reserve tasks there is nothing to offer");
  assert.equal(reduce(s, { type: "unlock", at: T0 }).phase, "debrief");
});

test("recording stops at the event cap", () => {
  let s = present(reduce(fresh(), { type: "start", at: T0 }), T0);
  s = reduce(s, { type: "begin", at: T0, scale: 1 });
  for (let i = 0; i < MAX_EVENTS_PER_RUN + 50; i++) s = reduce(s, { type: "event", event: open("shop", i) });
  assert.equal(currentRun(s)!.events.length, MAX_EVENTS_PER_RUN);
});

test("ending early marks the run in flight as interrupted and excludes it from the counts", () => {
  let s = present(reduce(fresh(), { type: "start", at: T0 }), T0);
  s = reduce(s, { type: "begin", at: T0, scale: 1 });
  s = reduce(s, { type: "endEarly", at: T0 + 5 });
  assert.equal(s.phase, "debrief");
  assert.equal(s.status, "ended-early");
  assert.equal(currentRun(s)!.status, "interrupted");
  assert.equal(countedRuns(s).length, 0);
  assert.equal(reduce(s, { type: "finish", at: T0 }).status, "ended-early");
  assert.throws(() => reduce(fresh(), { type: "endEarly", at: T0 }), IllegalTransition);
});

test("resuming mid-task cannot continue the timers: the run is interrupted and the task re-presented", () => {
  let s = present(reduce(fresh(), { type: "start", at: T0 }), T0);
  s = reduce(s, { type: "begin", at: T0, scale: 1 });
  const interrupted = currentRun(s)!.runId;
  s = reduce(s, { type: "resume", at: T0 + 100 });
  assert.equal(s.phase, "intro");
  assert.equal(s.interruptions, 1);
  assert.equal(s.runs[0]!.status, "interrupted");
  s = present(s, T0 + 200);
  assert.equal(currentRun(s)!.retakeOf, interrupted);
  assert.equal(currentRun(s)!.attempt, 2);
});

test("resuming in other phases changes nothing", () => {
  const s = doTask(reduce(fresh(), { type: "start", at: T0 }));
  assert.deepEqual(reduce(s, { type: "resume", at: T0 }), { ...s, updatedAt: T0 });
});

test("a moderator override changes what counts, but never the recorded suggestion", () => {
  let s = doTask(reduce(fresh(), { type: "start", at: T0 }), [ready(0), open("learn", 100), leaf("/learn/essential-oils/discover-solutions", "learn", "Essential Oils", 1500)]);
  const run = () => currentRun(s)!;
  assert.equal(effective(run()).tier, "X");
  s = review(s, { tier: "A", overrideReason: "page covers testing", menu: "U" });
  assert.equal(effective(run()).tier, "A");
  assert.equal(effective(run()).level2, true);
  assert.equal(run().suggestion!.tier, "X");
  assert.equal(effective(run()).menu, "U");
});

test("the frame's scale is recorded once it is on screen, and a later change flags a resized window", () => {
  let s = present(reduce(fresh(), { type: "start", at: T0 }), T0);
  s = reduce(s, { type: "begin", at: T0, scale: 1 });
  s = reduce(s, { type: "scale", scale: 0.91 });
  assert.equal(currentRun(s)!.scale, 0.91);
  assert.equal(currentRun(s)!.windowResized, false, "fitting the frame before it is ready is not a resize");
  s = reduce(s, { type: "event", event: ready(0) });
  s = reduce(s, { type: "scale", scale: 0.8 });
  assert.equal(currentRun(s)!.windowResized, true);
  assert.throws(() => reduce(s, { type: "scale", scale: 1.5 }), IllegalTransition);
  assert.throws(() => reduce(fresh(), { type: "scale", scale: 1 }), IllegalTransition);
});

test("past the event cap, the click that ends the task and a search are still kept", () => {
  let s = present(reduce({ ...fresh(), order: ["T1"] }, { type: "start", at: T0 }), T0);
  s = reduce(s, { type: "begin", at: T0, scale: 1 });
  for (let i = 0; i < MAX_EVENTS_PER_RUN + 50; i++) s = reduce(s, { type: "event", event: open("shop", i) });
  s = reduce(s, { type: "event", event: leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 99999) });
  s = reduce(s, { type: "end", at: T0 + 9, reason: "destination", frameAt: 99999 });
  assert.equal(currentRun(s)!.suggestion!.tier, "P", "menu churn must not push the deciding click out of the record");
});

test("a chosen tier brings its own code: a stale suggested code never survives an override", () => {
  let s = doTask(reduce({ ...fresh(), order: ["T1"] }, { type: "start", at: T0 }), [ready(0), open("shop", 100), leaf("/shop/new-products", "shop", "Shop by Category", 1500)]);
  assert.equal(effective(currentRun(s)!).code, 2);
  s = review(s, { tier: "A" });
  assert.equal(effective(currentRun(s)!).code, null, "X to A: the wrong-click code goes");
  s = review(s, { tier: "R" });
  assert.equal(effective(currentRun(s)!).code, 4);
  s = review(s, { tier: "X" });
  assert.equal(effective(currentRun(s)!).code, 2, "back to X restores the suggested code");
  s = review(s, { code: 3 });
  assert.equal(effective(currentRun(s)!).code, 3, "an explicit code always wins");
  let p = doTask(reduce({ ...fresh({ id: "s9" }), order: ["T1"] }, { type: "start", at: T0 }));
  p = review(p, { tier: "X" });
  assert.equal(effective(currentRun(p)!).code, null, "P to X with nothing suggested: the moderator picks one");
});

test("ending early keeps every rated task, discards the one in flight, and ends a finished session without calling it early", () => {
  const done = doTask(reduce(fresh({ id: "k" }), { type: "start", at: T0 }));
  const between = reduce(done, { type: "endEarly", at: T0 });
  assert.equal(countedRuns(between).length, 1, "a rated task already counts");
  assert.equal(between.status, "ended-early");
  const mid = present(done, T0 + 50);
  const midRun = reduce(reduce(mid, { type: "begin", at: T0 + 60, scale: 1 }), { type: "end", at: T0 + 70, reason: "gave-up" });
  assert.equal(midRun.phase, "rating");
  const stopped = reduce(midRun, { type: "endEarly", at: T0 + 80 });
  assert.equal(countedRuns(stopped).length, 1, "the task being rated when it stopped does not count");
  assert.equal(currentRun(stopped)!.status, "interrupted");
  let all = reduce({ ...fresh({ id: "f", content: noReserves() }), order: ["T1"] }, { type: "start", at: T0 });
  all = doTask(all);
  assert.equal(all.phase, "handBack");
  const out = reduce(all, { type: "endEarly", at: T0 });
  assert.equal(out.phase, "debrief");
  assert.equal(out.status, "active", "every task was done, so this is not an early end");
});

test("findings can be added to any completed run at any time, even after the session has ended, and never alter the suggestion", () => {
  let s = reduce({ ...fresh({ id: "f" }), order: ["T1"] }, { type: "start", at: T0 });
  s = doTask(s, [ready(0), open("learn", 100), leaf("/learn/essential-oils/discover-solutions", "learn", "Essential Oils", 1500)]);
  const runId = currentRun(s)!.runId;
  assert.equal(currentRun(s)!.moderator.reviewed, false);
  s = apply(s, { type: "declineReserves", at: T0 }, { type: "unlock", at: T0 }, { type: "finish", at: T0 });
  assert.equal(s.phase, "ended");
  s = reduce(s, { type: "reviewRun", at: T0 + 5, runId, patch: { observed: "read every goal aloud", tier: "A", overrideReason: "page covers it" } });
  const run = currentRun(s)!;
  assert.equal(run.moderator.reviewed, true);
  assert.equal(run.moderator.observed, "read every goal aloud");
  assert.equal(effective(run).tier, "A");
  assert.equal(run.suggestion!.tier, "X");
  assert.throws(() => reduce(s, { type: "reviewRun", at: T0, runId: "nope", patch: {} }), IllegalTransition);
});

test("findings cannot be added to a run that never completed", () => {
  let s = present(reduce(fresh(), { type: "start", at: T0 }), T0);
  s = reduce(s, { type: "begin", at: T0, scale: 1 });
  s = reduce(s, { type: "endEarly", at: T0 + 5 });
  assert.throws(() => reduce(s, { type: "reviewRun", at: T0, runId: currentRun(s)!.runId, patch: { observed: "x" } }), IllegalTransition);
});

test("the frame end time reaches the scoring, so a menu stared at until giving up is a choice", () => {
  let s = present(reduce(fresh(), { type: "start", at: T0 }), T0);
  s = reduce(s, { type: "begin", at: T0, scale: 1 });
  s = reduce(s, { type: "event", event: ready(0) });
  s = reduce(s, { type: "event", event: open("shop", 500) });
  s = reduce(s, { type: "end", at: T0 + 20000, reason: "gave-up", frameAt: 20500 });
  assert.equal(currentRun(s)!.suggestion!.levelOneSection, "shop");
});
