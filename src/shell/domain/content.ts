import { BREAKPOINT_IDS } from "../../shared/protocol.ts";
import type { Breakpoint } from "../../shared/protocol.ts";
import { hrefExists } from "../../shared/navIndex.ts";
import { ARRIVALS, TASK_DEFAULTS } from "./tasks.ts";
import type { Block, CodeSpec, Content, Task, TargetSpec, TaskKind } from "./tasks.ts";

const EM_DASH = "\u2014";
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

export type ContentResult = { ok: true; content: Content } | { ok: false; errors: string[] };

const ZONE = /^[a-z][a-z0-9-]{0,39}$/;
const START = /^\/[A-Za-z0-9/_\-.?=&%]{0,150}$/;
const KINDS: TaskKind[] = ["nav", "click", "observe"];
const BLOCKS: Block[] = ["homepage", "product", "navigation"];

function targets(raw: unknown, where: string, errors: string[], checkLinks: boolean, kind: TaskKind): TargetSpec[] {
  if (!Array.isArray(raw)) { errors.push(`${where} must be a list`); return []; }
  const out: TargetSpec[] = [];
  raw.slice(0, 20).forEach((t, i) => {
    if (!isRecord(t)) { errors.push(`${where}[${i}] must be an object`); return; }
    const href = typeof t.href === "string" && t.href !== "" ? t.href : undefined;
    const zone = typeof t.zone === "string" && t.zone !== "" ? t.zone : undefined;
    if ((href === undefined) === (zone === undefined)) { errors.push(`${where}[${i}] needs an href or a zone, not both and not neither`); return; }
    if (href !== undefined) {
      if (kind === "observe") { errors.push(`${where}[${i}]: an observe task has no targets`); return; }
      if (checkLinks && !hrefExists(href)) errors.push(`${where}[${i}] href "${href}" is not a link in the navigation or footer`);
    }
    if (zone !== undefined) {
      if (kind !== "click") { errors.push(`${where}[${i}]: only a click task has zone targets`); return; }
      if (!ZONE.test(zone)) errors.push(`${where}[${i}] zone "${zone}" must be lower case letters, digits and dashes`);
    }
    const note = typeof t.note === "string" ? t.note.slice(0, 200) : undefined;
    const spec: TargetSpec = href !== undefined ? { href } : { zone: zone! };
    if (note) spec.note = note;
    out.push(spec);
  });
  return out;
}

const strings = (raw: unknown, where: string, errors: string[]): string[] => {
  if (!Array.isArray(raw) || raw.some((s) => typeof s !== "string")) { errors.push(`${where} must be a list of text`); return []; }
  return (raw as string[]).map((s) => s.slice(0, 400));
};

function codes(raw: unknown, where: string, errors: string[]): CodeSpec[] {
  if (!Array.isArray(raw)) { errors.push(`${where} must be a list`); return []; }
  const seen = new Set<string>();
  const out: CodeSpec[] = [];
  raw.slice(0, 20).forEach((c, i) => {
    if (!isRecord(c)) { errors.push(`${where}[${i}] must be an object`); return; }
    const id = text(c.id, 30), label = text(c.label, 120);
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(id)) errors.push(`${where}[${i}].id must be letters and digits, starting with a letter`);
    if (seen.has(id)) errors.push(`${where}[${i}].id "${id}" is used twice`);
    seen.add(id);
    if (label === "") errors.push(`${where}[${i}].label is required`);
    const options = Array.isArray(c.options) && c.options.every((o) => typeof o === "string" && o.trim() !== "") ? (c.options as string[]).map((o) => o.slice(0, 60)) : [];
    if (options.length < 2 || options.length > 12 || new Set(options).size !== options.length) errors.push(`${where}[${i}].options must be 2 to 12 different choices`);
    out.push({ id, label, options });
  });
  return out;
}

/**
 * Validates and rebuilds content from untrusted JSON (the Content tab, an import, local storage). Only known fields
 * survive, every link target must exist in the navigation or footer data (unless `checkLinks` is false, which is how a
 * session's own snapshot is read: it must stay readable after the navigation data changes in a later build), and em
 * dashes are rejected (house style). Tasks written before the combined test (no kind, block, start and so on) read as
 * navigation tasks that start on the homepage.
 */
