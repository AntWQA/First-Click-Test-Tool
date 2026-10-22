import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_CONTENT, NAVIGATION_CONTENT } from "../src/shell/domain/tasks.ts";
import { validateContent } from "../src/shell/domain/content.ts";
import { cleanClosing, closingQuestionsFor, createSession, reduce } from "../src/shell/domain/session.ts";
import type { Session } from "../src/shell/domain/session.ts";
import { ledgerMarkdown, parseImport, runsToCsv, sanitiseSession, toJsonBundle } from "../src/shell/domain/exports.ts";
import { createStore, memoryBacking } from "../src/shell/domain/storage.ts";
import { leaf, open, ready } from "./helpers.ts";

const T0 = 1_700_000_000_000;
const Q = (id: string) => DEFAULT_CONTENT.closingQuestions!.find((q) => q.id === id)!;

/** A self-run session with C8 done and the reserves declined: at the hand-back screen, where the closing questions come. */
function atHandBack(id = "s1", pid = "SR1"): Session {
  let s = createSession({ id, now: T0, participantId: pid, selfRun: true, content: DEFAULT_CONTENT });
  s = { ...s, order: ["C8"], plan: { C8: "desktop" } };
  s = reduce(s, { type: "start", at: T0 });
  s = reduce(s, { type: "present", at: T0, runId: "r" + id });
  s = reduce(s, { type: "begin", at: T0 + 1000, scale: 1 });
  for (const e of [ready(0), open("shop", 200), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 1500)]) s = reduce(s, { type: "event", event: e });
  s = reduce(s, { type: "end", at: T0 + 9000, reason: "destination" });
  s = reduce(s, { type: "rate", at: T0 + 9500, ease: 5, notes: "" });
  return reduce(s, { type: "declineReserves", at: T0 + 9550 });
}

test("the default content carries the debrief as seven participant questions that name what they are about", () => {
  assert.equal(validateContent(DEFAULT_CONTENT).ok, true);
  const qs = DEFAULT_CONTENT.closingQuestions!;
  assert.deepEqual(qs.map((q) => q.id), ["video", "rank", "noReviews", "rewardsMeaning", "solutionsMeaning", "changeHome", "changeProduct"]);
  assert.equal(Q("rank").kind, "rank");
  assert.equal(Q("rank").items!.length, 4);
  assert.equal(Q("noReviews").unlessRun, "R2");
  const read = (q: (typeof qs)[number]) => [q.prompt, q.hint ?? "", ...(q.items ?? [])].join(" ");
  for (const q of qs) assert.doesNotMatch(read(q), /\b(this|these|that one|here|above|below)\b/i, `${q.id}: ${read(q)}`);
  assert.ok(!JSON.stringify(qs).includes("—"));
  assert.equal(NAVIGATION_CONTENT.closingQuestions, undefined, "the navigation-only test has none");
});

test("content validation: closing question ids, kinds, rank items and unlessRun are checked", () => {
  const bad = (edit: (c: ReturnType<typeof structuredClone<typeof DEFAULT_CONTENT>>) => void) => { const c = structuredClone(DEFAULT_CONTENT); edit(c); const r = validateContent(c); return r.ok ? [] : r.errors; };
  assert.ok(bad((c) => { c.closingQuestions![0]!.id = "Bad id"; }).some((e) => /id must be/.test(e)));
  assert.ok(bad((c) => { c.closingQuestions![1]!.id = c.closingQuestions![0]!.id; }).some((e) => /used twice/.test(e)));
  assert.ok(bad((c) => { c.closingQuestions![0]!.prompt = ""; }).some((e) => /prompt is empty/.test(e)));
  assert.ok(bad((c) => { (c.closingQuestions![0] as { kind: string }).kind = "dropdown"; }).some((e) => /text or rank/.test(e)));
  assert.ok(bad((c) => { c.closingQuestions![1]!.items = ["only one"]; }).some((e) => /2 to 8 items/.test(e)));
  assert.ok(bad((c) => { c.closingQuestions![1]!.items = ["a", "a"]; }).some((e) => /repeated item/.test(e)));
  assert.ok(bad((c) => { c.closingQuestions![2]!.unlessRun = "C99"; }).some((e) => /not a task id/.test(e)));
  assert.ok(bad((c) => { c.closingQuestions![0]!.prompt = "a — b"; }).some((e) => /em dash/.test(e)));
  assert.ok(bad((c) => { c.closingQuestions = Array.from({ length: 13 }, (_, i) => ({ id: "q" + i, prompt: "p", kind: "text" as const })); }).some((e) => /at most 12/.test(e)));
});

test("which questions a participant is asked: R2's question is skipped once R2 is done, and none after stopping early", () => {
  const s = atHandBack();
  assert.equal(closingQuestionsFor(s).length, 7);
  const doneR2 = { ...s, runs: [...s.runs, { ...s.runs[0]!, taskId: "R2", status: "completed" as const }] };
  assert.deepEqual(closingQuestionsFor(doneR2).map((q) => q.id), ["video", "rank", "rewardsMeaning", "solutionsMeaning", "changeHome", "changeProduct"]);
  assert.equal(closingQuestionsFor({ ...s, status: "ended-early" }).length, 0);
});

