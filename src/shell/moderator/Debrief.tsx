import { useState } from "react";
import { useApp } from "../state.tsx";
import { countedRuns, effective } from "../domain/session.ts";
import type { Session } from "../domain/session.ts";
import { toJsonBundle, runsToCsv } from "../domain/exports.ts";
import { download, seconds, stamp, TIER_LABELS } from "../format.ts";
import { BREAKPOINTS } from "../../shared/protocol.ts";

export function Debrief({ session, onReview }: { session: Session; onReview: (sessionId: string, runId: string) => void }) {
  const { dispatch, closeSession, content } = useApp();
  const [notes, setNotes] = useState(session.debriefNotes);
  const [backup, setBackup] = useState(true);
  const ended = session.phase === "ended";
  const counted = new Set(countedRuns(session).map((r) => r.runId));
  const file = `wayfinding-${session.participantId}-${stamp()}`;
  const saveBackup = () => download(`${file}.json`, "application/json", toJsonBundle([session], content, new Date().toISOString()));
  const finish = () => {
    if (backup) saveBackup();
    dispatch({ type: "debrief", at: Date.now(), notes });
    dispatch({ type: "finish", at: Date.now() });
  };
  return (
    <main className="m-page">
      <p className="m-kicker">{session.participantId}{session.practice ? " · practice" : ""}</p>
      <h1>{ended ? "Session record" : session.status === "ended-early" ? "Session ended early" : "Tasks complete"}</h1>
      {!ended && <p className="m-lede">Ask: "Which task felt hardest?" "Was there anything you expected in the menu that wasn't there?" "Anything you would rename?" Explain any label only now, never before a task. Then thank them. Findings for each task can be added here, or later from the Ledger; nothing has to be done before the next participant.</p>}
      <table className="m-table">
        <caption className="sr-only">Every attempt in this session</caption>
        <thead><tr><th>Task</th><th>Breakpoint</th><th>Attempt</th><th>Status</th><th>Tier</th><th>Ease</th><th>First interaction</th><th>Counted</th><th>Findings</th></tr></thead>
        <tbody>
          {session.runs.map((r) => {
            const t = session.content.tasks.find((x) => x.id === r.taskId);
            const e = effective(r);
            return (
              <tr key={r.runId}>
                <td>{r.taskId} {t?.title}</td><td>{BREAKPOINTS[r.breakpoint].label}</td><td>{r.attempt}</td><td>{r.status}</td>
                <td>{e.tier ? `${e.tier} ${TIER_LABELS[e.tier]}` : "n/a"}</td><td>{r.ease ?? "n/a"}</td><td>{seconds(r.suggestion?.firstInteractionMs)}</td><td>{counted.has(r.runId) ? "Yes" : "No"}</td>
                <td>{r.status === "completed" ? <button type="button" className="btn btn-quiet" onClick={() => onReview(session.id, r.runId)}>{r.moderator.reviewed ? "Edit" : "Add"}<span className="sr-only"> findings for {r.taskId} {t?.title}</span></button> : <span className="m-note-quiet">n/a</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {session.interruptions > 0 && <p className="m-warn">This session was interrupted {session.interruptions} time{session.interruptions === 1 ? "" : "s"}. Timings around the interruption are not comparable.</p>}
      <label className="m-field">Debrief notes
        <textarea rows={5} value={notes} readOnly={ended} onChange={(e) => setNotes(e.target.value)} onBlur={() => { if (!ended) dispatch({ type: "debrief", at: Date.now(), notes }); }} />
      </label>
      <div className="m-actions">
        <button type="button" className="btn btn-secondary" onClick={saveBackup}>Download this session (JSON)</button>
        <button type="button" className="btn btn-secondary" onClick={() => download(`${file}.csv`, "text/csv", runsToCsv([session]))}>Download CSV</button>
        {ended ? (
          <button type="button" className="btn btn-primary" onClick={closeSession}>Back to sessions</button>
        ) : (
          <>
            <label className="m-inline"><input type="checkbox" checked={backup} onChange={(e) => setBackup(e.target.checked)} /> Download a backup when I finish</label>
            <button type="button" className="btn btn-primary btn-lg" onClick={finish}>Finish session</button>
          </>
        )}
      </div>
    </main>
  );
}
