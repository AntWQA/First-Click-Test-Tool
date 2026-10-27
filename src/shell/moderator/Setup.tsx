import { useState } from "react";
import { useApp } from "../state.tsx";
import { BREAKPOINTS } from "../../shared/protocol.ts";
import type { Breakpoint } from "../../shared/protocol.ts";
import { planCounts } from "../domain/session.ts";
import type { Group, Session, SetupPatch } from "../domain/session.ts";
import { taskById } from "../domain/content.ts";
import { ARRIVALS, ARRIVAL_LABELS } from "../domain/tasks.ts";
import type { Arrival } from "../domain/tasks.ts";
import { arrivalFor, deviceFor } from "../domain/order.ts";
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
  const combined = session.content.devicePerParticipant === true;
  const taskMinutes = session.order.reduce((sum, id) => sum + (taskById(session.content, id)?.minutes ?? 3), 0);
  // The combined run of show: 4 minutes welcome, 4 debrief and 2 buffer around the tasks; reserves and a 2 minute spare make 50.
  const estimate = combined ? Math.round(taskMinutes + 10) : Math.max(5, Math.round((session.order.length * 3) / 5) * 5);
  const autoDevice = deviceFor(session.content, session.participantId);
  const autoArrival = arrivalFor(session.participantId, session.group);

  return (
    <main className="m-page">
      <h1>New session</h1>
      <p><span className="pill">{session.order.length} tasks · about {estimate} min{combined ? " of the 50 allowed (reserves add up to 4)" : ""} · {summary(session)}</span></p>
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
        {combined && (
          <div className="m-row">
            <label className="m-field">Device for the whole session
              <select value={session.deviceOverride ?? ""} onChange={(e) => patch({ deviceOverride: e.target.value === "" ? undefined : (e.target.value as Breakpoint) })}>
                <option value="">Automatic ({autoDevice ? BREAKPOINTS[autoDevice].label : "per task"})</option>
                {(["desktop", "mobile"] as Breakpoint[]).map((b) => <option key={b} value={b}>{BREAKPOINTS[b].label}</option>)}
              </select>
              <small>From the participant number: odd desktop, even mobile, so six and six across twelve. Change it only to balance the sample.</small>
            </label>
            <label className="m-field">How they arrive at the product page
              <select value={session.arrivalOverride ?? ""} onChange={(e) => patch({ arrivalOverride: e.target.value === "" ? undefined : (e.target.value as Arrival) })}>
                <option value="">Automatic ({ARRIVAL_LABELS[autoArrival]})</option>
                {ARRIVALS.map((a) => <option key={a} value={a}>{ARRIVAL_LABELS[a]}</option>)}
              </select>
              <small>Homepage, Google result and shared link in turn, so each gets four of twelve. An existing customer (WA, WC) never gets the Google result. This sets only the line the participant reads: the page opens directly.</small>
            </label>
          </div>
        )}
        {clash && <p className="m-warn" role="status">A session for {session.participantId} already exists. Use a different ID unless this is a deliberate repeat; if it is, the Ledger counts the newest session for each task and never both.</p>}
        <fieldset className="m-checks">
          <legend>Options</legend>
          <label><input type="checkbox" checked={session.practice} onChange={(e) => patch({ practice: e.target.checked })} /> Practice run: kept out of the Ledger</label>
        </fieldset>
        <section aria-labelledby="order-h">
          <h2 id="order-h">Tasks and breakpoints ({session.order.length} tasks)</h2>
          {combined ? (
            <p className="m-hint">
              The homepage tasks (C1 to C3) come first, then the product page tasks (C4 to C8), then the navigation tasks (C9 to C12) in a seeded order with Sleep and Cough never next to each other.
              Every task runs on the one device above. Reserves are offered to the participant at the end, only if there is time (the plan says if the clock reads 40 minutes or less when navigation ends).
            </p>
          ) : (
          <p className="m-hint">
            The order is randomised for this participant, with T1 and T2 never next to each other. A task that runs at only one breakpoint always uses it.
            A task that runs at several (desktop, mobile, tablet, as set in the task content) is rotated across them by participant number, so across participants each is seen about equally at each and each person gets an even mix. Reserve tasks are offered at the end of the session.
            Nobody does the same task twice. Change any task below if the test needs it; both are fixed when the session starts.
          </p>
          )}
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
                      <td><strong>{id}</strong> {task?.title}{combined && task && <small className="m-note-quiet"> {task.minutes} min</small>}</td>
                      <td>
                        <select aria-label={`Breakpoint for ${id} ${task?.title ?? ""}`} value={session.plan[id]} disabled={options.length === 1 || combined}
                          onChange={(e) => patch({ planOverrides: { ...session.planOverrides, [id]: e.target.value as Breakpoint } })}>
                          {options.map((b) => <option key={b} value={b}>{BREAKPOINTS[b].label}</option>)}
                        </select>
                        {options.length === 1 && <small className="m-note-quiet"> only runs here</small>}{combined && options.length > 1 && <small className="m-note-quiet"> the session device</small>}
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
