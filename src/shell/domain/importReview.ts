import { suggest } from "./scoring.ts";
import { normaliseCode } from "./session.ts";
import type { Provenance, Session } from "./session.ts";
import type { Content, Task } from "./tasks.ts";

/**
 * What happens to a file's sessions before they reach the Ledger. A results file is made by someone else and can say
 * anything about itself: who it is, when it was made, what the right answers are, how it was reviewed. So the tool
 * decides what it can (the order of imports, the answers a participant's clicks are scored against) and asks the
 * researcher about the rest, with anything that looks wrong defaulting to "skip".
 */
export type Action = "import" | "skip";

export interface Flag {
  kind: "code-in-use" | "duplicate-in-file" | "replaces-findings" | "tasks-differ" | "tasks-missing" | "up-to-date" | "updates" | "rescored";
  /** A blocking flag makes "skip" the default; the researcher can still choose to import. */
  blocking: boolean;
  text: string;
}

export interface ReviewItem {
  /** The session as it would be imported (a participant's session re-scored against this tool's own tasks). */
  session: Session;
  flags: Flag[];
  action: Action;
}

const hrefs = (t: Task): string => [...t.primary, ...t.acceptable, ...t.separate].map((x) => x.href).sort().join("|");

export interface ContentCheck { missing: string[]; scenarioDiffers: string[]; targetsDiffer: string[]; versionDiffers: boolean }

/** How a session's own copy of the tasks compares with this tool's tasks, for the tasks the session actually used. */
export function checkAgainstTool(s: Session, tool: Content): ContentCheck {
  const used = new Set([...s.order, ...s.runs.map((r) => r.taskId)]);
  const out: ContentCheck = { missing: [], scenarioDiffers: [], targetsDiffer: [], versionDiffers: s.content.version !== tool.version };
  for (const id of used) {
    const mine = s.content.tasks.find((t) => t.id === id);
    const theirs = tool.tasks.find((t) => t.id === id);
    if (!theirs) { out.missing.push(id); continue; }
    if (!mine) continue;
    if (mine.scenario.trim() !== theirs.scenario.trim()) out.scenarioDiffers.push(id);
    else if (hrefs(mine) !== hrefs(theirs)) out.targetsDiffer.push(id);
  }
  return out;
}

/** The session with this tool's tasks swapped in and every run scored again from its raw clicks. */
export function rescoreWith(s: Session, tool: Content): Session {
  const content = structuredClone(tool);
  const runs = s.runs.map((r) => {
    const task = content.tasks.find((t) => t.id === r.taskId);
    return { ...r, suggestion: task && r.end ? suggest(task, r.events, r.end) : null };
  });
  return { ...s, content, runs };
}

const hasFindings = (s: Session): boolean => s.runs.some((r) => r.moderator.reviewed);

export function reviewImport(existing: Session[], incoming: Session[], tool: Content): ReviewItem[] {
  const items: ReviewItem[] = [];
  const seenCodes = new Set<string>();
  for (const raw of incoming) {
    const flags: Flag[] = [];
    let session = raw;
    if (raw.selfRun) {
      const check = checkAgainstTool(raw, tool);
      if (check.missing.length > 0) {
        flags.push({ kind: "tasks-missing", blocking: true, text: `It includes tasks this tool does not have (${check.missing.join(", ")}), so it cannot be scored against your tasks.` });
      } else if (check.scenarioDiffers.length > 0) {
        flags.push({ kind: "tasks-differ", blocking: true, text: `The participant saw different scenario wording from this tool's for ${check.scenarioDiffers.join(", ")}. It may have been built from other tasks, or altered.` });
      } else {
        session = rescoreWith(raw, tool);
        const why = check.targetsDiffer.length > 0 ? `its own answers for ${check.targetsDiffer.join(", ")} differed from yours` : check.versionDiffers ? `it was made with tasks version ${raw.content.version}, yours is ${tool.version}` : "";
        flags.push({ kind: "rescored", blocking: false, text: `Scored against your tasks (version ${tool.version}), not the file's own answers${why ? `: ${why}` : ""}.` });
      }
    }
    const key = normaliseCode(session.participantId);
    const sameId = existing.find((e) => e.id === session.id);
    if (sameId) {
      if (hasFindings(sameId)) flags.push({ kind: "replaces-findings", blocking: true, text: "You already have this session with your findings on it. Importing would replace it and lose them." });
      else if (session.updatedAt > sameId.updatedAt) flags.push({ kind: "updates", blocking: false, text: "You already have this session; this copy is newer and would replace it." });
      else flags.push({ kind: "up-to-date", blocking: true, text: "You already have this session and your copy is the same or newer." });
    } else if (!session.practice && key !== "" && existing.some((e) => !e.practice && e.id !== session.id && normaliseCode(e.participantId) === key)) {
      flags.push({ kind: "code-in-use", blocking: true, text: `The code ${session.participantId} already belongs to a different session in your Ledger. Importing could replace that person's results.` });
    }
    if (!session.practice && key !== "") {
      if (seenCodes.has(key)) flags.push({ kind: "duplicate-in-file", blocking: true, text: `Another session in this file uses the code ${session.participantId}.` });
      seenCodes.add(key);
    }
    items.push({ session, flags, action: flags.some((f) => f.blocking) ? "skip" : "import" });
  }
  return items;
}

/** The sessions after the chosen imports, each stamped with where it came from and when this tool received it. */
export function applyReview(existing: Session[], items: ReviewItem[], provenance: Omit<Provenance, "at">, at: number): Session[] {
  const byId = new Map(existing.map((s) => [s.id, s]));
  for (const it of items) if (it.action === "import") byId.set(it.session.id, { ...it.session, imported: { ...provenance, at } });
  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}
