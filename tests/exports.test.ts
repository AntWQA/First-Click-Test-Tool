import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONTENT } from "../src/shell/domain/tasks.ts";
import { createSession, reduce } from "../src/shell/domain/session.ts";
import type { Session } from "../src/shell/domain/session.ts";
import { CSV_COLUMNS, csvEscape, ledgerMarkdown, mergeSessions, parseImport, runsToCsv, sanitiseSession, toJsonBundle } from "../src/shell/domain/exports.ts";
import { leaf, open, ready } from "./helpers.ts";

const T0 = 1_700_000_000_000;

function finished(id: string, notes = "plain note"): Session {
  let s = createSession({ id, now: T0, participantId: "P1", content: DEFAULT_CONTENT });
  s = { ...s, order: ["T1"], plan: { T1: "desktop" } };
  s = reduce(s, { type: "start", at: T0 });
  s = reduce(s, { type: "present", at: T0, runId: "run_" + id });
  s = reduce(s, { type: "begin", at: T0 + 1, scale: 0.86 });
  for (const e of [ready(0), open("shop", 200), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 1500)]) s = reduce(s, { type: "event", event: e });
  s = reduce(s, { type: "end", at: T0 + 2000, reason: "destination" });
  s = reduce(s, { type: "rate", at: T0 + 2100, ease: 6, notes });
  s = reduce(s, { type: "declineReserves", at: T0 + 2150 });
  s = reduce(s, { type: "unlock", at: T0 + 2200 });
  return reduce(s, { type: "reviewRun", at: T0 + 2300, runId: "run_" + id, patch: { observed: "hovered Learn first", interpretation: "" } });
}

// A small, strict CSV reader so the test checks the output is genuinely well formed.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\r" && text[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += c;
  }
  return rows;
}

test("csvEscape quotes commas, quotes and newlines, and defuses spreadsheet formulas", () => {
  assert.equal(csvEscape("plain"), "plain");
  assert.equal(csvEscape("a,b"), '"a,b"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape("line\nbreak"), '"line\nbreak"');
  for (const bad of ["=HYPERLINK(\"x\")", "+1", "-2", "@SUM(A1)", "\tcmd"]) assert.ok(csvEscape(bad).replace(/^"/, "").startsWith("'"), bad);
  assert.equal(csvEscape(null), "");
  assert.equal(csvEscape(false), "false");
  assert.equal(csvEscape(0), "0");
});

test("the CSV has one well formed row per run with a column for every header", () => {
  const rows = parseCsv(runsToCsv([finished("a", 'He said, "I looked in Shop"\n=cmd|calc')]));
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.length, CSV_COLUMNS.length);
  assert.equal(rows[1]!.length, CSV_COLUMNS.length);
  const col = (name: string) => rows[1]![CSV_COLUMNS.indexOf(name as (typeof CSV_COLUMNS)[number])];
  assert.equal(col("tier"), "P");
  assert.equal(col("ease"), "6");
  assert.equal(col("scale"), "0.86");
  assert.equal(col("participant_notes"), 'He said, "I looked in Shop"\n=cmd|calc'.replace(/^/, ""));
});

test("JSON export imports back to the same sessions (suggestions are recomputed, not trusted)", () => {
  const original = [finished("a"), finished("b")];
  const result = parseImport(toJsonBundle(original, DEFAULT_CONTENT, "2026-10-14T12:00:00Z"));
  assert.equal(result.error, null);
  assert.deepEqual(result.rejected, []);
  // Compared as data, not as text: the import rebuilds objects with keys in its own order.
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.sessions)), JSON.parse(JSON.stringify(original)));
});

test("an imported suggestion is ignored: a tampered tier is recomputed from the raw events", () => {
  const bundle = JSON.parse(toJsonBundle([finished("a")], DEFAULT_CONTENT, "x"));
  bundle.sessions[0].runs[0].suggestion.tier = "P";
  bundle.sessions[0].runs[0].events = [{ type: "ready", at: 0, w: 1, h: 1 }];
  const s = parseImport(JSON.stringify(bundle)).sessions[0]!;
  assert.equal(s.runs[0]!.suggestion!.tier, "X");
});

