import { test } from "node:test";
import assert from "node:assert/strict";
import { COMBINED_TASKS, DEFAULT_CONTENT, NAVIGATION_CONTENT } from "../src/shell/domain/tasks.ts";
import { validateContent } from "../src/shell/domain/content.ts";
import { arrivalFor, deviceFor, sessionOrder } from "../src/shell/domain/order.ts";
import { suggest } from "../src/shell/domain/scoring.ts";
import { createSession, currentRun, effective, reduce, reserveTasksLeft, sessionDevice, leadInFor } from "../src/shell/domain/session.ts";
import type { Action, Session } from "../src/shell/domain/session.ts";
import { ledger } from "../src/shell/domain/ledger.ts";
import { ledgerMarkdown, parseImport, runsToCsv, sanitiseSession, toJsonBundle, CSV_COLUMNS } from "../src/shell/domain/exports.ts";
import { reviewImport } from "../src/shell/domain/importReview.ts";
import { click, leaf, open, ready } from "./helpers.ts";

const T0 = 1_700_000_000_000;
const task = (id: string) => DEFAULT_CONTENT.tasks.find((t) => t.id === id)!;
const zoneClick = (zone: string, at: number, kind: "other" | "nav-top" | "nav-leaf" = "other", extra: object = {}) => click(kind, at, { zone, ...extra });
const apply = (s: Session, ...actions: Action[]) => actions.reduce(reduce, s);
const ids = (s: Session) => s.order;

test("the default content is the combined test: 11 core tasks, 2 reserves, 34 task minutes, valid and without em dashes", () => {
  assert.equal(validateContent(DEFAULT_CONTENT).ok, true);
  assert.deepEqual(COMBINED_TASKS.filter((t) => !t.reserve).map((t) => t.id), ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11"]);
  assert.deepEqual(COMBINED_TASKS.filter((t) => t.reserve).map((t) => t.id), ["R1", "R2"]);
  const core = COMBINED_TASKS.filter((t) => !t.reserve).reduce((n, t) => n + t.minutes, 0);
  assert.equal(core, 34, "34 minutes of tasks plus 4 welcome, 4 debrief and 2 buffer make the plan's 44 core minutes");
  assert.ok(!JSON.stringify(DEFAULT_CONTENT).includes("—"));
  assert.equal(DEFAULT_CONTENT.devicePerParticipant, true);
  assert.equal((DEFAULT_CONTENT.debrief ?? []).length, 2, "the moderator's spoken debrief is two follow-ups now");
  assert.match(DEFAULT_CONTENT.debrief![0]!, /already answered the closing questions on screen/);
  assert.ok(!DEFAULT_CONTENT.debrief!.join(" ").includes("Rank four cards"), "it no longer repeats the questions the participant answers on screen");
});

test("the four navigation tasks are the plan's high-risk tasks, with their original targets", () => {
  assert.deepEqual(COMBINED_TASKS.filter((t) => t.block === "navigation").map((t) => t.id), ["C8", "C9", "C10", "C11"]);
  assert.equal(task("C8").primary[0]!.href, "/shop/goal/sleep-solutions");
  assert.equal(task("C9").primary[0]!.href, "/shop/goal/respiratory-solutions");
  assert.equal(task("C10").primary[0]!.href, "/rewards/wholesale-membership");
  assert.equal(task("C11").primary[0]!.href, "/learn/business/business-opportunity");
  assert.equal(task("C9").apartFrom, "C8");
});

test("content validation: kinds, zones, codes, start pages and apartFrom are checked", () => {
  const base = () => structuredClone(DEFAULT_CONTENT);
  const bad = (edit: (c: ReturnType<typeof base>) => void) => { const c = base(); edit(c); const r = validateContent(c); return r.ok ? [] : r.errors; };
  assert.ok(bad((c) => { c.tasks[0]!.kind = "banana" as never; }).some((e) => /kind/.test(e)));
  assert.ok(bad((c) => { c.tasks[1]!.primary = [{ zone: "Bad Zone" }]; }).some((e) => /zone/.test(e)));
  assert.ok(bad((c) => { c.tasks[0]!.primary = [{ href: "/shop" }]; }).some((e) => /observe task has no targets/.test(e)));
  assert.ok(bad((c) => { c.tasks[7]!.primary = [{ zone: "quality" }]; }).some((e) => /only a click task/.test(e)));
  assert.ok(bad((c) => { c.tasks[1]!.primary = [{ href: "/shop", zone: "quality" }]; }).some((e) => /not both/.test(e)));
  assert.ok(bad((c) => { c.tasks[0]!.codes.push({ ...c.tasks[0]!.codes[0]! }); }).some((e) => /used twice/.test(e)));
  assert.ok(bad((c) => { c.tasks[0]!.codes[0]!.options = ["only one"]; }).some((e) => /2 to 12/.test(e)));
  assert.ok(bad((c) => { c.tasks[3]!.start = "https://example.com"; }).some((e) => /start must be a path/.test(e)));
  assert.ok(bad((c) => { c.tasks[8]!.apartFrom = "C99"; }).some((e) => /apartFrom/.test(e)));
  assert.ok(bad((c) => { c.tasks[0]!.minutes = 99; }).some((e) => /minutes/.test(e)));
  assert.ok(bad((c) => { c.tasks[0]!.scenario = "a — b"; }).some((e) => /em dash/.test(e)));
  assert.ok(bad((c) => { c.debrief = ["x — y"]; }).some((e) => /debrief contains an em dash/.test(e)));
  assert.ok(bad((c) => { c.tasks[1]!.primary = []; }).some((e) => /needs at least one target/.test(e)), "a click task still needs a target");
});

test("tasks written before the combined test read as navigation tasks starting on the homepage", () => {
  const legacy = JSON.parse(JSON.stringify(NAVIGATION_CONTENT));
  for (const t of legacy.tasks) for (const k of ["kind", "block", "minutes", "start", "questions", "leadIns", "codes", "confidence", "notesPrompt", "apartFrom", "readsMenu"]) delete t[k];
  const r = validateContent(legacy);
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.content.tasks[0]!.kind, "nav"); assert.equal(r.content.tasks[0]!.start, "/"); assert.equal(r.content.tasks[0]!.block, "navigation"); assert.equal(r.content.devicePerParticipant, undefined); }
});

