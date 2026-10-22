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