test("hostile or broken imports are rejected cleanly", () => {
  assert.match(parseImport("not json").error ?? "", /not valid JSON/);
  assert.match(parseImport('{"exportVersion":2}').error ?? "", /not a Wayfinding Check export/);
  assert.match(parseImport("[1,2,3]").error ?? "", /not a Wayfinding Check export/);
  const bundle = JSON.parse(toJsonBundle([finished("a")], DEFAULT_CONTENT, "x"));
  bundle.sessions.push({ schemaVersion: 1, id: "../../evil", phase: "setup" }, "junk", null);
  const r = parseImport(JSON.stringify(bundle));
  assert.equal(r.sessions.length, 1);
  assert.equal(r.rejected.length, 3);
});

test("unknown fields, prototype pollution keys and oversize text are dropped or capped", () => {
  const raw = JSON.parse(toJsonBundle([finished("a")], DEFAULT_CONTENT, "x")).sessions[0];
  raw.__proto__ = { polluted: true };
  raw.extra = "<script>alert(1)</script>";
  raw.runs[0].participantNotes = "x".repeat(50_000);
  raw.runs[0].events.push({ type: "click", at: 5, kind: "nav-leaf", x: 1, y: 1, ends: true, label: "y".repeat(5000), href: "/shop", surprise: 1 });
  const s = sanitiseSession(raw)!;
  assert.equal(("extra" in s), false);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal(s.runs[0]!.participantNotes.length, 2000);
  const last = s.runs[0]!.events[s.runs[0]!.events.length - 1]!;
  assert.equal(last.type === "click" ? last.label!.length : 0, 200);
  assert.equal("surprise" in last, false);
});

test("a session whose task snapshot is invalid is rejected, and runs for unknown tasks are dropped", () => {
  const raw = JSON.parse(toJsonBundle([finished("a")], DEFAULT_CONTENT, "x")).sessions[0];
  // Structurally invalid (no primary target) is rejected. An unknown link is not: see the test that a snapshot stays readable after a rebuild.
  const bad = structuredClone(raw); bad.content.tasks[0].primary = [];
  assert.equal(sanitiseSession(bad), null);
  const orphan = structuredClone(raw); orphan.runs[0].taskId = "T99";
  assert.equal(sanitiseSession(orphan)!.runs.length, 0);
});

test("merging keeps the newest copy of each session and reports what changed", () => {
  const a = finished("a"), b = finished("b");
  const newerA = { ...a, updatedAt: a.updatedAt + 1000 };
  const { merged, added, updated, kept } = mergeSessions([a], [newerA, b, { ...b }]);
  assert.deepEqual([added, updated, kept], [1, 1, 1]);
  assert.equal(merged.find((s) => s.id === "a")!.updatedAt, newerA.updatedAt);
  assert.equal(mergeSessions([newerA], [a]).kept, 1);
});

test("the Markdown summary states its limits and lists every counted task", () => {
  const md = ledgerMarkdown([finished("a")], "2026-10-14");
  assert.match(md, /directional/);
  assert.match(md, /touch ability is not tested/);
  assert.match(md, /\| T1 Sleep \(high risk\) \| Desktop 1440 \| 1 \|/);
  assert.ok(!md.includes("\u2014"));
  assert.match(ledgerMarkdown([], "x"), /No counted runs yet/);
});

test("Markdown cells escape pipes so a task title cannot break a table row", () => {
  const s = finished("a");
  const piped = { ...s, content: { ...s.content, tasks: s.content.tasks.map((t) => (t.id === "T1" ? { ...t, title: "Sleep | rest" } : t)) } };
  const md = ledgerMarkdown([piped], "x");
  assert.match(md, /Sleep \\\| rest/);
  const row = md.split("\n").find((l) => l.startsWith("| T1"))!;
  assert.equal(row.replace(/\\\|/g, "").split("|").length, 13);
});

test("a hostile future timestamp is clamped so it cannot win every merge", () => {
  const raw = JSON.parse(toJsonBundle([finished("a")], DEFAULT_CONTENT, "x")).sessions[0];
  raw.updatedAt = 1e15; raw.createdAt = 1e15;
  const s = sanitiseSession(raw)!;
  assert.ok(s.updatedAt <= Date.now() + 86_400_001);
});

