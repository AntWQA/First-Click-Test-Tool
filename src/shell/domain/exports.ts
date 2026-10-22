import { BREAKPOINTS, BREAKPOINT_IDS, parseProtoMessage } from "../../shared/protocol.ts";
import type { Breakpoint, CapturedEvent } from "../../shared/protocol.ts";
import { validateContent } from "./content.ts";
import type { Content } from "./tasks.ts";
import { cleanClosing, closingQuestionsFor, effective, emptyModerator, MAX_EVENTS_PER_RUN } from "./session.ts";
import type { Group, Phase, Provenance, Run, RunModerator, RunStatus, Session } from "./session.ts";
import { ledger } from "./ledger.ts";
import { applyOverrides, arrivalFor, buildPlan, deviceFor } from "./order.ts";
import { ARRIVALS } from "./tasks.ts";
import type { Task } from "./tasks.ts";

import { suggest } from "./scoring.ts";
import type { EndReason, Tier, WrongClickCode } from "./scoring.ts";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const finite = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// ---------- CSV ----------

/**
 * One CSV cell. A leading = + - @ tab or carriage return would be read as a formula by a spreadsheet, so it is
 * prefixed with an apostrophe (participant notes are free text and can be anything).
 */
export function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export const CSV_COLUMNS = [
  "session_id", "participant_id", "group", "breakpoint", "input", "practice", "self_run", "task_id", "position", "attempt", "status", "content_version",
  "reading_ms", "first_interaction_ms", "duration_ms", "end_reason", "first_open_section", "level1_section", "sections_opened",
  "final_kind", "final_href", "final_section", "final_column", "via_footer", "suggested_tier", "tier", "suggested_code", "code",
  "level1", "level2", "ease", "menu_unaided_or_prompt", "scale", "window_resized", "participant_notes", "observed", "interpretation",
  "expected", "second_chance", "override_reason",
  "arrival", "first_zone", "zones_clicked", "confidence", "coded_answers", "doubt_zone", "doubt", "closing_answers",
] as const;

/** The coded answers as one cell: id=choice pairs, in the task's own order. */
const codedCell = (s: Session, r: Run): string => {
  const task = s.content.tasks.find((t) => t.id === r.taskId);
  return (task?.codes ?? []).flatMap((c) => (r.moderator.codes[c.id] ? [`${c.id}=${r.moderator.codes[c.id]}`] : [])).join("; ");
};

/** The participant's closing answers as one cell: id=answer pairs in the question order (a ranking reads item > item). The same on every row of one participant, like the arrival route. */
const closingCell = (s: Session): string => {
  if (!s.closing) return "";
  const qs = s.content.closingQuestions ?? [];
  return qs.flatMap((q) => { const a = s.closing![q.id]; return a === undefined ? [] : [`${q.id}=${Array.isArray(a) ? a.join(" > ") : a}`]; }).join("; ");
};

/** One row per run attempt, including superseded and interrupted ones (the status column says which count). */
export function runsToCsv(sessions: Session[]): string {
  const rows: string[] = [CSV_COLUMNS.join(",")];
  for (const s of sessions) for (const r of s.runs) {
    const e = effective(r), g = r.suggestion;
    rows.push([
      s.id, s.participantId, s.group, r.breakpoint, BREAKPOINTS[r.breakpoint].input, s.practice, s.selfRun, r.taskId, r.position + 1, r.attempt, r.status, s.content.version,
      r.readingMs, g?.firstInteractionMs, r.durationMs, r.end, g?.firstOpenSection, g?.levelOneSection, g?.sectionsOpened.join(" > "),
      g?.finalKind, g?.finalHref, g?.finalSection, g?.finalColumn, g?.viaFooter, g?.tier, e.tier, g?.code, e.code,
      e.level1, e.level2, r.ease, e.menu, r.scale, r.windowResized, r.participantNotes, r.moderator.observed, r.moderator.interpretation,
      r.moderator.expected, r.moderator.secondChance, r.moderator.overrideReason,
      s.arrival, g?.firstZone, g?.zonesClicked?.join(" > "), r.confidence, codedCell(s, r), r.moderator.doubtZone, r.moderator.doubt, closingCell(s),
    ].map((c) => csvEscape(c as string | number | boolean | null | undefined)).join(","));
  }
  return rows.join("\r\n") + "\r\n";
}

// ---------- JSON bundle and import ----------

export interface Bundle { exportVersion: 1; app: "wayfinding-check"; exportedAt: string; content: Content; sessions: Session[] }

