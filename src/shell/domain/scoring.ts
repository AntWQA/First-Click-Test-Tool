import type { CapturedEvent, ClickMsg, MenuOpenMsg } from "../../shared/protocol.ts";
import { lookupHeader, normaliseHref } from "../../shared/navIndex.ts";
import type { Task, TargetSpec } from "./tasks.ts";

/**
 * P Primary, A Acceptable, X Incorrect, R Recorded only (search, which is behaviour rather than a miss),
 * S Recorded separately (a plausible answer whose page content is not yet confirmed).
 */
export type Tier = "P" | "A" | "X" | "R" | "S";
export type EndReason = "destination" | "found" | "gave-up";

/** 1 wrong section, 2 right section wrong column, 3 right column wrong link, 4 search, 5 utility, logo, footer or other, 6 no destination reached. Code 7 (needed a prompt) is coded by the moderator. */
export type WrongClickCode = 1 | 2 | 3 | 4 | 5 | 6;

/** A menu must stay open this long to count as the participant's section choice (Pure itself opens on 150 ms hover intent). */
export const DWELL_MS = 300;

export interface Suggestion {
  tier: Tier;
  code: WrongClickCode | null;
  /** The first menu Pure opened, however briefly. Kept so a reviewer can see a sweep across the bar. */
  firstOpenSection: string | null;
  /** The section choice used for Level 1: first menu open for DWELL_MS or more, else the section of the final click. */
  levelOneSection: string | null;
  level1: boolean | null;
  level2: boolean | null;
  finalKind: string | null;
  finalHref: string | null;
  finalSection: string | null;
  finalColumn: string | null;
  viaFooter: boolean;
  foundWithoutDestination: boolean;
  /** Sections opened, in order, each once. */
  sectionsOpened: string[];
  /** Milliseconds from the frame being ready to the first menu opening or click. */
  firstInteractionMs: number | null;
  /** Where the first click landed (a zone of the page, or nav-<section>, footer, search, header). Null when nothing was clicked. */
  firstZone: string | null;
  /** The zones clicked, in order, each once. */
  zonesClicked: string[];
}

const set = (specs: TargetSpec[]) => new Set(specs.flatMap((s) => (s.href ? [normaliseHref(s.href)] : [])));

function targetSections(task: Task): Set<string> {
  const out = new Set<string>();
  for (const s of [...task.primary, ...task.acceptable]) {
    const e = s.href ? lookupHeader(s.href) : undefined;
    if (e) out.add(e.section);
  }
  return out;
}

function targetColumns(task: Task, section: string): Set<string> {
  const out = new Set<string>();
  for (const s of [...task.primary, ...task.acceptable]) {
    const e = s.href ? lookupHeader(s.href) : undefined;
    if (e && e.section === section) out.add(e.column);
  }
  return out;
}

interface Interval { section: string; from: number; to: number }

/** Open spans per section, in the order they opened. A menu still open when the task ended runs to `end` (frame time). */
function intervals(events: CapturedEvent[], end: number): Interval[] {
  const open = new Map<string, number>();
  const out: Interval[] = [];
  for (const e of events) {
    if (e.type === "menu-open" && e.surface !== "drill") {
      if (!open.has(e.section)) open.set(e.section, e.at);
    } else if (e.type === "menu-close" && open.has(e.section)) {
      out.push({ section: e.section, from: open.get(e.section)!, to: e.at });
      open.delete(e.section);
    }
  }
  for (const [section, from] of open) out.push({ section, from, to: end });
  return out.sort((a, b) => a.from - b.from);
}

/**
 * `frameEnd` is when the task ended on the frame's own clock. Without it a menu still open at the end would be measured
 * only to the last recorded event, so a participant who stared at a menu for twenty seconds and gave up would look as
 * if they had barely opened it.
 */