test("order: the homepage and product page tasks stay in order, the navigation tasks follow, and Sleep and Cough are never adjacent", () => {
  for (let i = 1; i <= 60; i++) {
    const o = sessionOrder(DEFAULT_CONTENT, "P" + i, undefined, deviceFor(DEFAULT_CONTENT, "P" + i));
    assert.deepEqual(o.slice(0, 7), ["C1", "C2", "C3", "C4", "C5", "C6", "C7"], "P" + i);
    assert.deepEqual([...o.slice(7)].sort(), ["C10", "C11", "C8", "C9"]);
    assert.notEqual(Math.abs(o.indexOf("C8") - o.indexOf("C9")), 1, `P${i} has Sleep and Cough adjacent: ${o.join(",")}`);
  }
  assert.deepEqual(sessionOrder(DEFAULT_CONTENT, "P5"), sessionOrder(DEFAULT_CONTENT, "P5"), "repeatable for one participant");
});

test("devices: odd numbers desktop and even numbers mobile, six and six across twelve, and every task runs on the session device", () => {
  const devices = Array.from({ length: 12 }, (_, i) => deviceFor(DEFAULT_CONTENT, "P" + (i + 1)));
  assert.equal(devices.filter((d) => d === "desktop").length, 6);
  assert.equal(devices.filter((d) => d === "mobile").length, 6);
  assert.equal(deviceFor(NAVIGATION_CONTENT, "P1"), undefined, "the navigation-only test rotates devices per task");
  for (const id of ["P1", "P2"]) {
    const s = createSession({ id: "s" + id, now: T0, participantId: id, content: DEFAULT_CONTENT });
    assert.ok(Object.values(s.plan).every((bp) => bp === sessionDevice(s)), id);
  }
  const over = apply(createSession({ id: "o", now: T0, participantId: "P1", content: DEFAULT_CONTENT }), { type: "setup", at: T0, patch: { deviceOverride: "mobile" } });
  assert.ok(Object.values(over.plan).every((bp) => bp === "mobile"), "the moderator can choose the device");
});