export function toJsonBundle(sessions: Session[], content: Content, exportedAt: string): string {
  const bundle: Bundle = { exportVersion: 1, app: "wayfinding-check", exportedAt, content, sessions };
  return JSON.stringify(bundle, null, 2);
}

const PHASES: Phase[] = ["setup", "intro", "task", "rating", "offer", "handBack", "debrief", "ended"];
// "review" and "rated" belong to sessions saved before the moderator step between tasks was removed; they are mapped on import.
const RUN_STATUSES: RunStatus[] = ["presented", "active", "completed", "interrupted", "superseded"];
const GROUPS: Group[] = ["", "non-member", "WA", "WC"];
const TIERS: Tier[] = ["P", "A", "X", "R", "S"];
const ENDS: EndReason[] = ["destination", "found", "gave-up"];
const ID = /^[A-Za-z0-9_.-]{1,80}$/;
/** The only codes the participant edition can produce; a participant file carrying anything else is refused. */
const CODE = /^[A-Za-z0-9_.-]{1,40}$/;
/** A participant file holds one session. A backup of a whole study can hold more, but never an unbounded number. */
export const MAX_SESSIONS_PER_FILE = 100;
const DAY = 86_400_000;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Coded answers survive only when the task still asks that question and the choice is one of its options. */
function sanitiseCodes(raw: unknown, task: Task): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isRecord(raw)) return out;
  for (const c of task.codes) { const v = raw[c.id]; if (typeof v === "string" && c.options.includes(v)) out[c.id] = v; }
  return out;
}

function sanitiseModerator(raw: unknown, task: Task): RunModerator {
  const m = isRecord(raw) ? raw : {};
  const out: RunModerator = {
    menu: m.menu === "U" || m.menu === "P" ? m.menu : null,
    observed: text(m.observed, 2000), interpretation: text(m.interpretation, 2000), expected: text(m.expected, 1000),
    secondChance: text(m.secondChance, 1000), overrideReason: text(m.overrideReason, 1000),
    codes: sanitiseCodes(m.codes, task), doubtZone: text(m.doubtZone, 40), doubt: text(m.doubt, 1000), reviewed: m.reviewed === true,
  };
  if (typeof m.tier === "string" && TIERS.includes(m.tier as Tier)) out.tier = m.tier as Tier;
  if (m.code === null || (typeof m.code === "number" && Number.isInteger(m.code) && m.code >= 1 && m.code <= 6)) out.code = m.code as WrongClickCode | null;
  if (m.level1 === null || typeof m.level1 === "boolean") out.level1 = m.level1;
  return out;
}

function sanitiseRun(raw: unknown, content: Content, fallback: Breakpoint, index: number): Run | null {
  if (!isRecord(raw) || typeof raw.runId !== "string" || !ID.test(raw.runId) || typeof raw.taskId !== "string") return null;
  const task = content.tasks.find((t) => t.id === raw.taskId);
  if (!task) return null;
  const status = raw.status === "rated" ? "completed" : RUN_STATUSES.find((x) => x === raw.status);
  const attempt = finite(raw.attempt);
  // Times are epoch milliseconds: anything before 1970 or more than two days ahead is not a real time.
  const when = (v: unknown): number | null => { const n = finite(v); return n !== null && n >= 0 && n <= Date.now() + 2 * DAY ? n : null; };
  const span = (v: unknown): number | null => { const n = finite(v); return n === null ? null : clamp(n, 0, DAY); };
  const presentedAt = when(raw.presentedAt);
  if (!status || attempt === null || presentedAt === null) return null;
  const events: CapturedEvent[] = [];
  if (Array.isArray(raw.events)) for (const e of raw.events.slice(0, MAX_EVENTS_PER_RUN)) { const ev = parseProtoMessage(e); if (ev) events.push(ev); }
  const end = ENDS.find((x) => x === raw.end) ?? null;
  const ease = finite(raw.ease);
  const run: Run = {
    runId: raw.runId, taskId: task.id, attempt: clamp(Math.floor(attempt), 1, 100),
    retakeOf: typeof raw.retakeOf === "string" && ID.test(raw.retakeOf) ? raw.retakeOf : null, status,
    breakpoint: BREAKPOINT_IDS.find((b) => b === raw.breakpoint) ?? fallback, position: clamp(Math.floor(finite(raw.position) ?? index), 0, 1000),
    scale: clamp(finite(raw.scale) ?? 1, 0.1, 1), presentedAt, beginAt: when(raw.beginAt), endAt: when(raw.endAt), readingMs: span(raw.readingMs), durationMs: span(raw.durationMs),
    end, events, windowResized: raw.windowResized === true, ease: ease !== null && Number.isInteger(ease) && ease >= 1 && ease <= 7 ? ease : null,
    confidence: ((v) => (v !== null && Number.isInteger(v) && v >= 1 && v <= 7 ? v : null))(finite(raw.confidence)),
    participantNotes: text(raw.participantNotes, 2000), suggestion: null, moderator: sanitiseModerator(raw.moderator, task),
  };
  // A completed run was begun, ended and rated; one that claims to be completed without those cannot have happened in the tool.
  if (run.status === "completed" && (run.end === null || run.beginAt === null || run.endAt === null || run.ease === null)) return null;
  // Never trust an imported suggestion: it is recomputed from the raw events against the session's own task snapshot.
  if (end) run.suggestion = suggest(task, events, end);
  return run;
}

