import { useApp } from "../state.tsx";
import { countedRuns, effective } from "../domain/session.ts";
import type { Run, Session } from "../domain/session.ts";
import { BREAKPOINTS, BREAKPOINT_IDS } from "../../shared/protocol.ts";
import { countedSessions, ledger, THRESHOLDS } from "../domain/ledger.ts";
import type { Rate, TaskTally, Verdict } from "../domain/ledger.ts";
import { ledgerMarkdown, runsToCsv, toJsonBundle } from "../domain/exports.ts";
import { DownloadIcon } from "../brand.tsx";
import { download, sectionLabel, seconds, stamp, TIER_LABELS, zoneLabel } from "../format.ts";

const VERDICT: Record<Verdict, string> = { pass: "Pass", watch: "Watch", fail: "Fail", "n/a": "No data" };
const GLYPH: Record<Verdict, string> = { pass: "✓", watch: "!", fail: "✕", "n/a": "\u00b7" };
const pct = (r: Rate) => (r.den === 0 ? "n/a" : `${r.hits}/${r.den} (${Math.round((r.hits / r.den) * 100)}%)`);
const split = (m: Record<string, number>, map?: (k: string) => string) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${map ? map(k) : k} ${v}`).join(", ") || "none";

/** Coded answers on one line each: the question, then each choice with its count. */
const codedText = (t: TaskTally): string =>
  Object.entries(t.coded).map(([id, m]) => `${t.codeLabels[id] ?? id}: ${split(m)}`).join(" | ") || "none yet";

function Badge({ v }: { v: Verdict }) {
  // Never colour alone: the word and a glyph carry the meaning.
  return <span className={`m-verdict m-verdict-${v === "n/a" ? "na" : v}`}><span aria-hidden="true">{GLYPH[v]} </span>{VERDICT[v]}</span>;
}

export function Ledger({ onReview }: { onReview: (sessionId: string, runId: string) => void }) {
  const { sessions, content } = useApp();
  const rows = ledger(sessions);
  // Findings are grouped by participant, in the order the participant did the tasks. A repeated ID gathers all its sessions under one heading.
  const byParticipant = new Map<string, { s: Session; r: Run }[]>();
  for (const s of sessions.filter((x) => !x.practice).sort((x, y) => x.createdAt - y.createdAt)) {
    const runs = countedRuns(s).slice().sort((x, y) => x.position - y.position);
    if (runs.length === 0) continue;
    const key = s.participantId || "(no ID)";
    byParticipant.set(key, [...(byParticipant.get(key) ?? []), ...runs.map((r) => ({ s, r }))]);
  }
  const participants = [...byParticipant.entries()].sort(([x], [y]) => x.localeCompare(y, undefined, { numeric: true }));
  const now = () => new Date().toISOString();
  return (
    <main className="m-page m-wide">
      <div className="m-titlebar">
        <h1>Ledger</h1>
        <div className="m-actions">
          <button type="button" className="btn btn-secondary" onClick={() => download(`wayfinding-results-${stamp()}.md`, "text/markdown", ledgerMarkdown(sessions, now()))}><DownloadIcon />Markdown summary</button>
          <button type="button" className="btn btn-secondary" onClick={() => download(`wayfinding-runs-${stamp()}.csv`, "text/csv", runsToCsv(sessions))}><DownloadIcon />CSV, every run</button>
          <button type="button" className="btn btn-secondary" onClick={() => download(`wayfinding-all-${stamp()}.json`, "application/json", toJsonBundle(sessions, content, now()))}><DownloadIcon />JSON, everything</button>
        </div>
      </div>
      <p className="m-lede">{countedSessions(sessions)} counted participant{countedSessions(sessions) === 1 ? "" : "s"}. Practice sessions and interrupted attempts are not counted; each participant counts once per task, even if their ID was run more than once (the newest session wins).</p>
      <p className="m-hint"><strong>Read with care.</strong> At these sample sizes the figures are directional. Mobile and tablet frames show how the layout is understood: clicks are recorded as taps and touch ability is not tested. A participant does different tasks at different breakpoints, so a person can appear in more than one table below, but never twice for the same task. The three breakpoints are never pooled, and the position column shows how early in the session people met each task (the earlier, the less of the navigation they had seen). Level 1 is the section chosen, Level 2 the destination. Verdict is the worse of the two levels: Pass at {THRESHOLDS.pass * 100}% or more, Watch at {THRESHOLDS.watch * 100}% to {THRESHOLDS.pass * 100 - 1}%, Fail below that (proposed thresholds). Search and separately recorded answers are reported, not scored. Tiers are the tool's suggestion until you add findings for a run (see the Reviewed column and the list at the foot of this page); your choice then replaces the suggestion in these figures.</p>
      {rows.length === 0 && <p className="m-empty">No counted runs yet. Results appear here as soon as a participant finishes a task.</p>}
      {BREAKPOINT_IDS.map((bp) => {
        const list = rows.filter((r) => r.breakpoint === bp);
        if (list.length === 0) return null;
        return (
          <section key={bp} aria-labelledby={`l-${bp}`}>
            <h2 id={`l-${bp}`}>{BREAKPOINTS[bp].label}</h2>
            <div className="m-scroll">
              <table className="m-table m-ledger">
                <thead><tr><th>Task</th><th>n</th><th>Level 1 section</th><th>Level 2 destination</th><th>Verdict</th><th>Reviewed</th><th>First interaction (median)</th><th>Ease (mean)</th><th>Position (mean)</th><th>Confident wrong</th><th>Prompted</th><th>Search / separate</th><th>Final column</th><th>Misread sections</th><th>First click zone</th><th>Coded answers</th><th>Confidence (mean)</th><th>Doubts</th></tr></thead>
                <tbody>
                  {list.map((t: TaskTally) => (
                    <tr key={t.taskId}>
                      <th scope="row">{t.taskId} {t.title}{t.highRisk ? " (high risk)" : ""}{t.contentVersions.length > 1 && <small className="m-note"> scored against content versions {t.contentVersions.join(", ")}: the targets changed part-way through</small>}</th><td>{t.n}</td><td>{pct(t.level1)}</td><td>{pct(t.level2)}</td><td>{t.kind === "observe" ? <span className="m-verdict m-verdict-na">Not scored</span> : <Badge v={t.verdict} />}</td><td>{t.reviewed} of {t.n}</td>
                      <td>{seconds(t.medianFirstInteractionMs)}</td><td>{t.meanEase === null ? "n/a" : t.meanEase.toFixed(1)}</td><td>{t.meanPosition === null ? "n/a" : t.meanPosition.toFixed(1)}</td><td>{t.confidentWrong}</td>
                      <td>{t.prompts.prompted}</td><td>{t.recordedOnly} / {t.separate}</td><td>{split(t.routeSplit)}</td><td>{split(t.misreads, sectionLabel)}</td>
                      <td>{t.kind === "click" ? split(t.zones, zoneLabel) : "n/a"}</td><td>{codedText(t)}</td><td>{t.meanConfidence === null ? "n/a" : t.meanConfidence.toFixed(1)}</td><td>{t.doubts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {participants.length > 0 && (
        <section aria-labelledby="findings-h" className="m-findings">
          <h2 id="findings-h">Add or edit findings</h2>
          <p className="m-hint">Grouped by participant. Open any completed run to record what you observed, what the participant expected, and to change the suggested tier. This can be done at any time after the session.</p>
          {participants.map(([pid, list]) => {
            const done = list.filter(({ r }) => r.moderator.reviewed).length;
            return (
              <details key={pid} className="m-findings-group" open>
                <summary><strong>{pid}</strong> <span className="m-note-quiet">{list.length} task{list.length === 1 ? "" : "s"}, findings on {done}</span></summary>
                <div className="m-scroll">
                  <table className="m-table">
                    <caption className="sr-only">Completed runs for {pid}, with findings status</caption>
                    <thead><tr><th>#</th><th>Task</th><th>Breakpoint</th><th>Tier</th><th>Ease</th><th>Findings</th><th><span className="sr-only">Action</span></th></tr></thead>
                    <tbody>
                      {list.map(({ s, r }) => {
                        const e = effective(r);
                        const title = s.content.tasks.find((x) => x.id === r.taskId)?.title ?? "";
                        return (
                          <tr key={r.runId}>
                            <td>{r.position + 1}</td><th scope="row">{r.taskId} {title}</th><td>{BREAKPOINTS[r.breakpoint].label}</td>
                            <td>{e.tier ? `${e.tier} ${TIER_LABELS[e.tier]}` : "n/a"}</td><td>{r.ease ?? "n/a"}</td><td>{r.moderator.reviewed ? "Added" : "None yet"}</td>
                            <td><button type="button" className="btn btn-secondary" onClick={() => onReview(s.id, r.runId)}>{r.moderator.reviewed ? "Edit" : "Add"}<span className="sr-only"> findings for {r.taskId} {title}, {pid}</span></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
        </section>
      )}
    </main>
  );
}
