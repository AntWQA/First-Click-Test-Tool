import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONTENT } from "../src/shell/domain/tasks.ts";
import { createSession, reduce } from "../src/shell/domain/session.ts";
import type { Session } from "../src/shell/domain/session.ts";
import { ledger, median, rateVerdict, tallyTask, worstVerdict } from "../src/shell/domain/ledger.ts";
import type { CapturedEvent } from "../src/shared/protocol.ts";
import { leaf, open, ready } from "./helpers.ts";

const T0 = 1_700_000_000_000;
let n = 0;

/** A finished session whose single task is `taskId`, built through the real reducer. */
function session(id: string, taskId: string, events: CapturedEvent[], opts: { ease?: number; practice?: boolean; breakpoint?: "desktop" | "mobile"; reason?: "destination" | "gave-up" | "found" } = {}): Session {
  let s = createSession({ id, now: T0, participantId: id, practice: opts.practice, content: DEFAULT_CONTENT });
  s = { ...s, order: [taskId], plan: { [taskId]: opts.breakpoint ?? "desktop" } };
  s = reduce(s, { type: "start", at: T0 });
  s = reduce(s, { type: "present", at: T0, runId: "r" + ++n });
  s = reduce(s, { type: "begin", at: T0 + 1000, scale: 1 });
  for (const e of events) s = reduce(s, { type: "event", event: e });
  s = reduce(s, { type: "end", at: T0 + 9000, reason: opts.reason ?? "destination" });
  s = reduce(s, { type: "rate", at: T0 + 9500, ease: opts.ease ?? 6, notes: "" });
  s = reduce(s, { type: "declineReserves", at: T0 + 9550 });
  return reduce(s, { type: "unlock", at: T0 + 9600 });
}

const hit = (id: string, ease = 6) => session(id, "T1", [ready(0), open("shop", 200), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 1500)], { ease });
const miss = (id: string, ease = 3) => session(id, "T1", [ready(0), open("learn", 100), leaf("/learn/essential-oils/discover-solutions", "learn", "Essential Oils", 1500)], { ease });
const many = (hits: number, misses: number) => [...Array.from({ length: hits }, (_, i) => hit("h" + i)), ...Array.from({ length: misses }, (_, i) => miss("m" + i))];

test("thresholds are exact at the boundaries", () => {
  assert.equal(rateVerdict(8, 10), "pass");
  assert.equal(rateVerdict(7, 10), "watch");
  assert.equal(rateVerdict(6, 10), "watch");
  assert.equal(rateVerdict(5, 10), "fail");
  assert.equal(rateVerdict(4, 5), "pass");
  assert.equal(rateVerdict(3, 5), "watch");
  assert.equal(rateVerdict(2, 5), "fail");
  assert.equal(rateVerdict(0, 0), "n/a");
  assert.equal(rateVerdict(8, 8), "pass");
});

test("the task verdict is the worse of the two levels, ignoring n/a", () => {
  assert.equal(worstVerdict("pass", "watch"), "watch");
  assert.equal(worstVerdict("fail", "pass"), "fail");
  assert.equal(worstVerdict("n/a", "pass"), "pass");
  assert.equal(worstVerdict("n/a", "n/a"), "n/a");
});

test("median handles odd, even and empty lists", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test("tally: 8 hits and 2 misses is a Pass on Level 2, with counts beside the rate", () => {
  const t = tallyTask(many(8, 2), "T1", "desktop");
  assert.equal(t.n, 10);
  assert.deepEqual([t.level2.hits, t.level2.den], [8, 10]);
  assert.equal(t.level2.rate, 0.8);
  assert.equal(t.verdictLevel2, "pass");
  assert.equal(t.level1.hits, 8);
  assert.equal(t.verdict, "pass");
  assert.equal(t.highRisk, true);
});

test("tally: 7 of 10 is Watch and 5 of 10 is Fail", () => {
  assert.equal(tallyTask(many(7, 3), "T1", "desktop").verdict, "watch");
  assert.equal(tallyTask(many(5, 5), "T1", "desktop").verdict, "fail");
});

test("practice sessions, other breakpoints and other tasks are not counted", () => {
  const sessions = [hit("a"), session("p", "T1", [ready(0), open("shop", 1), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 9)], { practice: true }),
    session("m", "T1", [ready(0), open("shop", 1, "drill", "click"), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 9)], { breakpoint: "mobile" })];
  assert.equal(tallyTask(sessions, "T1", "desktop").n, 1);
  assert.equal(tallyTask(sessions, "T1", "mobile").n, 1);
  assert.equal(tallyTask(sessions, "T2", "desktop").n, 0);
});