/** Provenance is recorded by this tool when it imports a file; it is read back from storage but never from a file. */
function provenanceOf(v: unknown): { imported?: Provenance } {
  if (!isRecord(v)) return {};
  const at = finite(v.at), size = finite(v.size);
  if (at === null || size === null || typeof v.file !== "string" || typeof v.sha256 !== "string") return {};
  return { imported: { file: v.file.slice(0, 200), sha256: v.sha256.slice(0, 64), size, at } };
}

/** The closing answers survive only for questions this content asks, in the right shape. Nothing is invented when there are none. */
function closingOf(raw: unknown, content: Content, runs: Run[], status: unknown): { closing?: Record<string, string | string[]> } {
  if (!isRecord(raw)) return {};
  const asked = closingQuestionsFor({ content, runs, status: status === "ended-early" ? "ended-early" : "active" });
  return { closing: cleanClosing(asked, raw) };
}

/** Rebuilds a session from untrusted JSON (import, local storage), keeping only known fields, or null if it is unusable. */
export function sanitiseSession(raw: unknown, trusted = false): Session | null {
  if (!isRecord(raw) || raw.schemaVersion !== 1 || typeof raw.id !== "string" || !ID.test(raw.id)) return null;
  // The snapshot is read structurally only: it must stay readable after a later build changes the navigation data.
  const c = validateContent(raw.content, { checkLinks: false });
  if (!c.ok) return null;
  // Sessions saved before the breakpoint became per task carry one breakpoint for the whole session; it becomes the plan for every task.
  const legacy = BREAKPOINT_IDS.find((b) => b === raw.breakpoint);
  const legacyReview = raw.phase === "review";
  let phase = legacyReview ? ("intro" as Phase) : PHASES.find((p) => p === raw.phase);
  const createdAt = finite(raw.createdAt), updatedAt = finite(raw.updatedAt);
  if (!phase || createdAt === null || updatedAt === null || !Array.isArray(raw.order) || !Array.isArray(raw.runs)) return null;
  // A timestamp far in the future would always win a merge, so clamp to a day ahead.
  const ceiling = Date.now() + 86_400_000;
  const known = new Set(c.content.tasks.map((t) => t.id));
  const order = raw.order.slice(0, 100).filter((id): id is string => typeof id === "string" && known.has(id));
  const cursor = finite(raw.cursor);
  const runs: Run[] = [];
  const bpMap = (v: unknown): Record<string, Breakpoint> => {
    const out: Record<string, Breakpoint> = {};
    if (isRecord(v)) for (const [k, b] of Object.entries(v)) { const ok = BREAKPOINT_IDS.find((x) => x === b); if (ok && known.has(k)) out[k] = ok; }
    return out;
  };
  const overrides = bpMap(raw.planOverrides);
  const participantId = text(raw.participantId, 40);
  const deviceOverride = BREAKPOINT_IDS.find((b) => b === raw.deviceOverride);
  const arrivalOverride = ARRIVALS.find((a) => a === raw.arrivalOverride);
  const group = GROUPS.find((g) => g === raw.group) ?? "";
  let plan = bpMap(raw.plan);
  if (Object.keys(plan).length === 0) plan = legacy ? Object.fromEntries(order.map((id) => [id, legacy])) : applyOverrides(buildPlan(c.content, order, participantId, deviceOverride ?? deviceFor(c.content, participantId)), overrides, c.content);
  // A participant file is untrusted: its code must be one the participant edition can produce, and nothing the moderator
  // would have written (tier, code, findings, reviewed) is believed, because a participant has none.
  const selfRun = raw.selfRun === true;
  const fromFile = selfRun && !trusted;
  if (fromFile && !CODE.test(typeof raw.participantId === "string" ? raw.participantId : "")) return null;   // the code as sent, not a truncated copy
  const seenRuns = new Set<string>();
  for (const [i, r] of raw.runs.slice(0, 200).entries()) {
    const run = sanitiseRun(r, c.content, legacy ?? "desktop", i);
    if (!run || seenRuns.has(run.runId)) continue;   // a repeated run id would send findings to the wrong run
    seenRuns.add(run.runId);
    if (fromFile) run.moderator = emptyModerator();
    runs.push(run);
  }
  // A phase that is about a run in progress needs that run, or the screens for it cannot draw.
  if ((phase === "task" || phase === "rating" || phase === "offer" || phase === "handBack") && runs.length === 0) return null;
  let at = cursor !== null ? Math.min(Math.max(0, Math.floor(cursor)), order.length) : 0;
  // Saved before the step between tasks went: the task waiting for a hand-back or a review was already rated, so it counts and the session moves on.
  const last = raw.runs[raw.runs.length - 1];
  const waiting = isRecord(last) && last.status === "rated" && (raw.phase === "handBack" || legacyReview);
  if (waiting) { at = Math.min(at + 1, order.length); phase = at >= order.length ? "debrief" : "intro"; }
  else if (legacyReview) phase = at >= order.length ? "debrief" : "intro";
  return {
    schemaVersion: 1, id: raw.id, createdAt: Math.min(createdAt, ceiling), updatedAt: Math.min(updatedAt, ceiling), participantId, group,
    practice: fromFile ? false : raw.practice === true, selfRun, plan, planOverrides: overrides,
    ...(deviceOverride ? { deviceOverride } : {}), ...(arrivalOverride ? { arrivalOverride } : {}),
    arrival: ARRIVALS.find((a) => a === raw.arrival) ?? arrivalOverride ?? arrivalFor(participantId, group),
    ...(trusted ? provenanceOf(raw.imported) : {}),
    content: c.content, order, cursor: at, phase: phase!,
    status: raw.status === "ended" || raw.status === "ended-early" ? raw.status : "active", runs,
    retakeOf: typeof raw.retakeOf === "string" && ID.test(raw.retakeOf) ? raw.retakeOf : null,
    interruptions: Math.max(0, Math.floor(finite(raw.interruptions) ?? 0)), debriefNotes: text(raw.debriefNotes, 4000),
    ...closingOf(raw.closing, c.content, runs, raw.status),
  };
}

