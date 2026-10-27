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

/** A self-run session with C9 done and the reserves declined: at the hand-back screen, where the closing questions come. */
function atHandBack(id = "s1", pid = "SR1"): Session {
  let s = createSession({ id, now: T0, participantId: pid, selfRun: true, content: DEFAULT_CONTENT });
  s = { ...s, order: ["C9"], plan: { C9: "desktop" } };
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
  assert.deepEqual(Q("video").options, ["Yes", "No", "Don't know"], "the video question is Yes, No or Don't know");
  assert.deepEqual(Object.keys(Q("video").follow!), ["Yes", "No"], "and asks for words only after Yes or No");
  assert.equal(Q("video").other, undefined);
  for (const id of ["noReviews", "rewardsMeaning", "solutionsMeaning", "changeHome", "changeProduct"]) {
    assert.equal(Q(id).kind, "choice", id);
    assert.equal(Q(id).other, true, id + " offers Other");
    assert.ok(Q(id).options!.length >= 5, id);
  }
  assert.equal(Q("rank").items!.length, 4);
  assert.equal(Q("noReviews").unlessRun, "R2");
  const read = (q: (typeof qs)[number]) => [q.prompt, q.hint ?? "", ...(q.items ?? []), ...(q.options ?? []), ...Object.values(q.follow ?? {})].join(" ");
  for (const q of qs) assert.doesNotMatch(read(q), /\b(this|these|that one|here|above|below)\b/i, `${q.id}: ${read(q)}`);
  assert.ok(!JSON.stringify(qs).includes("—"));
  assert.equal(NAVIGATION_CONTENT.closingQuestions, undefined, "the navigation-only test has none");
});