test("arrival routes: homepage, Google, shared link in turn, four each across twelve, two on each device, and never Google for an existing customer", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ route: arrivalFor("P" + (i + 1), ""), device: deviceFor(DEFAULT_CONTENT, "P" + (i + 1)) }));
  for (const route of ["homepage", "google", "shared"]) {
    assert.equal(rows.filter((r) => r.route === route).length, 4, route);
    assert.equal(rows.filter((r) => r.route === route && r.device === "desktop").length, 2, route + " desktop");
    assert.equal(rows.filter((r) => r.route === route && r.device === "mobile").length, 2, route + " mobile");
  }
  assert.equal(arrivalFor("P2", ""), "google");
  assert.equal(arrivalFor("P2", "WA"), "shared");
  assert.equal(arrivalFor("P2", "WC"), "shared");
  assert.equal(arrivalFor("P2", "non-member"), "google");
  const s = createSession({ id: "a", now: T0, participantId: "P2", content: DEFAULT_CONTENT });
  assert.equal(s.arrival, "google");
  assert.match(leadInFor(task("C4"), s), /searched for MetaPWR Advantage/);
  assert.equal(leadInFor(task("C4"), { arrival: "shared" }), "A friend sent you a link to the dōTERRA MetaPWR Advantage page and said: \"MetaPWR Advantage is the one I take.\"");
  assert.equal(leadInFor(task("C1"), s), "", "a task with no arrival has no lead-in");
});

test("wording: what a participant reads before the page appears names the item, never 'this', 'these' or 'here'", () => {
  const read = (t: (typeof COMBINED_TASKS)[number]) => [t.scenario, ...t.questions, t.confidence, t.notesPrompt, ...Object.values(t.leadIns ?? {})].join(" ");
  for (const t of COMBINED_TASKS) assert.doesNotMatch(read(t), /\b(this|these|that one|here|above|below)\b/i, `${t.id}: ${read(t)}`);
  for (const id of ["C3", "C4", "C5", "C6", "C7"]) assert.match(read(task(id)), /dōTERRA MetaPWR Advantage/, id);
  assert.match(read(task("R2")), /PB Restore/);
  assert.match(task("C5").confidence, /buying dōTERRA MetaPWR Advantage\?$/);
  assert.match(task("R2").confidence, /buying PB Restore\?$/);
});

test("reserves: the mobile-only carousel reserve is offered to mobile participants only", () => {
  const desktop = createSession({ id: "d", now: T0, participantId: "P1", content: DEFAULT_CONTENT });
  const mobile = createSession({ id: "m", now: T0, participantId: "P2", content: DEFAULT_CONTENT });
  assert.deepEqual(reserveTasksLeft(desktop).map((t) => t.id), ["R2"]);
  assert.deepEqual(reserveTasksLeft(mobile).map((t) => t.id), ["R1", "R2"]);
  assert.ok(!ids(desktop).includes("R1"));
});

test("scoring: an observe task scores nothing, and keeps where the first click landed", () => {
  const sug = suggest(task("C1"), [ready(0), zoneClick("hero", 400)], "found");
  assert.equal(sug.tier, "R");
  assert.equal(sug.level1, null);
  assert.equal(sug.level2, null);
  assert.equal(sug.firstZone, "hero");
  assert.equal(suggest(task("C1"), [ready(0)], "found").firstZone, null);
});

