import { useEffect, useRef, useState } from "react";
import { countedRuns } from "../domain/session.ts";
import type { Action, ReviewItem } from "../domain/importReview.ts";

const GROUP: Record<string, string> = { "": "not given", "non-member": "not a member", WC: "wholesale customer", WA: "Wellness Advocate" };

/**
 * Shown before anything from a file reaches the Ledger. A results file is made by someone else, so the tool says where it
 * came from (file name, size, fingerprint), what is in it, and what looks wrong, and anything that looks wrong starts on
 * Skip. Nothing changes until the researcher presses Import.
 */
export function ImportReview({ file, size, sha256, items, unreadable, onCancel, onApply }: {
  file: string; size: number; sha256: string | null; items: ReviewItem[]; unreadable: string[];
  onCancel: () => void; onApply: (items: ReviewItem[]) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState(items);
  useEffect(() => { ref.current?.showModal(); }, []);
  const set = (i: number, action: Action) => setRows((r) => r.map((x, j) => (j === i ? { ...x, action } : x)));
  const chosen = rows.filter((r) => r.action === "import").length;
  const held = rows.filter((r) => r.flags.some((f) => f.blocking)).length;
  return (
    <dialog ref={ref} className="m-dialog m-import" onClose={onCancel} aria-labelledby="imp-title">
      <h2 id="imp-title">Review this import</h2>
      <p className="m-hint">
        <strong>{file}</strong>, {size < 1024 ? `${size} bytes` : `${(size / 1024).toFixed(0)} KB`}.{" "}
        {sha256 ? <>SHA-256 <code className="m-hash">{sha256}</code></> : "A fingerprint could not be made in this browser."}
      </p>
      <p>A results file is made on someone else's computer, so check it before it joins your Ledger.
        {held > 0 ? ` ${held} of ${rows.length} look${held === 1 ? "s" : ""} wrong and ${held === 1 ? "is" : "are"} set to skip.` : " Nothing looks wrong."}</p>
      {unreadable.length > 0 && <p className="m-warn" role="status">{unreadable.length} session{unreadable.length === 1 ? " was" : "s were"} left out because {unreadable.length === 1 ? "it" : "they"} could not be read: {[...new Set(unreadable)].join("; ")}.</p>}
      <div className="m-scroll">
        <table className="m-table">
          <caption className="sr-only">The sessions in this file</caption>
          <thead><tr><th>Code</th><th>Scenarios done</th><th>Member</th><th>What the tool noticed</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.session.id}>
                <th scope="row">{r.session.participantId || "(no code)"}{r.session.selfRun ? <small className="m-note-quiet"> self-run</small> : null}</th>
                <td>{countedRuns(r.session).length} of {r.session.order.length}</td>
                <td>{GROUP[r.session.group] ?? "not given"}</td>
                <td>{r.flags.length === 0 ? <span className="m-note-quiet">Nothing</span> : <ul className="m-flags">{r.flags.map((f) => <li key={f.kind} className={f.blocking ? "is-block" : ""}>{f.text}</li>)}</ul>}</td>
                <td>
                  <select aria-label={`What to do with ${r.session.participantId || "this session"}`} value={r.action} onChange={(e) => set(i, e.target.value as Action)}>
                    <option value="import">Import</option><option value="skip">Skip</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="m-dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={chosen === 0} onClick={() => onApply(rows)}>Import {chosen} session{chosen === 1 ? "" : "s"}</button>
      </div>
    </dialog>
  );
}
