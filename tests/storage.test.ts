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

test("the moderator tool always uses the shipped test: a copy saved by the removed Content tab, good or garbage, is deleted and never used", () => {
  const garbage = memoryBacking({ "wc.v1.content": "garbage" });
  assert.equal(createStore(garbage, () => 1).loadContent().version, DEFAULT_CONTENT.version);
  assert.equal(garbage.getItem("wc.v1.content"), null);
  const edited = nextContent(NAVIGATION_CONTENT, { ...NAVIGATION_CONTENT, tasks: NAVIGATION_CONTENT.tasks.slice(0, 3) }, "2026-10-14T10:00:00Z");
  const saved = memoryBacking({ "wc.v1.content": JSON.stringify(edited) });
  const loaded = createStore(saved, () => 1).loadContent();
  assert.equal(loaded.tasks.length, DEFAULT_CONTENT.tasks.length, "an edited or navigation-only copy is not used");
  assert.equal(saved.getItem("wc.v1.content"), null);
  assert.equal(createStore(memoryBacking(), () => 1).loadContent(), DEFAULT_CONTENT);
});

test("removing a session removes it", () => {
  const store = createStore(memoryBacking(), () => 1);
  store.saveSession(mk("s1"));
  store.removeSession("s1");
  assert.equal(store.loadSessions().sessions.length, 0);
});

test("a saved copy of an earlier shipped default is removed and the current default is used", async () => {
  const { readFileSync } = await import("node:fs");
  for (const f of ["combined-default-2026-10-22.json", "combined-default-v8.json", "combined-default-v13.json"]) {
    const old = JSON.parse(readFileSync(new URL("./fixtures/" + f, import.meta.url), "utf8"));
    const stale = memoryBacking({ "wc.v1.content": JSON.stringify(old) });
    const loaded = createStore(stale, () => 1).loadContent();
    assert.equal(loaded.version, DEFAULT_CONTENT.version, f);
    assert.doesNotMatch(loaded.tasks.find((t) => t.id === "C8")!.scenario, /buy this/, f);
    assert.doesNotMatch(loaded.tasks.find((t) => t.id === "C4")!.scenario, /Lavender/, f);
    assert.equal(stale.getItem("wc.v1.content"), null, f);
  }
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
  assert.equal(by("C3").scenario, DEFAULT_CONTENT.tasks.find((t) => t.id === "C3")!.scenario, "C3 had not started, and kept its title");
  assert.match(by("C5").scenario, /Have a look around/, "C5 here is the old What makes you sure: its title is not the new C5's, so it is left as it was and never given another task's wording");
  assert.equal(by("C7").primary[0]!.zone, "option-account", "targets are untouched");
  assert.deepEqual(loaded!.order, s.order);
  assert.equal(loaded!.runs.length, 1);
  // A session on the current default is returned as it is.
  const cur = createSession({ id: "cur", now: 1000, participantId: "P2", content: DEFAULT_CONTENT });
  store.saveSession(cur);
  assert.deepEqual(store.loadSessions().sessions.find((x) => x.id === "cur")!.content.tasks, DEFAULT_CONTENT.tasks.map((x) => ({ ...x })));
});


test("clearAll removes every saved session and the saved content, and nothing else", () => {
  const backing = memoryBacking({ "wc.v1.theme": "dark", "other.key": "keep" });
  const store = createStore(backing, () => 1);
  store.saveSession(mk("a")); store.saveSession(mk("b"));
  backing.setItem("wc.v1.content", JSON.stringify({ ...DEFAULT_CONTENT, version: 9 }));
  assert.equal(store.loadSessions().sessions.length, 2);
  store.clearAll();
  assert.equal(store.loadSessions().sessions.length, 0);
  assert.equal(store.loadContent().version, DEFAULT_CONTENT.version, "the shipped default is back");
  assert.equal(backing.getItem("wc.v1.content"), null);
  assert.equal(backing.getItem("wc.v1.theme"), "dark", "preferences are not touched");
  assert.equal(backing.getItem("other.key"), "keep");
});