export interface ImportResult {
  sessions: Session[];
  rejected: { index: number; reason: string }[];
  error: string | null;
}

export function parseImport(textInput: string): ImportResult {
  let data: unknown;
  try { data = JSON.parse(textInput); } catch { return { sessions: [], rejected: [], error: "That file is not valid JSON." }; }
  if (!isRecord(data) || data.exportVersion !== 1 || data.app !== "wayfinding-check" || !Array.isArray(data.sessions)) {
    return { sessions: [], rejected: [], error: "That file is not a Wayfinding Check export." };
  }
  if (data.sessions.length > MAX_SESSIONS_PER_FILE) {
    return { sessions: [], rejected: [], error: `That file holds ${data.sessions.length} sessions. A participant's file holds one, and no file may hold more than ${MAX_SESSIONS_PER_FILE}.` };
  }
  const sessions: Session[] = [];
  const rejected: { index: number; reason: string }[] = [];
  data.sessions.forEach((raw, index) => {
    const s = sanitiseSession(raw);
    if (s) sessions.push(s);
    else rejected.push({ index, reason: isRecord(raw) && raw.selfRun === true && !CODE.test(typeof raw.participantId === "string" ? raw.participantId : "") ? "its participant code has characters a participant could not have typed" : "unreadable or unsupported session" });
  });
  return { sessions, rejected, error: null };
}

export function mergeSessions(existing: Session[], incoming: Session[]): { merged: Session[]; added: number; updated: number; kept: number } {
  const byId = new Map(existing.map((s) => [s.id, s]));
  let added = 0, updated = 0, kept = 0;
  for (const s of incoming) {
    const have = byId.get(s.id);
    if (!have) { byId.set(s.id, s); added += 1; }
    else if (s.updatedAt > have.updatedAt) { byId.set(s.id, s); updated += 1; }
    else kept += 1;
  }
  return { merged: [...byId.values()].sort((a, b) => a.createdAt - b.createdAt), added, updated, kept };
}

