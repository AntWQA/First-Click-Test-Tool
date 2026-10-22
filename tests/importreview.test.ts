import { test } from "node:test";
import assert from "node:assert/strict";
import { NAVIGATION_CONTENT } from "../src/shell/domain/tasks.ts";
import { createSession, reduce, recency } from "../src/shell/domain/session.ts";
import type { Session } from "../src/shell/domain/session.ts";
import { ledgerMarkdown, parseImport, sanitiseSession, toJsonBundle, MAX_SESSIONS_PER_FILE } from "../src/shell/domain/exports.ts";
import { applyReview, reviewImport } from "../src/shell/domain/importReview.ts";
import { tallyTask } from "../src/shell/domain/ledger.ts";
import { validateContent } from "../src/shell/domain/content.ts";
import { sectionLabel } from "../src/shell/format.ts";
import { leaf, open, ready } from "./helpers.ts";

const T0 = 1_700_000_000_000;
let n = 0;
/** A participant-edition session with T1 done (a wrong click unless `right`), built through the real reducer. */
function selfRun(id: string, code: string, right = false, over: Partial<Session> = {}): Session {
  let s = createSession({ id, now: T0, participantId: code, selfRun: true, content: NAVIGATION_CONTENT });
  s = { ...s, order: ["T1"], plan: { T1: "desktop" } };
  s = reduce(s, { type: "start", at: T0 });
  s = reduce(s, { type: "present", at: T0, runId: "r" + ++n });
  s = reduce(s, { type: "begin", at: T0 + 1000, scale: 1 });
  const events = right
    ? [ready(0), open("shop", 200), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 1500)]
    : [ready(0), open("learn", 200), leaf("/learn/essential-oils/discover-solutions", "learn", "Essential Oils", 1500)];
  for (const e of events) s = reduce(s, { type: "event", event: e });
  s = reduce(s, { type: "end", at: T0 + 9000, reason: "destination" });
  s = reduce(s, { type: "rate", at: T0 + 9500, ease: 5, notes: "" });
  s = reduce(s, { type: "declineReserves", at: T0 + 9550 });
  s = reduce(s, { type: "complete", at: T0 + 9600, notes: "" });
  return { ...s, ...over };
}
const roundTrip = (s: Session) => parseImport(toJsonBundle([s], NAVIGATION_CONTENT, "x"));
const rawOf = (s: Session) => JSON.parse(toJsonBundle([s], NAVIGATION_CONTENT, "x")).sessions[0];

test("a participant file is not believed about the moderator's work: findings, tier, reviewed and practice are discarded", () => {
  const raw = rawOf(selfRun("a", "P1"));
  raw.practice = true;
  raw.runs[0].moderator = { menu: "U", observed: "forged", interpretation: "", expected: "", secondChance: "", overrideReason: "x", reviewed: true, tier: "P", code: null, level1: true };
  const s = sanitiseSession(raw)!;
  assert.equal(s.practice, false);
  assert.equal(s.runs[0]!.moderator.reviewed, false);
  assert.equal(s.runs[0]!.moderator.tier, undefined);
  assert.equal(s.runs[0]!.moderator.observed, "");
  // A moderator's own stored session (trusted) keeps its findings.
  assert.equal(sanitiseSession(raw, true)!.runs[0]!.moderator.reviewed, true);
});

test("a participant file's code must be one the participant edition can produce: look-alike and invisible characters are refused", () => {
  for (const bad of ["Р3", "P3​", "P 3", "P3‮", "ṕ", "<b>", "a".repeat(41), ""]) {
    const raw = rawOf(selfRun("a", "P1")); raw.participantId = bad;
    assert.equal(sanitiseSession(raw), null, JSON.stringify(bad));
  }
  const raw = rawOf(selfRun("a", "P1")); raw.participantId = "Р3";
  assert.match(parseImport(JSON.stringify({ exportVersion: 1, app: "wayfinding-check", sessions: [raw] })).rejected[0]!.reason, /could not have typed/);
});

