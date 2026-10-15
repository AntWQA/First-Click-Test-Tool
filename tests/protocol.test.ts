import { test } from "node:test";
import assert from "node:assert/strict";
import { BREAKPOINTS, parseProtoEnvelope } from "../src/shared/protocol.ts";

const wrap = (msg: unknown, nonce = "n1") => ({ source: "wc-proto", nonce, msg });

test("a valid message is accepted and rebuilt from known fields only", () => {
  const m = parseProtoEnvelope(wrap({ type: "click", at: 12.5, kind: "nav-leaf", href: "/shop", x: 3, y: 4, ends: true, extra: "ignored" }), "n1");
  assert.deepEqual(m, { type: "click", at: 12.5, kind: "nav-leaf", href: "/shop", section: undefined, column: undefined, label: undefined, testid: undefined, x: 3, y: 4, ends: true });
});

test("the wrong nonce, the wrong source or a missing message is rejected", () => {
  assert.equal(parseProtoEnvelope(wrap({ type: "ready", at: 0, w: 1, h: 1 }, "other"), "n1"), null);
  assert.equal(parseProtoEnvelope({ source: "someone-else", nonce: "n1", msg: { type: "ready", at: 0, w: 1, h: 1 } }, "n1"), null);
  assert.equal(parseProtoEnvelope({ source: "wc-proto", nonce: "n1" }, "n1"), null);
  for (const junk of [null, undefined, 3, "x", []]) assert.equal(parseProtoEnvelope(junk, "n1"), null);
});

test("malformed messages are rejected: unknown type, bad kind, missing or negative time, non-numeric coordinates", () => {
  assert.equal(parseProtoEnvelope(wrap({ type: "launch", at: 1 }), "n1"), null);
  assert.equal(parseProtoEnvelope(wrap({ type: "click", at: 1, kind: "teleport", x: 1, y: 1, ends: false }), "n1"), null);
  assert.equal(parseProtoEnvelope(wrap({ type: "ready", w: 1, h: 1 }), "n1"), null);
  assert.equal(parseProtoEnvelope(wrap({ type: "ready", at: -1, w: 1, h: 1 }), "n1"), null);
  assert.equal(parseProtoEnvelope(wrap({ type: "click", at: 1, kind: "other", x: "1", y: 1, ends: false }), "n1"), null);
  assert.equal(parseProtoEnvelope(wrap({ type: "ready", at: Number.NaN, w: 1, h: 1 }), "n1"), null);
});

test("long text is capped", () => {
  const m = parseProtoEnvelope(wrap({ type: "search-submit", at: 1, query: "q".repeat(9000) }), "n1");
  assert.equal(m && m.type === "search-submit" ? m.query.length : 0, 200);
});

test("menu messages validate their surface and way of opening", () => {
  assert.ok(parseProtoEnvelope(wrap({ type: "menu-open", at: 1, section: "shop", surface: "mega", via: "hover" }), "n1"));
  assert.equal(parseProtoEnvelope(wrap({ type: "menu-open", at: 1, section: "shop", surface: "moon", via: "hover" }), "n1"), null);
  assert.equal(parseProtoEnvelope(wrap({ type: "menu-open", at: 1, section: "shop", surface: "mega", via: "telepathy" }), "n1"), null);
});

test("breakpoints are the three agreed frames, and tablet and mobile report taps", () => {
  assert.deepEqual(Object.entries(BREAKPOINTS).map(([k, v]) => [k, v.width, v.height, v.input]), [["desktop", 1440, 1024, "click"], ["tablet", 768, 1024, "tap"], ["mobile", 402, 874, "tap"]]);
});

test("the moderator key chord is a valid message with nothing else in it", () => {
  assert.deepEqual(parseProtoEnvelope(wrap({ type: "moderator-key", at: 5, extra: "ignored" }), "n1"), { type: "moderator-key", at: 5 });
  assert.equal(parseProtoEnvelope(wrap({ type: "moderator-key" }), "n1"), null);
});