test("scoring: a click task is scored on the FIRST click, by zone, with header routes and recorded-separately choices", () => {
  const c2 = task("C2");
  assert.equal(suggest(c2, [ready(0), zoneClick("quality", 500)], "found").tier, "P");
  assert.equal(suggest(c2, [ready(0), zoneClick("why-value-cards", 500)], "found").tier, "A");
  assert.equal(suggest(c2, [ready(0), zoneClick("nav-learn", 500, "nav-top", { section: "learn" })], "found").tier, "A", "Header > Learn is the agreed route off the page");
  const x = suggest(c2, [ready(0), zoneClick("offers", 500), zoneClick("quality", 900)], "found");
  assert.equal(x.tier, "X", "the first click decides: offers first, then the quality block, is a miss");
  assert.deepEqual(x.zonesClicked, ["offers", "quality"]);
  const none = suggest(c2, [ready(0)], "gave-up");
  assert.equal(none.tier, "X");
  assert.equal(none.code, 6);
  const c7 = task("C7");
  assert.equal(suggest(c7, [ready(0), zoneClick("option-account", 400)], "found").tier, "P");
  assert.equal(suggest(c7, [ready(0), zoneClick("add-to-cart", 400)], "found").tier, "P");
  assert.equal(suggest(c7, [ready(0), zoneClick("quantity", 400)], "found").tier, "A");
  assert.equal(suggest(c7, [ready(0), zoneClick("option-one-time", 400)], "found").tier, "S", "either option is a valid choice, recorded on its own");
  assert.equal(suggest(task("C6"), [ready(0), zoneClick("shipping", 400)], "found").tier, "P");
});

test("scoring: the navigation tasks inside the combined test still score on two levels", () => {
  const sug = suggest(task("C8"), [ready(0), open("shop", 200), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 1500)], "destination");
  assert.equal(sug.tier, "P");
  assert.equal(sug.level1, true);
  assert.equal(sug.level2, true);
});

/** Runs one task of a started session through begin, events, end and rate. */
function run(s: Session, events: Parameters<typeof reduce>[1] extends infer A ? never : never, ..._: never[]): Session { return s; }
void run;
function doTask(s: Session, events: ReturnType<typeof ready>[], ease: number, confidence?: number | null): Session {
  let x = reduce(s, { type: "present", at: T0 + 10, runId: "r" + (s.runs.length + 1) });
  x = reduce(x, { type: "begin", at: T0 + 2000, scale: 1 });
  for (const event of events) x = reduce(x, { type: "event", event });
  x = reduce(x, { type: "end", at: T0 + 9000, reason: "found" });
  return reduce(x, { type: "rate", at: T0 + 10000, ease, notes: "n", confidence });
}
const started = (id = "P1"): Session => reduce(createSession({ id: "s" + id, now: T0, participantId: id, content: DEFAULT_CONTENT }), { type: "start", at: T0 });

test("a confidence rating is required when the task asks one, 1 to 7, and ignored when it does not", () => {
  const s = started();
  assert.equal(currentRun(s), undefined);
  assert.equal(s.order[0], "C1");
  const x = reduce(reduce(reduce(reduce(s, { type: "present", at: T0, runId: "a" }), { type: "begin", at: T0 + 1, scale: 1 }), { type: "event", event: ready(0) }), { type: "end", at: T0 + 2, reason: "found" });
  assert.throws(() => reduce(x, { type: "rate", at: T0 + 3, ease: 5, notes: "" }), /not allowed/);
  assert.throws(() => reduce(x, { type: "rate", at: T0 + 3, ease: 5, notes: "", confidence: 0 }), /not allowed/);
  assert.throws(() => reduce(x, { type: "rate", at: T0 + 3, ease: 5, notes: "", confidence: 8 }), /not allowed/);
  assert.throws(() => reduce(x, { type: "rate", at: T0 + 3, ease: 5, notes: "", confidence: 4.5 }), /not allowed/);
  const done = reduce(x, { type: "rate", at: T0 + 3, ease: 5, notes: "", confidence: 6 });
  assert.equal(done.runs[0]!.confidence, 6);
  // C3 asks no confidence: any value sent with it is dropped.
  let y = done;
  y = doTask(y, [ready(0)], 5, 5);          // C2 asks one
  y = doTask(y, [ready(0)], 5, 3);          // C3 does not: the 3 is ignored
  assert.equal(y.runs[2]!.taskId, "C3");
  assert.equal(y.runs[2]!.confidence, null);
});