test("a session in a run phase with no runs is rejected rather than crashing a screen later", () => {
  for (const phase of ["task", "rating", "handBack"]) {
    const raw = JSON.parse(toJsonBundle([finished("a")], DEFAULT_CONTENT, "x")).sessions[0];
    raw.runs = []; raw.phase = phase;
    assert.equal(sanitiseSession(raw), null, phase);
  }
  const ok = JSON.parse(toJsonBundle([finished("a")], DEFAULT_CONTENT, "x")).sessions[0];
  ok.runs = []; ok.phase = "setup";
  assert.ok(sanitiseSession(ok));
});

test("a session saved while the moderator step between tasks still existed imports with that task counted and the session moved on", () => {
  for (const phase of ["handBack", "review"]) {
    const raw = JSON.parse(toJsonBundle([finished("a")], DEFAULT_CONTENT, "x")).sessions[0];
    raw.phase = phase; raw.cursor = 0; raw.runs[0].status = "rated"; raw.runs[0].moderator.reviewed = false;
    const s = sanitiseSession(raw)!;
    assert.equal(s.runs[0]!.status, "completed", phase);
    assert.equal(s.cursor, 1, phase);
    assert.equal(s.phase, "debrief", phase);
  }
  const mid = JSON.parse(toJsonBundle([finished("a")], DEFAULT_CONTENT, "x")).sessions[0];
  mid.order = ["T1", "T3"]; mid.plan = { T1: "desktop", T3: "desktop" }; mid.phase = "review"; mid.cursor = 0; mid.runs[0].status = "rated";
  const s = sanitiseSession(mid)!;
  assert.equal(s.phase, "intro");
  assert.equal(s.cursor, 1);
  // The new hand-back (all tasks done, run already completed) is left alone.
  const fresh = JSON.parse(toJsonBundle([finished("a")], DEFAULT_CONTENT, "x")).sessions[0];
  fresh.phase = "handBack"; fresh.cursor = 1;
  const f = sanitiseSession(fresh)!;
  assert.equal(f.phase, "handBack");
  assert.equal(f.cursor, 1);
});

test("a saved session stays readable after the navigation data changes: its snapshot is checked structurally only", () => {
  const raw = JSON.parse(toJsonBundle([finished("a")], DEFAULT_CONTENT, "x")).sessions[0];
  raw.content.tasks[0].primary = [{ href: "/a/link/removed/in/a/later/build" }];
  assert.ok(sanitiseSession(raw), "an old session must not be orphaned by a rebuild");
});

test("a session saved before breakpoints became per task still imports: its one breakpoint becomes the plan for every task", () => {
  const raw = JSON.parse(toJsonBundle([finished("old")], DEFAULT_CONTENT, "x")).sessions[0];
  delete raw.plan; delete raw.planOverrides; 
  raw.breakpoint = "mobile";
  for (const r of raw.runs) { delete r.breakpoint; delete r.position; }
  const s = sanitiseSession(raw)!;
  assert.ok(s);
  assert.deepEqual(s.plan, { T1: "mobile" });
  assert.equal(s.runs[0]!.breakpoint, "mobile");
  assert.equal(s.runs[0]!.position, 0);
});

test("the CSV records each run's own breakpoint and its place in the session", () => {
  const csv = runsToCsv([finished("a")]);
  const [head, row] = csv.trim().split("\r\n");
  const cols = head!.split(",");
  const cells = row!.split(",");
  assert.equal(cells[cols.indexOf("breakpoint")], "desktop");
  assert.equal(cells[cols.indexOf("position")], "1");
});

test("the self-run flag survives export and import, and appears in the CSV, so a moderator can tell the sessions apart", () => {
  const raw = JSON.parse(toJsonBundle([finished("a")], DEFAULT_CONTENT, "x")).sessions[0];
  assert.equal(sanitiseSession(raw)!.selfRun, false);
  raw.selfRun = true;
  assert.equal(sanitiseSession(raw)!.selfRun, true);
  raw.selfRun = "yes";
  assert.equal(sanitiseSession(raw)!.selfRun, false, "only a real true counts");
  const s = { ...finished("b"), selfRun: true };
  const rows = parseCsv(runsToCsv([s]));
  const col = rows[0]!.indexOf("self_run");
  assert.ok(col > 0);
  assert.equal(rows[1]![col], "true");
});