// ---------- Markdown ----------

const pct = (r: { hits: number; den: number }) => (r.den === 0 ? "n/a" : `${r.hits}/${r.den} (${Math.round((r.hits / r.den) * 100)}%)`);
const secs = (ms: number | null) => (ms === null ? "n/a" : (ms / 1000).toFixed(1) + " s");
const split = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${cell(k)} ${v}`).join(", ") || "none";

/**
 * Text from a file goes into a Markdown table cell. Every character that could start a link, image, HTML tag, code span or
 * emphasis is escaped, and every kind of line break (including U+2028, U+2029 and U+0085) becomes a space, so it cannot
 * break the row or inject anything into a viewer.
 */
const cell = (v: string) => v.replace(/[\r\n\u0085\u2028\u2029]+/g, " ").replace(/[\\`*_{}[\]()<>#+!|~&]/g, (m) => "\\" + m);

export function ledgerMarkdown(sessions: Session[], exportedAt: string): string {
  const rows = ledger(sessions);
  const lines = [
    "# Wayfinding Check: results",
    "",
    `Exported ${exportedAt}. Practice sessions are excluded. Each participant counts once per task (latest completed attempt).`,
    "",
    "Read with care: the samples are small, so these figures are directional. Mobile and tablet frames show how the layout is understood; clicks are recorded as taps and touch ability is not tested. Desktop, tablet and mobile are never pooled.",
    "",
    "| Task | Breakpoint | n | Level 1 section | Level 2 destination | Verdict | Median first interaction | Mean ease | Confident wrong | Final column | Misread sections |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const t of rows) {
    lines.push(`| ${cell(t.taskId + " " + t.title)}${t.highRisk ? " (high risk)" : ""}${t.contentVersions.length > 1 ? ` (content v${t.contentVersions.join(", v")})` : ""} | ${BREAKPOINTS[t.breakpoint].label} | ${t.n} | ${pct(t.level1)} | ${pct(t.level2)} | ${t.verdict} | ${secs(t.medianFirstInteractionMs)} | ${t.meanEase === null ? "n/a" : t.meanEase.toFixed(1)} | ${t.confidentWrong} | ${split(t.routeSplit)} | ${split(t.misreads)} |`);
  }
  if (rows.length === 0) lines.push("| No counted runs yet | | | | | | | | | | |");
  lines.push("", "Verdict thresholds (proposed): Pass 80% or more, Watch 60 to 79%, Fail under 60%, on the worse of the two levels.", "");
  // The combined test: observe tasks are not scored, so what the moderator coded is the result. Click tasks add where the first click landed.
  const withCodes = rows.filter((t) => Object.keys(t.coded).length > 0 || t.meanConfidence !== null || Object.keys(t.zones).length > 0);
  if (withCodes.length > 0) {
    lines.push("## Coded answers, first click zones and confidence", "");
    for (const t of withCodes) {
      lines.push(`**${cell(t.taskId + " " + t.title)}** (${BREAKPOINTS[t.breakpoint].label}, n=${t.n})`, "");
      if (Object.keys(t.zones).length > 0) lines.push(`- First click zone: ${split(t.zones)}`);
      for (const [id, m] of Object.entries(t.coded)) lines.push(`- ${cell(t.codeLabels[id] ?? id)}: ${split(m)}`);
      if (t.meanConfidence !== null) lines.push(`- Confidence, mean of 7: ${t.meanConfidence.toFixed(1)}`);
      lines.push("");
    }
  }
  // The participant edition's debrief: each closing question with every participant's answer.
  const withClosing = sessions.filter((s) => !s.practice && s.closing && Object.keys(s.closing).length > 0);
  if (withClosing.length > 0) {
    lines.push("## Closing questions", "", "Answered on screen by the participant, in their own words. A ranking is listed from the one that made them most sure to the one that made them least sure.", "");
    const prompts = new Map<string, string>();
    for (const s of withClosing) for (const q of s.content.closingQuestions ?? []) if (!prompts.has(q.id)) prompts.set(q.id, q.prompt);
    for (const [id, prompt] of prompts) {
      const answers = withClosing.flatMap((s) => { const a = s.closing![id]; return a === undefined ? [] : [`- ${cell(s.participantId || s.id)}: ${cell(Array.isArray(a) ? a.join(" > ") : a)}`]; });
      if (answers.length === 0) continue;
      lines.push(`**${cell(prompt)}**`, "", ...answers, "");
    }
  }
  return lines.join("\n");
}