export function validateContent(raw: unknown, options: { checkLinks?: boolean } = {}): ContentResult {
  const checkLinks = options.checkLinks !== false;
  const errors: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ["Content must be an object"] };
  if (raw.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (typeof raw.version !== "number" || !Number.isInteger(raw.version) || raw.version < 1) errors.push("version must be a whole number, 1 or more");
  if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) errors.push("tasks must be a non-empty list");
  else if (raw.tasks.length > 60) errors.push("there can be at most 60 tasks");
  const tasks: Task[] = [];
  const seen = new Set<string>();
  (Array.isArray(raw.tasks) ? raw.tasks : []).forEach((t, i) => {
    const where = `tasks[${i}]`;
    if (!isRecord(t)) { errors.push(`${where} must be an object`); return; }
    const id = text(t.id, 20);
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(id)) errors.push(`${where}.id must be letters and digits, starting with a letter`);
    if (seen.has(id)) errors.push(`${where}.id "${id}" is used twice`);
    seen.add(id);
    const title = text(t.title, 80), scenario = text(t.scenario, 600);
    if (title === "") errors.push(`${where}.title is required`);
    if (scenario === "") errors.push(`${where}.scenario is required`);
    const bps = Array.isArray(t.breakpoints) ? (t.breakpoints.filter((b) => BREAKPOINT_IDS.includes(b as Breakpoint)) as Breakpoint[]) : [];
    if (bps.length === 0 || bps.length !== (t.breakpoints as unknown[]).length) errors.push(`${where}.breakpoints must be a list drawn from desktop, tablet, mobile`);
    const kind = t.kind === undefined ? "nav" : KINDS.find((k) => k === t.kind);
    if (!kind) errors.push(`${where}.kind must be nav, click or observe`);
    const k: TaskKind = kind ?? "nav";
    const block = t.block === undefined ? "navigation" : BLOCKS.find((b) => b === t.block);
    if (!block) errors.push(`${where}.block must be homepage, product or navigation`);
    const primary = targets(t.primary ?? [], `${where}.primary`, errors, checkLinks, k);
    if (primary.length === 0 && k !== "observe") errors.push(`${where}.primary needs at least one target`);
    const minutes = t.minutes === undefined ? TASK_DEFAULTS.minutes : typeof t.minutes === "number" && t.minutes >= 0.5 && t.minutes <= 30 ? t.minutes : NaN;
    if (Number.isNaN(minutes)) errors.push(`${where}.minutes must be a number from 0.5 to 30`);
    const start = t.start === undefined ? "/" : typeof t.start === "string" && START.test(t.start) && !t.start.startsWith("//") ? t.start : "";
    if (start === "") errors.push(`${where}.start must be a path such as / or /shop/products/lavender-essential-oil`);
    let leadIns: Task["leadIns"] = null;
    if (t.leadIns !== undefined && t.leadIns !== null) {
      const l = t.leadIns;
      if (isRecord(l) && ARRIVALS.every((a) => typeof l[a] === "string")) leadIns = { homepage: text(l.homepage, 300), google: text(l.google, 300), shared: text(l.shared, 300) };
      else errors.push(`${where}.leadIns needs text for homepage, google and shared`);
    }
    const task: Task = {
      id, title, scenario, breakpoints: bps,
      kind: k, block: block ?? "navigation", minutes: Number.isNaN(minutes) ? TASK_DEFAULTS.minutes : minutes, start: start || "/",
      questions: strings(t.questions ?? [], `${where}.questions`, errors), leadIns, codes: codes(t.codes ?? [], `${where}.codes`, errors),
      confidence: text(t.confidence, 200), notesPrompt: text(t.notesPrompt, 200), apartFrom: text(t.apartFrom, 20), readsMenu: t.readsMenu === true,
      reserve: t.reserve === true, highRisk: t.highRisk === true,
      hypotheses: strings(t.hypotheses ?? [], `${where}.hypotheses`, errors),
      primary, acceptable: targets(t.acceptable ?? [], `${where}.acceptable`, errors, checkLinks, k), separate: targets(t.separate ?? [], `${where}.separate`, errors, checkLinks, k),
      watchFor: text(t.watchFor, 900), needBack: strings(t.needBack ?? [], `${where}.needBack`, errors),
    };
    for (const [key, v] of Object.entries(task)) {
      const flat = JSON.stringify(v);
      if (flat.includes(EM_DASH)) errors.push(`${where}.${key} contains an em dash: use a comma, colon, brackets or a new sentence`);
    }
    tasks.push(task);
  });
  for (const t of tasks) if (t.apartFrom !== "" && !seen.has(t.apartFrom)) errors.push(`${t.id}.apartFrom "${t.apartFrom}" is not a task id`);
  const debrief = raw.debrief === undefined ? undefined : strings(raw.debrief, "debrief", errors).slice(0, 12);
  if (debrief?.some((d) => d.includes(EM_DASH))) errors.push("debrief contains an em dash: use a comma, colon, brackets or a new sentence");
  if (raw.devicePerParticipant !== undefined && typeof raw.devicePerParticipant !== "boolean") errors.push("devicePerParticipant must be true or false");
  if (errors.length > 0) return { ok: false, errors };
  const content: Content = { schemaVersion: 1, version: raw.version as number, updatedAt: text(raw.updatedAt, 40) || new Date(0).toISOString(), tasks };
  if (raw.devicePerParticipant === true) content.devicePerParticipant = true;
  if (debrief && debrief.length > 0) content.debrief = debrief;
  return { ok: true, content };
}

/** A saved edit becomes the next version, so past sessions stay tied to what they ran against. */
export function nextContent(previous: Content, edited: Content, nowIso: string): Content {
  return { ...edited, version: previous.version + 1, updatedAt: nowIso };
}

export const taskById = (content: Content, id: string): Task | undefined => content.tasks.find((t) => t.id === id);