test("confident wrong: a miss with ease 5 or more is flagged, and misreads and codes are counted", () => {
  const t = tallyTask([miss("a", 6), miss("b", 2), hit("c")], "T1", "desktop");
  assert.equal(t.confidentWrong, 1);
  assert.deepEqual(t.misreads, { learn: 2 });
  assert.equal(t.codes["1"], 2);
  assert.equal(t.meanEase, (6 + 2 + 6) / 3);
});

test("search runs and separately recorded answers are reported but never scored as hit or miss", () => {
  const search = session("s", "T1", [ready(0), { type: "search-submit", at: 900, query: "sleep" }]);
  const t = tallyTask([search, hit("a")], "T1", "desktop");
  assert.equal(t.recordedOnly, 1);
  assert.deepEqual([t.level2.hits, t.level2.den], [1, 1]);
  const sep = session("t", "T5", [ready(0), open("our-story", 100), leaf("/our-story/about/source-to-you", "our-story", "About doTERRA", 1500)]);
  assert.equal(tallyTask([sep], "T5", "desktop").separate, 1);
});

test("the route split shows which column a duplicated answer was found in", () => {
  const a = session("a", "T4", [ready(0), open("shop", 1), leaf("/shop/highlights/new-products", "shop", "Highlights", 900)]);
  const b = session("b", "T4", [ready(0), open("shop", 1), leaf("/shop/new-products", "shop", "Shop by Category", 900)]);
  const c = session("c", "T4", [ready(0), open("shop", 1), leaf("/shop/highlights/new-products", "shop", "Highlights", 900)]);
  assert.deepEqual(tallyTask([a, b, c], "T4", "desktop").routeSplit, { Highlights: 2, "Shop by Category": 1 });
});

test("zero counted runs gives n/a rather than a division error", () => {
  const t = tallyTask([], "T1", "desktop");
  assert.equal(t.n, 0);
  assert.equal(t.level2.rate, null);
  assert.equal(t.verdict, "n/a");
  assert.equal(t.meanEase, null);
  assert.deepEqual(ledger([]), []);
});

test("a moderator override flows into the tally", () => {
  let s = miss("a");
  s = { ...s, runs: s.runs.map((r) => ({ ...r, moderator: { ...r.moderator, tier: "A" as const } })) };
  const t = tallyTask([s], "T1", "desktop");
  assert.equal(t.level2.hits, 1);
});

test("a participant ID run more than once counts once per task: the newest session wins, never both", () => {
  const first = hit("P3");
  const again = { ...miss("P3"), id: "P3-repeat", createdAt: first.createdAt + 1000 };
  const t = tallyTask([first, again], "T1", "desktop");
  assert.equal(t.n, 1);
  assert.deepEqual([t.level2.hits, t.level2.den], [0, 1], "the newer, missed run is the one counted");
  const ended = { ...hit("P4"), status: "ended-early" as const };
  assert.equal(tallyTask([ended, { ...hit("P4"), id: "P4b", createdAt: ended.createdAt + 5 }], "T1", "desktop").n, 1);
});

test("different participants are all counted", () => {
  assert.equal(tallyTask([hit("a"), hit("b"), hit("c")], "T1", "desktop").n, 3);
});

