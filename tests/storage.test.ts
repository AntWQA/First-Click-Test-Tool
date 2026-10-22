import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONTENT, NAVIGATION_CONTENT } from "../src/shell/domain/tasks.ts";
import { createSession } from "../src/shell/domain/session.ts";
import { createStore, memoryBacking } from "../src/shell/domain/storage.ts";
import type { Backing } from "../src/shell/domain/storage.ts";
import { nextContent } from "../src/shell/domain/content.ts";

const mk = (id: string) => createSession({ id, now: 1000, participantId: "P1", content: NAVIGATION_CONTENT });

test("sessions survive a reload (a new store over the same backing)", () => {
  const backing = memoryBacking();
  const a = createStore(backing, () => 5);
  assert.deepEqual(a.saveSession(mk("s1")), { ok: true, at: 5 });
  assert.equal(a.lastSavedAt, 5);
  const b = createStore(backing, () => 6);
  assert.equal(b.loadSessions().sessions[0]!.id, "s1");
});

test("a full disk is reported as quota, not swallowed", () => {
  const full: Backing = { ...memoryBacking(), setItem: () => { const e = new Error("full"); e.name = "QuotaExceededError"; throw e; } };
  assert.deepEqual(createStore(full, () => 1).saveSession(mk("s1")), { ok: false, reason: "quota" });
});

test("a write the browser accepted but did not keep is caught by the verify step", () => {
  const lossy: Backing = { ...memoryBacking(), setItem: () => undefined };
  assert.deepEqual(createStore(lossy, () => 1).saveSession(mk("s1")), { ok: false, reason: "verify" });
});

test("with no storage at all the store says so and every save fails loudly", () => {
  const s = createStore(null, () => 1);
  assert.equal(s.persistent, false);
  assert.deepEqual(s.saveSession(mk("s1")), { ok: false, reason: "unavailable" });
  assert.deepEqual(s.loadSessions(), { sessions: [], skipped: 0 });
});

test("corrupt entries are skipped and counted, and do not stop good ones loading", () => {
  const backing = memoryBacking({ "wc.v1.session.bad": "{not json", "wc.v1.session.worse": '{"schemaVersion":9}' });
  const store = createStore(backing, () => 1);
  store.saveSession(mk("good"));
  const r = store.loadSessions();
  assert.equal(r.sessions.length, 1);
  assert.equal(r.skipped, 2);
});

test("content falls back to the defaults when missing or invalid, and a saved edit becomes the next version", () => {
  const backing = memoryBacking({ "wc.v1.content": "garbage" });
  const store = createStore(backing, () => 1);
  assert.equal(store.loadContent().version, DEFAULT_CONTENT.version);
  const edited = nextContent(NAVIGATION_CONTENT, { ...NAVIGATION_CONTENT, tasks: NAVIGATION_CONTENT.tasks.slice(0, 3) }, "2026-10-14T10:00:00Z");
  assert.equal(edited.version, NAVIGATION_CONTENT.version + 1);
  assert.equal(store.saveContent(edited).ok, true);
  assert.equal(store.loadContent().tasks.length, 3);
});

test("removing a session removes it", () => {
  const store = createStore(memoryBacking(), () => 1);
  store.saveSession(mk("s1"));
  store.removeSession("s1");
  assert.equal(store.loadSessions().sessions.length, 0);
});

test("the store says when saved content could not be read and the defaults are in use", () => {
  const clean = createStore(memoryBacking(), () => 1);
  clean.loadContent();
  assert.equal(clean.contentFellBack, false, "no saved content is not a fallback");
  const broken = createStore(memoryBacking({ "wc.v1.content": "garbage" }), () => 1);
  broken.loadContent();
  assert.equal(broken.contentFellBack, true);
});


test("a saved copy of an earlier shipped default is replaced by the current default, and an edited copy is kept", async () => {
  const { readFileSync } = await import("node:fs");
  const old = JSON.parse(readFileSync(new URL("./fixtures/combined-default-2026-10-22.json", import.meta.url), "utf8"));
  assert.match(old.tasks.find((t: { id: string }) => t.id === "C7").scenario, /buy this on the page/, "the fixture is the old wording");
  const stale = memoryBacking({ "wc.v1.content": JSON.stringify({ ...old, version: 5 }) });
  const store = createStore(stale, () => 1);
  assert.equal(store.loadContent().version, DEFAULT_CONTENT.version);
  assert.doesNotMatch(store.loadContent().tasks.find((t) => t.id === "C7")!.scenario, /buy this/);
  assert.equal(stale.getItem("wc.v1.content"), null, "the stale copy is removed, so the shipped default is followed from now on");
  assert.equal(store.contentFellBack, false);
  // A researcher's own edit to that wording is theirs: it stays.
  const edited = structuredClone(old);
  edited.tasks.find((t: { id: string }) => t.id === "C7").scenario = "There are two ways to buy on the page. Describe them.";
  const kept = createStore(memoryBacking({ "wc.v1.content": JSON.stringify(edited) }), () => 1);
  assert.match(kept.loadContent().tasks.find((t) => t.id === "C7")!.scenario, /two ways to buy/);
  // The current default is never treated as stale.
  const current = createStore(memoryBacking({ "wc.v1.content": JSON.stringify(DEFAULT_CONTENT) }), () => 1);
  assert.equal(current.loadContent().version, DEFAULT_CONTENT.version);
});


test("a session begun on an earlier default takes the current wording for tasks not yet started, and keeps what it already ran", async () => {
  const { readFileSync } = await import("node:fs");
  const { validateContent } = await import("../src/shell/domain/content.ts");
  const { reduce } = await import("../src/shell/domain/session.ts");
  const old = validateContent(JSON.parse(readFileSync(new URL("./fixtures/combined-default-2026-10-22.json", import.meta.url), "utf8")));
  assert.ok(old.ok);
  let s = createSession({ id: "old1", now: 1000, participantId: "P1", content: old.content });
  s = reduce(s, { type: "start", at: 1000 });
  s = reduce(s, { type: "present", at: 1001, runId: "r1" });
  const backing = memoryBacking();
  const store = createStore(backing, () => 1);
  store.saveSession(s);
  const [loaded] = store.loadSessions().sessions;
  const by = (id: string) => loaded!.content.tasks.find((x) => x.id === id)!;
  assert.match(by("C1").scenario, /buy this|this website|this company/, "C1 was already shown, so it keeps the words the participant read");
  assert.doesNotMatch(by("C4").scenario, /this product/, "C4 had not started");
  assert.match(by("C3").scenario, /starting from the homepage/);
  assert.equal(by("C7").primary[0]!.zone, "option-account", "targets are untouched");
  assert.deepEqual(loaded!.order, s.order);
  assert.equal(loaded!.runs.length, 1);
  // A session on the current default is returned as it is.
  const cur = createSession({ id: "cur", now: 1000, participantId: "P2", content: DEFAULT_CONTENT });
  store.saveSession(cur);
  assert.deepEqual(store.loadSessions().sessions.find((x) => x.id === "cur")!.content.tasks, DEFAULT_CONTENT.tasks.map((x) => ({ ...x })));
});
