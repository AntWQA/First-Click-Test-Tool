import { useState } from "react";
import { useApp } from "../state.tsx";
import { BREAKPOINTS } from "../../shared/protocol.ts";
import type { Breakpoint } from "../../shared/protocol.ts";
import { planCounts } from "../domain/session.ts";
import type { Group, Session, SetupPatch } from "../domain/session.ts";
import { taskById } from "../domain/content.ts";
import { Confirm } from "./Confirm.tsx";
import { useEnterPrimary } from "../Shortcuts.tsx";

/** The next unused participant ID: P1, P2... Roster IDs P1 to P10 get the task orders on the FigJam board. */
export function nextParticipantId(sessions: Session[], exceptId?: string): string {
  const used = new Set(sessions.filter((s) => s.id !== exceptId).map((s) => s.participantId));
  for (let i = 1; i < 1000; i++) if (!used.has("P" + i)) return "P" + i;
  return "P1";
}

const summary = (s: Session) => {
  const n = planCounts(s);
  return (["desktop", "mobile", "tablet"] as Breakpoint[]).filter((b) => n[b] > 0).map((b) => `${n[b]} at ${b}`).join(" · ");
};

export function Setup({ session }: { session: Session }) {
  const { dispatch, deleteSession, sessions } = useApp();
  const [discard, setDiscard] = useState(false);
  useEnterPrimary(".m-form button[type=submit]");
  const patch = (p: SetupPatch) => dispatch({ type: "setup", at: Date.now(), patch: p });
  const clash = sessions.some((s) => s.id !== session.id && !s.practice && s.participantId === session.participantId);
  const ready = session.participantId !== "" && session.order.length > 0;
  const hasOverrides = Object.keys(session.planOverrides).length > 0;

  return (
    <main className="m-page">
      <h1>New session</h1>
      <p><span className="pill">{session.order.length} tasks · about {Math.max(5, Math.round((session.order.length * 3) / 5) * 5)} min · {summary(session)}</span></p>
      <p className="m-lede">Set up, then hand the device to the participant. Nothing here is shown to them.</p>
      <form className="m-form" onSubmit={(e) => { e.preventDefault(); if (ready) dispatch({ type: "start", at: Date.now() }); }}>
        <div className="m-row">
          <label className="m-field">Participant ID
            <input value={session.participantId} onChange={(e) => patch({ participantId: e.target.value })} maxLength={40} aria-describedby="pid-hint" />
            <small id="pid-hint">An ID only (P1, P2 and so on). Never a name. The ID sets the task order and which tasks run at which breakpoint.</small>
          </label>
          <label className="m-field">Group
            <select value={session.group} onChange={(e) => patch({ group: e.target.value as Group })}>
              <option value="">Not recorded</option><option value="non-member">Non-member</option><option value="WA">WA</option><option value="WC">WC</option>
            </select>
          </label>
        </div>
        {clash && <p className="m-warn" role="status">A session for {session.participantId} already exists. Use a different ID unless this is a deliberate repeat; if it is, the Ledger counts the newest session for each task and never both.</p>}
        <fieldset className="m-checks">
          <legend>Options</legend>
          <label><input type="checkbox" checked={session.practice} onChange={(e) => patch({ practice: e.target.checked })} /> Practice run: kept out of the Ledger</label>
        </fieldset>
        <section aria-labelledby="order-h">
          <h2 id="order-h">Tasks and breakpoints ({session.order.length} tasks)</h2>
          <p className="m-hint">
            The order is randomised for this participant, with T1 and T2 never next to each other. A task that runs at only one breakpoint always uses it.
            A task that runs at several (desktop, mobile, tablet, as set in the task content) is rotated across them by participant number, so across participants each is seen about equally at each and each person gets an even mix. Reserve tasks are offered at the end of the session.
            Nobody does the same task twice. Change any task below if the test needs it; both are fixed when the session starts.
          </p>
          <div className="m-scroll">
            <table className="m-table m-plan">
              <caption className="sr-only">The order of tasks and the breakpoint each runs at</caption>
              <thead><tr><th>#</th><th>Task</th><th>Breakpoint</th></tr></thead>
              <tbody>
                {session.order.map((id, i) => {
                  const task = taskById(session.content, id);
                  const options = task?.breakpoints ?? ["desktop"];
                  return (
                    <tr key={id}>
                      <td>{i + 1}</td>
                      <td><strong>{id}</strong> {task?.title}</td>
                      <td>
                        <select aria-label={`Breakpoint for ${id} ${task?.title ?? ""}`} value={session.plan[id]} disabled={options.length === 1}
                          onChange={(e) => patch({ planOverrides: { ...session.planOverrides, [id]: e.target.value as Breakpoint } })}>
                          {options.map((b) => <option key={b} value={b}>{BREAKPOINTS[b].label}</option>)}
                        </select>
                        {options.length === 1 && <small className="m-note-quiet"> only runs here</small>}
                        {session.planOverrides[id] !== undefined && options.length > 1 && <small className="m-note-quiet"> chosen by you</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasOverrides && <p><button type="button" className="btn btn-quiet" onClick={() => patch({ planOverrides: {} })}>Reset to the automatic rotation</button></p>}
          {session.order.length === 0 && <p className="m-warn" role="status">No tasks to run. Check the Content tab.</p>}
        </section>
        <div className="m-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setDiscard(true)}>Discard</button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={!ready}>Hand over to participant <span className="enter-chip" aria-hidden="true">↵</span></button>
        </div>
      </form>
      {discard && <Confirm title="Discard this session?" confirmLabel="Discard" danger onCancel={() => setDiscard(false)} onConfirm={() => deleteSession(session.id)}>Nothing has been recorded yet.</Confirm>}
    </main>
  );
}