test("results come from each session's own task snapshot, so editing the content later never drops or relabels them", () => {
  const renamed = { ...hit("a"), content: { ...DEFAULT_CONTENT, version: 2, tasks: DEFAULT_CONTENT.tasks.map((t) => (t.id === "T1" ? { ...t, title: "Rest" } : t)) } };
  const removed = { ...hit("b"), content: { ...DEFAULT_CONTENT, version: 3, tasks: DEFAULT_CONTENT.tasks.filter((t) => t.id !== "T1").concat({ ...DEFAULT_CONTENT.tasks[0]!, id: "T1" }) } };
  const rows = ledger([renamed, removed]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.n, 2);
  assert.deepEqual(rows[0]!.contentVersions, [2, 3], "mixed content versions are flagged, not silently pooled");
  assert.equal(ledger([hit("only")])[0]!.contentVersions.length, 1);
});

test("keys that come from recorded data cannot corrupt the tallies", () => {
  const evil = session("e", "T1", [ready(0), open("shop", 100), leaf("/shop/goal/sleep-solutions", "shop", "constructor", 900)]);
  const proto = session("f", "T1", [ready(0), open("shop", 100), leaf("/shop/goal/sleep-solutions", "shop", "__proto__", 900)]);
  const t = tallyTask([evil, proto], "T1", "desktop");
  assert.equal(t.routeSplit["constructor"], 1);
  assert.equal(Object.hasOwn(t.routeSplit, "__proto__"), false);
  assert.equal(Number.isFinite(t.routeSplit["constructor"]), true);
});

test("the breakpoint comes from each run: one participant can sit in two tables, but only once per task", () => {
  const a = session("a", "T1", [ready(0), open("shop", 1), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 900)]);
  const b = session("a2", "T3", [ready(0), open("shop", 1, "drill", "click"), leaf("/shop/highlights/limited-time-offers", "shop", "Highlights", 900)], { breakpoint: "mobile" });
  const both = [{ ...a, participantId: "P1" }, { ...b, participantId: "P1", createdAt: a.createdAt + 1 }];
  assert.equal(tallyTask(both, "T1", "desktop").n, 1);
  assert.equal(tallyTask(both, "T3", "mobile").n, 1);
  assert.equal(tallyTask(both, "T3", "desktop").n, 0);
  assert.equal(ledger(both).length, 2);
});

test("a repeat of the same participant on a different breakpoint never puts them in two cells for one task", () => {
  const first = { ...session("x1", "T1", [ready(0), open("shop", 1), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 900)]), participantId: "P5" };
  const again = { ...session("x2", "T1", [ready(0), open("shop", 1, "drill", "click"), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 900)], { breakpoint: "mobile" }), participantId: "P5", createdAt: first.createdAt + 10 };
  assert.equal(tallyTask([first, again], "T1", "desktop").n, 0, "the newer session wins, and it ran at mobile");
  assert.equal(tallyTask([first, again], "T1", "mobile").n, 1);
});

test("the mean position shows how early in the session a task was met", () => {
  const s = session("p", "T1", [ready(0), open("shop", 1), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 900)]);
  const late = { ...s, runs: s.runs.map((r) => ({ ...r, position: 6 })) };
  assert.equal(tallyTask([late], "T1", "desktop").meanPosition, 7);
  assert.equal(tallyTask([s], "T1", "desktop").meanPosition, 1);
});

test("the Ledger counts a run straight after it is rated, shows how many have findings, and uses a finding's tier once added", () => {
  const wrong = [ready(0), open("learn", 100), leaf("/learn/essential-oils/discover-solutions", "learn", "Essential Oils", 1500)];
  const a = session("a", "T1", wrong);
  const b = session("b", "T1", wrong);
  let rows = ledger([a, b]);
  assert.equal(rows[0]!.n, 2);
  assert.equal(rows[0]!.reviewed, 0);
  assert.equal(rows[0]!.level2.hits, 0);
  const fixed = reduce(a, { type: "reviewRun", at: T0, runId: a.runs[0]!.runId, patch: { tier: "A", overrideReason: "covers it" } });
  rows = ledger([fixed, b]);
  assert.equal(rows[0]!.reviewed, 1);
  assert.equal(rows[0]!.level2.hits, 1, "the moderator's tier replaces the suggestion in the figures");
});