export function suggest(task: Task, events: CapturedEvent[], end: EndReason, frameEnd?: number): Suggestion {
  const sorted = events.slice().sort((a, b) => a.at - b.at);
  const ready = sorted.find((e) => e.type === "ready");
  const opens = sorted.filter((e): e is MenuOpenMsg => e.type === "menu-open");
  const sectionsOpened = [...new Set(opens.map((o) => o.section))];
  const interactive = sorted.filter((e) => e.type === "menu-open" || e.type === "click");
  const firstInteractionMs = interactive.length > 0 ? Math.max(0, interactive[0]!.at - (ready?.at ?? 0)) : null;
  const everyClick = sorted.filter((e): e is ClickMsg => e.type === "click");
  const firstClick = everyClick[0];
  const firstZone = firstClick?.zone ?? null;
  const zonesClicked = [...new Set(everyClick.flatMap((c) => (c.zone ? [c.zone] : [])))];

  // An observe task scores nothing: what the participant says and does is coded afterwards.
  if (task.kind === "observe") {
    return {
      tier: "R", code: null, firstOpenSection: opens[0]?.section ?? null, levelOneSection: null, level1: null, level2: null,
      finalKind: firstClick?.kind ?? null, finalHref: firstClick?.href ? normaliseHref(firstClick.href) : null, finalSection: null, finalColumn: null,
      viaFooter: false, foundWithoutDestination: false, sectionsOpened, firstInteractionMs, firstZone, zonesClicked,
    };
  }
  // A click task is a first click test in the plain sense: the tier comes from the FIRST click, by the zone it landed in (or the link, for a header route).
  if (task.kind === "click") {
    const hit = (specs: TargetSpec[]) => !!firstClick && specs.some((s) => (s.zone !== undefined && s.zone === firstClick.zone) || (s.href !== undefined && firstClick.href !== undefined && normaliseHref(s.href) === normaliseHref(firstClick.href)));
    const tier: Tier = !firstClick ? "X" : hit(task.primary) ? "P" : hit(task.acceptable) ? "A" : hit(task.separate) ? "S" : "X";
    return {
      tier, code: firstClick ? null : 6, firstOpenSection: opens[0]?.section ?? null, levelOneSection: null, level1: null, level2: tier === "P" || tier === "A" ? true : tier === "X" ? false : null,
      finalKind: firstClick?.kind ?? null, finalHref: firstClick?.href ? normaliseHref(firstClick.href) : null, finalSection: null, finalColumn: null,
      viaFooter: firstClick?.kind === "footer", foundWithoutDestination: !firstClick && end === "found", sectionsOpened, firstInteractionMs, firstZone, zonesClicked,
    };
  }

  const clicks = sorted.filter((e): e is ClickMsg => e.type === "click" && e.ends);
  const searches = sorted.filter((e) => e.type === "search-submit");
  const lastClick = clicks[clicks.length - 1];
  const lastSearch = searches[searches.length - 1];
  const searchEnded = lastSearch !== undefined && (lastClick === undefined || lastSearch.at > lastClick.at);

  const primary = set(task.primary), acceptable = set(task.acceptable), separate = set(task.separate);
  const sections = targetSections(task);

  let tier: Tier;
  let code: WrongClickCode | null = null;
  let finalKind: string | null = null, finalHref: string | null = null, finalSection: string | null = null, finalColumn: string | null = null;
  let viaFooter = false;
  let foundWithoutDestination = false;

  if (searchEnded) {
    tier = "R"; code = 4; finalKind = "search-submit";
  } else if (lastClick) {
    finalKind = lastClick.kind;
    finalHref = lastClick.href ? normaliseHref(lastClick.href) : null;
    viaFooter = lastClick.kind === "footer";
    const entry = finalHref ? lookupHeader(finalHref) : undefined;
    finalSection = viaFooter ? "footer" : (lastClick.section ?? entry?.section ?? null);
    finalColumn = viaFooter ? (lastClick.column ?? null) : (lastClick.column ?? entry?.column ?? null);
    if (finalHref && primary.has(finalHref)) tier = "P";
    else if (finalHref && acceptable.has(finalHref)) tier = "A";
    else if (finalHref && separate.has(finalHref)) tier = "S";
    else {
      tier = "X";
      if (viaFooter || finalSection === null || !sections.has(finalSection)) code = viaFooter || finalSection === null ? 5 : 1;
      else code = targetColumns(task, finalSection).has(finalColumn ?? "") ? 3 : 2;
    }
  } else {
    tier = "X"; code = 6;
    foundWithoutDestination = end === "found";
  }

  // Level 1: which section the participant chose. Mobile and tablet use the first section row opened (no dwell rule).
  // With no menu held open and no header destination there is no section choice: a sub-dwell sweep is exactly what the rule ignores.
  const drill = opens.find((o) => o.surface === "drill");
  let levelOneSection: string | null = null;
  if (drill) levelOneSection = drill.section;
  else {
    const stop = frameEnd ?? (sorted.length > 0 ? sorted[sorted.length - 1]!.at : 0);
    const dwelled = intervals(sorted, stop).find((i) => i.to - i.from >= DWELL_MS);
    levelOneSection = dwelled ? dwelled.section : (finalSection && finalSection !== "footer" ? finalSection : null);
  }
  // A search, a separately recorded answer, or a footer route with no menu used has no section choice to judge, and a task
  // whose targets are all in the footer has no section to hit; any other run without a choice missed.
  let level1 = levelOneSection ? (sections.size === 0 ? null : sections.has(levelOneSection)) : (tier === "R" || tier === "S" || viaFooter || sections.size === 0 ? null : false);
  // A separately recorded answer is never scored as a miss, so a section choice that matches only it (Source to You sits in
  // Our Story, the target in Learn) is not a Level 1 miss either. A choice that did match stays a hit.
  if (tier === "S" && level1 === false) level1 = null;
  const level2 = tier === "P" || tier === "A" ? true : tier === "X" ? false : null;

  return {
    tier, code, firstOpenSection: opens[0]?.section ?? null, levelOneSection, level1, level2,
    finalKind, finalHref, finalSection, finalColumn, viaFooter, foundWithoutDestination, sectionsOpened, firstInteractionMs, firstZone, zonesClicked,
  };
}