test("coded answers, doubt and confidence reach the ledger, the CSV and the Markdown summary", () => {
  let s = started();
  s = doTask(s, [ready(0)], 6, 5);   // C1
  s = reduce(s, { type: "reviewRun", at: T0, runId: currentRun(s)!.runId, patch: { codes: { sells: "Correct", different: "Testing or purity" }, doubtZone: "hero", doubt: "wanted proof" } });
  assert.equal(effective(currentRun(s)!).tier, "R");
  const row = ledger([s]).find((t) => t.taskId === "C1")!;
  assert.deepEqual(row.coded.sells, { Correct: 1 });
  assert.deepEqual(row.coded.different, { "Testing or purity": 1 });
  assert.equal(row.meanConfidence, 5);
  assert.equal(row.doubts, 1);
  assert.equal(row.kind, "observe");
  const csv = runsToCsv([s]);
  for (const col of ["arrival", "first_zone", "confidence", "coded_answers", "doubt_zone", "doubt"]) assert.ok(CSV_COLUMNS.includes(col as never), col);
  assert.match(csv, /sells=Correct; different=Testing or purity/);
  assert.match(ledgerMarkdown([s], "x"), /Coded answers, first click zones and confidence/);
  assert.match(ledgerMarkdown([s], "x"), /What it sells: Correct 1/);
});

test("a click task tallies where first clicks landed", () => {
  let s = started();
  s = doTask(s, [ready(0)], 5, 5);           // C1
  s = doTask(s, [ready(0), zoneClick("quality", 400)], 5, 5);   // C2
  const row = ledger([s]).find((t) => t.taskId === "C2")!;
  assert.deepEqual(row.zones, { quality: 1 });
  assert.equal(row.level2.hits, 1);
});

test("import: the new fields round-trip, codes that are not options are dropped, and a participant file carries no moderator codes", () => {
  let s = started();
  s = doTask(s, [ready(0)], 6, 5);
  s = reduce(s, { type: "reviewRun", at: T0, runId: currentRun(s)!.runId, patch: { codes: { sells: "Correct" }, doubtZone: "hero" } });
  const back = parseImport(toJsonBundle([s], DEFAULT_CONTENT, "x"));
  assert.equal(back.rejected.length, 0);
  const r = back.sessions[0]!.runs[0]!;
  assert.equal(r.confidence, 5);
  assert.deepEqual(r.moderator.codes, { sells: "Correct" });
  assert.equal(r.moderator.doubtZone, "hero");
  assert.equal(back.sessions[0]!.arrival, s.arrival);
  const raw = JSON.parse(toJsonBundle([s], DEFAULT_CONTENT, "x")).sessions[0];
  raw.runs[0].moderator.codes = { sells: "Hacked", nonsense: "x", different: "Testing or purity" };
  raw.runs[0].confidence = 99;
  const forged = sanitiseSession(raw)!;
  assert.deepEqual(forged.runs[0]!.moderator.codes, { different: "Testing or purity" });
  assert.equal(forged.runs[0]!.confidence, null);
  const self = JSON.parse(toJsonBundle([s], DEFAULT_CONTENT, "x")).sessions[0];
  self.selfRun = true; self.participantId = "P7";
  const fromFile = sanitiseSession(self)!;
  assert.deepEqual(fromFile.runs[0]!.moderator.codes, {}, "a participant has no coded answers");
  assert.equal(fromFile.runs[0]!.confidence, 5, "the participant's own confidence rating is kept");
  const [item] = reviewImport([], [fromFile], DEFAULT_CONTENT);
  assert.ok(item!.session.runs.length === 1);
});

test("a session started before the combined test (no arrival or device fields) still loads", () => {
  const nav = createSession({ id: "n", now: T0, participantId: "P3", content: NAVIGATION_CONTENT });
  const raw = JSON.parse(JSON.stringify(nav));
  delete raw.arrival;
  for (const r of raw.runs) delete r.confidence;
  const s = sanitiseSession(raw);
  assert.ok(s);
  assert.equal(s!.arrival, "shared", "P3 arrives by shared link");
  assert.equal(s!.order.length, 12);
});