test("a participant file cannot supply its own answers: it is scored against this tool's tasks", () => {
  const raw = rawOf(selfRun("a", "P1", false));     // a wrong click
  raw.content.tasks.find((t: { id: string }) => t.id === "T1").primary = [{ href: "/learn/essential-oils/discover-solutions" }];   // forged answer key
  const forged = sanitiseSession(raw)!;
  assert.equal(forged.runs[0]!.suggestion!.tier, "P", "scored against the forged key it looks right");
  const [item] = reviewImport([], [forged], NAVIGATION_CONTENT);
  assert.equal(item!.session.runs[0]!.suggestion!.tier, "X", "scored against the tool's own key it is a miss");
  assert.ok(item!.flags.some((f) => f.kind === "rescored" && /T1/.test(f.text)));
  assert.equal(item!.action, "import", "this alone is safe to import because it has been re-scored");
});

test("a participant file with different scenario wording, or tasks this tool does not have, is held back by default", () => {
  const reworded = rawOf(selfRun("a", "P1")); reworded.content.tasks[0].scenario = "Something else entirely.";
  const [r] = reviewImport([], [sanitiseSession(reworded)!], NAVIGATION_CONTENT);
  assert.equal(r!.action, "skip"); assert.ok(r!.flags.some((f) => f.kind === "tasks-differ"));
  const tool = { ...NAVIGATION_CONTENT, tasks: NAVIGATION_CONTENT.tasks.filter((t) => t.id !== "T1") };
  const [m] = reviewImport([], [selfRun("b", "P2")], tool);
  assert.equal(m!.action, "skip"); assert.ok(m!.flags.some((f) => f.kind === "tasks-missing"));
});

test("a code that already belongs to another session is flagged, whatever its case, and held back by default", () => {
  const mine = createSession({ id: "mine", now: T0, participantId: "P3", content: NAVIGATION_CONTENT });
  for (const code of ["P3", "p3"]) {
    const [it] = reviewImport([mine], [selfRun("x" + code, code)], NAVIGATION_CONTENT);
    assert.equal(it!.action, "skip", code);
    assert.ok(it!.flags.some((f) => f.kind === "code-in-use"));
  }
  const [fresh] = reviewImport([mine], [selfRun("y", "P9")], NAVIGATION_CONTENT);
  assert.equal(fresh!.action, "import");
  assert.equal(fresh!.flags.some((f) => f.blocking), false);
});

test("two sessions in one file with the same code: the second is held back", () => {
  const items = reviewImport([], [selfRun("a", "P4"), selfRun("b", "p4")], NAVIGATION_CONTENT);
  assert.deepEqual(items.map((i) => i.action), ["import", "skip"]);
  assert.ok(items[1]!.flags.some((f) => f.kind === "duplicate-in-file"));
});

test("a session you have already added findings to is never replaced without you choosing to", () => {
  const mine = selfRun("same", "P5");
  mine.runs[0]!.moderator.reviewed = true; mine.runs[0]!.moderator.observed = "my note";
  const incoming = { ...selfRun("same", "P5"), updatedAt: mine.updatedAt + 10_000 };
  const [it] = reviewImport([mine], [incoming], NAVIGATION_CONTENT);
  assert.equal(it!.action, "skip");
  assert.ok(it!.flags.some((f) => f.kind === "replaces-findings"));
  assert.equal(applyReview([mine], [{ ...it!, action: "skip" }], { file: "f", sha256: "h", size: 1 }, 5).find((s) => s.id === "same")!.runs[0]!.moderator.observed, "my note");
});

