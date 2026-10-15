import type { CapturedEvent } from "../shared/protocol.ts";
import { SECTION_LABELS } from "../shared/navIndex.ts";
import type { Tier } from "./domain/scoring.ts";

export const TIER_LABELS: Record<Tier, string> = { P: "Primary", A: "Acceptable", X: "Incorrect", R: "Recorded only", S: "Recorded separately" };

export const CODE_LABELS: Record<number, string> = {
  1: "Wrong section",
  2: "Right section, wrong column",
  3: "Right column, wrong link",
  4: "Search",
  5: "Utility, logo, footer or other",
  6: "No destination reached",
};

export const sectionLabel = (id: string | null | undefined): string => (id ? (SECTION_LABELS[id] ?? (id === "footer" ? "Footer" : id)) : "none");

export const seconds = (ms: number | null | undefined): string => (ms === null || ms === undefined ? "n/a" : (ms / 1000).toFixed(1) + " s");

export const clock = (t: number): string => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** One line per recorded event, in plain words, with its time since the frame was ready. */
export function describeEvent(e: CapturedEvent, readyAt: number): string {
  const t = `+${((e.at - readyAt) / 1000).toFixed(1)} s`;
  switch (e.type) {
    case "ready": return `${t}  Menu ready (${e.w} x ${e.h})`;
    case "menu-open": return `${t}  Opened ${sectionLabel(e.section)} (${e.surface === "drill" ? "section row" : e.surface === "dropdown" ? "dropdown" : "menu"}, by ${e.via})`;
    case "menu-close": return `${t}  Closed ${sectionLabel(e.section)}`;
    case "click": {
      const where = [e.section ? sectionLabel(e.section) : "", e.column ?? ""].filter(Boolean).join(" > ");
      return `${t}  ${e.kind === "nav-leaf" || e.kind === "footer" || e.kind === "featured" ? "Chose" : "Clicked"} ${e.label || e.kind}${where ? ` (${where})` : ""}${e.ends ? "  [ended the task]" : ""}`;
    }
    case "route": return `${t}  Page: ${e.path}`;
    case "search-submit": return `${t}  Searched for "${e.query}"  [ended the task]`;
    case "moderator-key": return `${t}  Moderator key`;
  }
}

/** Triggers a file download. Works from file:// and without any server. */
export function download(filename: string, mime: string, text: string) {
  // A BOM makes Excel on Windows read a CSV as UTF-8, so accents and curly quotes in notes survive.
  const body = mime.startsWith("text/csv") ? "\uFEFF" + text : text;
  const url = URL.createObjectURL(new Blob([body], { type: mime.startsWith("text/") ? mime + ";charset=utf-8" : mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const stamp = (d: Date = new Date()): string => d.toISOString().slice(0, 16).replace(/[:T]/g, "-");