test("answers are cleaned: text trimmed, blanks dropped, a ranking kept only when every item has its own place", () => {
  const items = Q("rank").items!;
  const clean = cleanClosing(DEFAULT_CONTENT.closingQuestions!, {
    video: "  It would help a little.  ", noReviews: "   ", changeHome: 42, nope: "x",
    rank: [items[2], items[0], items[3], items[1]],
  });
  assert.deepEqual(clean, { video: "It would help a little.", rank: [items[2], items[0], items[3], items[1]] });
  assert.equal(cleanClosing(DEFAULT_CONTENT.closingQuestions!, { rank: [items[0], items[0], items[1], items[2]] }).rank, undefined, "a repeated item is not a ranking");
  assert.equal(cleanClosing(DEFAULT_CONTENT.closingQuestions!, { rank: [items[0], items[1]] }).rank, undefined, "a partial ranking is not kept");
  assert.equal(cleanClosing(DEFAULT_CONTENT.closingQuestions!, { rank: ["x", "y", "z", "w"] }).rank, undefined, "items must be the question's own");
  assert.equal(cleanClosing(DEFAULT_CONTENT.closingQuestions!, { video: "x".repeat(5000) }).video!.length, 1500);
});

test("the closing action stores the cleaned answers at the hand-back screen only, and leaves the phase alone", () => {
  const s = atHandBack();
  assert.equal(s.phase, "handBack");
  assert.equal(s.closing, undefined);
  const done = reduce(s, { type: "closing", at: T0 + 10_000, answers: { video: " Maybe. ", bogus: "x" } });
  assert.deepEqual(done.closing, { video: "Maybe." });
  assert.equal(done.phase, "handBack");
  const blank = reduce(s, { type: "closing", at: T0 + 10_000, answers: {} });
  assert.deepEqual(blank.closing, {}, "skipping every question still marks the screen as seen");
  assert.throws(() => reduce(createSession({ id: "x", now: T0, participantId: "P1", content: DEFAULT_CONTENT }), { type: "closing", at: T0, answers: {} }), /not allowed/);
  const ended = reduce(done, { type: "complete", at: T0 + 11_000, notes: "" });
  assert.deepEqual(ended.closing, { video: "Maybe." }, "ending the session keeps them");
});

test("closing answers survive export and import, and forged ones are dropped", () => {
  const items = Q("rank").items!;
  let s = atHandBack();
  s = reduce(s, { type: "closing", at: T0 + 10_000, answers: { video: "A video would help.", rank: [items[1], items[0], items[2], items[3]] } });
  s = reduce(s, { type: "complete", at: T0 + 11_000, notes: "" });
  const back = parseImport(toJsonBundle([s], DEFAULT_CONTENT, "x"));
  assert.equal(back.rejected.length, 0);
  assert.deepEqual(back.sessions[0]!.closing, s.closing);
  const raw = JSON.parse(toJsonBundle([s], DEFAULT_CONTENT, "x")).sessions[0];
  raw.closing = { video: "ok", rank: ["a", "b"], hacked: "x", changeHome: { evil: true } };
  assert.deepEqual(sanitiseSession(raw)!.closing, { video: "ok" });
  delete raw.closing;
  assert.equal(sanitiseSession(raw)!.closing, undefined, "a file without them stays without them");
});

test("closing answers reach the CSV and the Markdown summary", () => {
  const items = Q("rank").items!;
  let s = atHandBack();
  s = reduce(s, { type: "closing", at: T0 + 10_000, answers: { video: "A video would help.", rank: [items[1], items[0], items[2], items[3]], changeHome: "Show prices sooner" } });
  s = reduce(s, { type: "complete", at: T0 + 11_000, notes: "" });
  const csv = runsToCsv([s]);
  assert.match(csv.split("\r\n")[0]!, /,closing_answers\r?$/);
  assert.match(csv, /video=A video would help\.; rank=The CPTG Certified Pure Tested Grade mark > Customer reviews > /);
  assert.match(csv, /changeHome=Show prices sooner/);
  const md = ledgerMarkdown([s], "x");
  assert.match(md, /## Closing questions/);
  assert.match(md, /SR1: A video would help\./);
  assert.match(md, /What would you change first on the dōTERRA homepage/);
  assert.doesNotMatch(ledgerMarkdown([{ ...s, practice: true }], "x"), /## Closing questions/, "practice sessions are left out");
});

test("a saved copy of the previous default, and a session begun on it, gain the closing questions", () => {
  const old = JSON.parse(readFileSync(new URL("./fixtures/combined-default-v6.json", import.meta.url), "utf8"));
  assert.equal(old.closingQuestions, undefined, "the fixture is the version without them");
  const backing = memoryBacking({ "wc.v1.content": JSON.stringify({ ...old, version: 7 }) });
  const store = createStore(backing, () => 1);
  assert.equal(store.loadContent().closingQuestions!.length, 7);
  assert.equal(backing.getItem("wc.v1.content"), null);
  // an edit that keeps the old parts but adds its own closing question is a researcher's, and stays
  const edited = { ...old, closingQuestions: [{ id: "mine", prompt: "Anything else?", kind: "text" }] };
  assert.deepEqual(createStore(memoryBacking({ "wc.v1.content": JSON.stringify(edited) }), () => 1).loadContent().closingQuestions!.map((q) => q.id), ["mine"]);
  const v = validateContent(old);
  assert.ok(v.ok);
  const session = createSession({ id: "old", now: T0, participantId: "SR2", selfRun: true, content: v.content });
  const st = createStore(memoryBacking(), () => 1);
  st.saveSession(session);
  assert.equal(st.loadSessions().sessions[0]!.content.closingQuestions!.length, 7);
});