test("which of two files is newer is decided by when the tool imported them, not by the date a file claims", () => {
  const forgedFuture = selfRun("a", "P6", true, { createdAt: Date.now() + 86_400_000 });
  const genuine = selfRun("b", "P6", false, { createdAt: T0 });
  const items = reviewImport([], [forgedFuture, genuine], NAVIGATION_CONTENT).map((i) => ({ ...i, action: "import" as const }));
  const first = applyReview([], items.slice(0, 1), { file: "forged.json", sha256: "1", size: 1 }, 1_000);
  const both = applyReview(first, items.slice(1), { file: "genuine.json", sha256: "2", size: 1 }, 2_000);
  assert.equal(recency(both.find((s) => s.id === "b")!) > recency(both.find((s) => s.id === "a")!), true);
  const t = tallyTask(both, "T1", "desktop");
  assert.equal(t.n, 1);
  assert.equal(t.level2.hits, 0, "the later import (a miss) is the one that counts, so a forged future date wins nothing");
});

test("a completed run needs an end, a begin, an end time and a rating; impossible numbers are clamped; repeated run ids are dropped", () => {
  const raw = rawOf(selfRun("a", "P7"));
  const run = raw.runs[0];
  const noEase = structuredClone(raw); noEase.runs[0].ease = null;
  assert.equal(sanitiseSession(noEase)!.runs.length, 0, "completed without a rating cannot have happened");
  const wild = structuredClone(raw);
  Object.assign(wild.runs[0], { position: 1e308, durationMs: 1e300, readingMs: -5, scale: 40, attempt: 1e9 });
  const s = sanitiseSession(wild)!.runs[0]!;
  assert.ok(s.position <= 1000 && s.durationMs! <= 86_400_000 && s.readingMs === 0 && s.scale <= 1 && s.attempt <= 100);
  const dup = structuredClone(raw); dup.runs = [run, structuredClone(run)];
  assert.equal(sanitiseSession(dup)!.runs.length, 1);
  const future = structuredClone(raw); future.runs[0].presentedAt = 1e18;
  assert.equal(sanitiseSession(future)!.runs.length, 0);
});

test("a file may not hold an unbounded number of sessions, or of tasks", () => {
  const one = rawOf(selfRun("a", "P8"));
  const many = Array.from({ length: MAX_SESSIONS_PER_FILE + 1 }, (_, i) => ({ ...structuredClone(one), id: "s" + i }));
  assert.match(parseImport(JSON.stringify({ exportVersion: 1, app: "wayfinding-check", sessions: many })).error!, /no file may hold more than 100/);
  const content = { ...NAVIGATION_CONTENT, tasks: Array.from({ length: 61 }, (_, i) => ({ ...NAVIGATION_CONTENT.tasks[0]!, id: "T" + (100 + i) })) };
  assert.equal(validateContent(content, { checkLinks: false }).ok, false);
});

test("text from a file cannot inject links, images, HTML or line breaks into the Markdown export", () => {
  const raw = rawOf(selfRun("a", "P9", true));
  raw.content.tasks[0].title = "[click](https://evil.example) ![i](https://evil.example/p.png) <img src=x onerror=1> `x` \u2028 next\u0085line";
  const s = { ...sanitiseSession(raw)!, practice: false };
  const md = ledgerMarkdown([s], "now");
  assert.ok(!md.includes("](https://evil"), "no live link");
  assert.ok(!/(^|[^\\])</.test(md), "no unescaped angle bracket, so no raw HTML");
  assert.ok(!/(^|[^\\])!\[/.test(md), "no live image");
  assert.ok(!/[\u2028\u2029\u0085]/.test(md), "no exotic line breaks");
  assert.ok(md.includes("click"), "the words are still there");
});

test("a section called __proto__ is just a label", () => {
  assert.equal(sectionLabel("__proto__"), "__proto__");
  assert.equal(sectionLabel("constructor"), "constructor");
  assert.equal(sectionLabel("shop"), "Shop");
});

test("an imported file is read back with provenance only from this tool's own storage", () => {
  const raw = rawOf(selfRun("a", "P10"));
  raw.imported = { file: "forged", sha256: "x", size: 1, at: 1 };
  assert.equal(sanitiseSession(raw)!.imported, undefined, "a file cannot name its own source");
  assert.equal(sanitiseSession(raw, true)!.imported!.file, "forged", "stored provenance (written by the tool) is kept");
  assert.ok(roundTrip(selfRun("b", "P11")).sessions.length === 1);
});