test("content validation: closing question ids, kinds, rank items and unlessRun are checked", () => {
  const bad = (edit: (c: ReturnType<typeof structuredClone<typeof DEFAULT_CONTENT>>) => void) => { const c = structuredClone(DEFAULT_CONTENT); edit(c); const r = validateContent(c); return r.ok ? [] : r.errors; };
  assert.ok(bad((c) => { c.closingQuestions![0]!.id = "Bad id"; }).some((e) => /id must be/.test(e)));
  assert.ok(bad((c) => { c.closingQuestions![1]!.id = c.closingQuestions![0]!.id; }).some((e) => /used twice/.test(e)));
  assert.ok(bad((c) => { c.closingQuestions![0]!.prompt = ""; }).some((e) => /prompt is empty/.test(e)));
  assert.ok(bad((c) => { (c.closingQuestions![0] as { kind: string }).kind = "dropdown"; }).some((e) => /text, rank or choice/.test(e)));
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

test("answers are cleaned: a choice only if it is an option, words only where an option has a box, a ranking only when every item has its own place", () => {
  const items = Q("rank").items!;
  const qs = DEFAULT_CONTENT.closingQuestions!;
  const clean = cleanClosing(qs, {
    video: "  Yes: It would help a little.  ", noReviews: "   ", changeHome: 42, nope: "x",
    rewardsMeaning: "Ways to save money as a member", rank: [items[2], items[0], items[3], items[1]],
  });
  assert.deepEqual(clean, { video: "Yes: It would help a little.", rewardsMeaning: "Ways to save money as a member", rank: [items[2], items[0], items[3], items[1]] });
  assert.equal(cleanClosing(qs, { video: "Don't know" }).video, "Don't know");
  assert.equal(cleanClosing(qs, { video: "Don't know: hmm" }).video, undefined, "Don't know has no box, so words after it are not an answer");
  assert.equal(cleanClosing(qs, { video: "Yes:   " }).video, "Yes", "a box left empty keeps just the option");
  assert.equal(cleanClosing(qs, { video: "Maybe" }).video, undefined, "a text that is no option is dropped where there is no Other");
  assert.equal(cleanClosing(qs, { changeHome: "Other: Bigger photos" }).changeHome, "Other: Bigger photos");
  assert.equal(cleanClosing(qs, { changeHome: "Other" }).changeHome, "Other");
  assert.equal(cleanClosing(qs, { changeHome: "Bigger photos" }).changeHome, "Other: Bigger photos", "an answer typed in an earlier version is kept as Other");
  assert.equal(cleanClosing(qs, { changeHome: "Show prices sooner: extra" }).changeHome, "Other: Show prices sooner: extra", "words after an option with no box are not read as that option");
  assert.equal(cleanClosing(qs, { changeHome: "Other: " + "x".repeat(5000) }).changeHome!.length, "Other: ".length + 1500);
  assert.equal(cleanClosing(qs, { rank: [items[0], items[0], items[1], items[2]] }).rank, undefined, "a repeated item is not a ranking");
  assert.equal(cleanClosing(qs, { rank: [items[0], items[1]] }).rank, undefined, "a partial ranking is not kept");
  assert.equal(cleanClosing(qs, { rank: ["x", "y", "z", "w"] }).rank, undefined, "items must be the question's own");
});

test("content validation: choice questions need 2 to 10 distinct options, no option called Other, and follow naming real options", () => {
  const bad = (edit: (c: ReturnType<typeof structuredClone<typeof DEFAULT_CONTENT>>) => void) => { const c = structuredClone(DEFAULT_CONTENT); edit(c); const r = validateContent(c); return r.ok ? [] : r.errors; };
  assert.ok(bad((c) => { c.closingQuestions![0]!.options = ["Only one"]; }).some((e) => /2 to 10 options/.test(e)));
  assert.ok(bad((c) => { c.closingQuestions![0]!.options = ["a", "a"]; }).some((e) => /repeated option/.test(e)));
  assert.ok(bad((c) => { c.closingQuestions![2]!.options = ["a", "Other"]; }).some((e) => /cannot include "Other"/.test(e)));
  assert.ok(bad((c) => { c.closingQuestions![0]!.follow = { Maybe: "Why?" }; }).some((e) => /not one of the options/.test(e)));
});

test("the closing action stores the cleaned answers at the hand-back screen only, and leaves the phase alone", () => {
  const s = atHandBack();
  assert.equal(s.phase, "handBack");
  assert.equal(s.closing, undefined);
  const done = reduce(s, { type: "closing", at: T0 + 10_000, answers: { video: " Don't know ", bogus: "x" } });
  assert.deepEqual(done.closing, { video: "Don't know" });
  assert.equal(done.phase, "handBack");
  const blank = reduce(s, { type: "closing", at: T0 + 10_000, answers: {} });
  assert.deepEqual(blank.closing, {}, "skipping every question still marks the screen as seen");
  assert.throws(() => reduce(createSession({ id: "x", now: T0, participantId: "P1", content: DEFAULT_CONTENT }), { type: "closing", at: T0, answers: {} }), /not allowed/);
  const ended = reduce(done, { type: "complete", at: T0 + 11_000, notes: "" });
  assert.deepEqual(ended.closing, { video: "Don't know" }, "ending the session keeps them");
});

test("closing answers survive export and import, and forged ones are dropped", () => {
  const items = Q("rank").items!;
  let s = atHandBack();
  s = reduce(s, { type: "closing", at: T0 + 10_000, answers: { video: "Yes: A video would help.", rank: [items[1], items[0], items[2], items[3]] } });
  s = reduce(s, { type: "complete", at: T0 + 11_000, notes: "" });
  const back = parseImport(toJsonBundle([s], DEFAULT_CONTENT, "x"));
  assert.equal(back.rejected.length, 0);
  assert.deepEqual(back.sessions[0]!.closing, s.closing);
  const raw = JSON.parse(toJsonBundle([s], DEFAULT_CONTENT, "x")).sessions[0];
  raw.closing = { video: "Yes: ok", rank: ["a", "b"], hacked: "x", changeHome: { evil: true } };
  assert.deepEqual(sanitiseSession(raw)!.closing, { video: "Yes: ok" });
  delete raw.closing;
  assert.equal(sanitiseSession(raw)!.closing, undefined, "a file without them stays without them");
});

test("closing answers reach the CSV and the Markdown summary", () => {
  const items = Q("rank").items!;
  let s = atHandBack();
  s = reduce(s, { type: "closing", at: T0 + 10_000, answers: { video: "Yes: A video would help.", rank: [items[1], items[0], items[2], items[3]], changeHome: "Show prices sooner" } });
  s = reduce(s, { type: "complete", at: T0 + 11_000, notes: "" });
  const csv = runsToCsv([s]);
  assert.match(csv.split("\r\n")[0]!, /,closing_answers\r?$/);
  assert.match(csv, /video=Yes: A video would help\.; rank=The CPTG Certified Pure Tested Grade mark > Customer reviews > /);
  assert.match(csv, /changeHome=Show prices sooner/);
  const md = ledgerMarkdown([s], "x");
  assert.match(md, /## Closing questions/);
  assert.match(md, /SR1: Yes: A video would help\./);
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
  const v = validateContent(old);
  assert.ok(v.ok);
  const session = createSession({ id: "old", now: T0, participantId: "SR2", selfRun: true, content: v.content });
  const st = createStore(memoryBacking(), () => 1);
  st.saveSession(session);
  assert.equal(st.loadSessions().sessions[0]!.content.closingQuestions!.length, 7);
});

test("a saved copy of version 9 (typed closing answers), and a session begun on it, take the multiple choice questions", () => {
  const old = JSON.parse(readFileSync(new URL("./fixtures/combined-default-v9.json", import.meta.url), "utf8"));
  assert.equal(old.closingQuestions.find((q: { id: string }) => q.id === "changeHome").kind, "text", "the fixture is the typed version");
  const backing = memoryBacking({ "wc.v1.content": JSON.stringify(old) });
  const loaded = createStore(backing, () => 1).loadContent();
  assert.equal(loaded.closingQuestions!.find((q) => q.id === "changeHome")!.kind, "choice");
  assert.equal(backing.getItem("wc.v1.content"), null);
  const v = validateContent(old);
  assert.ok(v.ok);
  const session = createSession({ id: "v9", now: T0, participantId: "SR9", selfRun: true, content: v.content });
  const st = createStore(memoryBacking(), () => 1);
  st.saveSession(session);
  assert.equal(st.loadSessions().sessions[0]!.content.closingQuestions!.find((q) => q.id === "video")!.kind, "choice");
});

test("a saved copy of version 10 (promo bar still shown) is replaced by the current default", () => {
  const old = JSON.parse(readFileSync(new URL("./fixtures/combined-default-v10.json", import.meta.url), "utf8"));
  assert.match(old.tasks.find((t: { id: string }) => t.id === "C1").watchFor, /promo banner/, "the fixture is the version that mentions the promo bar");
  const backing = memoryBacking({ "wc.v1.content": JSON.stringify(old) });
  const loaded = createStore(backing, () => 1).loadContent();
  assert.doesNotMatch(loaded.tasks.find((t) => t.id === "C1")!.watchFor, /promo banner/);
  assert.equal(backing.getItem("wc.v1.content"), null);
});

test("a saved copy of version 11 (C9 notes say T1) is replaced by the current default", () => {
  const old = JSON.parse(readFileSync(new URL("./fixtures/combined-default-v11.json", import.meta.url), "utf8"));
  assert.match(old.tasks.find((t: { title: string }) => t.title === "Cough").needBack.join(" "), /Compare with T1/, "the fixture is the version that names T1");
  const backing = memoryBacking({ "wc.v1.content": JSON.stringify(old) });
  const loaded = createStore(backing, () => 1).loadContent();
  assert.match(loaded.tasks.find((t) => t.title === "Cough")!.needBack.join(" "), /Compare with C9/);
  assert.equal(backing.getItem("wc.v1.content"), null);
});
