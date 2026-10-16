import { BREAKPOINT_IDS } from "../../shared/protocol.ts";
import type { Breakpoint } from "../../shared/protocol.ts";
import { hrefExists } from "../../shared/navIndex.ts";
import type { Content, Task, TargetSpec } from "./tasks.ts";

const EM_DASH = "\u2014";
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

export type ContentResult = { ok: true; content: Content } | { ok: false; errors: string[] };

function targets(raw: unknown, where: string, errors: string[], checkLinks: boolean): TargetSpec[] {
  if (!Array.isArray(raw)) { errors.push(`${where} must be a list`); return []; }
  const out: TargetSpec[] = [];
  raw.slice(0, 20).forEach((t, i) => {
    if (!isRecord(t) || typeof t.href !== "string" || t.href === "") { errors.push(`${where}[${i}] needs an href`); return; }
    if (checkLinks && !hrefExists(t.href)) errors.push(`${where}[${i}] href "${t.href}" is not a link in the navigation or footer`);
    const note = typeof t.note === "string" ? t.note.slice(0, 200) : undefined;
    out.push(note ? { href: t.href, note } : { href: t.href });
  });
  return out;
}

const strings = (raw: unknown, where: string, errors: string[]): string[] => {
  if (!Array.isArray(raw) || raw.some((s) => typeof s !== "string")) { errors.push(`${where} must be a list of text`); return []; }
  return (raw as string[]).map((s) => s.slice(0, 400));
};

/**
 * Validates and rebuilds content from untrusted JSON (the Content tab, an import, local storage). Only known fields
 * survive, every link target must exist in the navigation or footer data (unless `checkLinks` is false, which is how a
 * session's own snapshot is read: it must stay readable after the navigation data changes in a later build), and em
 * dashes are rejected (house style).
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
    const primary = targets(t.primary, `${where}.primary`, errors, checkLinks);
    if (primary.length === 0) errors.push(`${where}.primary needs at least one target`);
    const task: Task = {
      id, title, scenario, breakpoints: bps,
      reserve: t.reserve === true, highRisk: t.highRisk === true,
      hypotheses: strings(t.hypotheses ?? [], `${where}.hypotheses`, errors),
      primary, acceptable: targets(t.acceptable ?? [], `${where}.acceptable`, errors, checkLinks), separate: targets(t.separate ?? [], `${where}.separate`, errors, checkLinks),
      watchFor: text(t.watchFor, 600), needBack: strings(t.needBack ?? [], `${where}.needBack`, errors),
    };
    for (const [k, v] of Object.entries(task)) {
      const flat = JSON.stringify(v);
      if (flat.includes(EM_DASH)) errors.push(`${where}.${k} contains an em dash: use a comma, colon, brackets or a new sentence`);
    }
    tasks.push(task);
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, content: { schemaVersion: 1, version: raw.version as number, updatedAt: text(raw.updatedAt, 40) || new Date(0).toISOString(), tasks } };
}

/** A saved edit becomes the next version, so past sessions stay tied to what they ran against. */
export function nextContent(previous: Content, edited: Content, nowIso: string): Content {
  return { ...edited, version: previous.version + 1, updatedAt: nowIso };
}

export const taskById = (content: Content, id: string): Task | undefined => content.tasks.find((t) => t.id === id);
