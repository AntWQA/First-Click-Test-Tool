import { useRef, useState } from "react";
import { useApp } from "../state.tsx";
import { countedRuns, planCounts } from "../domain/session.ts";
import type { Phase, Session } from "../domain/session.ts";
import { parseImport, toJsonBundle } from "../domain/exports.ts";
import { reviewImport } from "../domain/importReview.ts";
import type { ReviewItem } from "../domain/importReview.ts";
import { ImportReview } from "./ImportReview.tsx";
import { clock, download, stamp } from "../format.ts";
import { DownloadIcon } from "../brand.tsx";
import { Confirm } from "./Confirm.tsx";
import { nextParticipantId } from "./Setup.tsx";

const PHASE: Record<Phase, string> = { setup: "Set up", intro: "In progress", task: "In progress", rating: "In progress", offer: "In progress", handBack: "In progress", debrief: "Debrief", ended: "Finished" };
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const breakpoints = (s: Session) => { const n = planCounts(s); return (["desktop", "mobile", "tablet"] as const).filter((b) => n[b] > 0).map((b) => `${n[b]} ${b}`).join(", ") || "none"; };
const statusOf = (s: Session) => (s.status === "ended-early" ? "Ended early" : PHASE[s.phase]);

export function Home() {
  const { sessions, start, openSession, deleteSession, content, applyImport, clearAllSaved } = useApp();
  const [del, setDel] = useState<Session | null>(null);
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [review, setReview] = useState<{ file: string; size: number; sha256: string | null; items: ReviewItem[]; unreadable: string[] } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const ordered = sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt);

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      if (f.size > MAX_IMPORT_BYTES) { setMsg(`That file is ${(f.size / 1048576).toFixed(0)} MB, which is too large for a session backup (limit ${MAX_IMPORT_BYTES / 1048576} MB).`); return; }
      const bytes = await f.arrayBuffer();
      const r = parseImport(new TextDecoder().decode(bytes));
      if (r.error) { setMsg(r.error); return; }
      if (r.sessions.length === 0) { setMsg(`Nothing in that file could be read${r.rejected.length ? ` (${[...new Set(r.rejected.map((x) => x.reason))].join("; ")})` : ""}.`); return; }
      let sha256: string | null = null;
      try { sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join(""); } catch { /* not available here */ }
      setMsg(null);
      setReview({ file: f.name.slice(0, 120), size: f.size, sha256, items: reviewImport(sessions, r.sessions, content), unreadable: r.rejected.map((x) => x.reason) });
    } finally {
      if (file.current) file.current.value = ""; // so choosing the same file again works
    }
  };

  return (
    <main className="m-page">
      <div className="m-titlebar">
        <h1>Sessions</h1>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => start({ participantId: nextParticipantId(sessions), group: "", practice: false })}>New session</button>
      </div>
      {ordered.length === 0 ? (
        <p className="m-empty">No sessions yet. Start one with New session. Sessions are saved in this browser as you go.</p>
      ) : (
        <table className="m-table">
          <caption className="sr-only">Saved sessions</caption>
          <thead><tr><th>Participant</th><th>Breakpoints</th><th>Group</th><th>Status</th><th>Tasks done</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {ordered.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.participantId || "(no ID)"}</strong>{s.practice ? " (practice)" : ""}{s.selfRun ? " (self-run)" : ""}{s.imported ? <small className="m-note-quiet"> from {s.imported.file}</small> : null}</td>
                <td>{breakpoints(s)}</td><td>{s.group || "n/a"}</td><td>{statusOf(s)}</td>
                <td>{countedRuns(s).length} of {s.order.length}</td><td>{clock(s.updatedAt)}</td>
                <td className="m-row-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => openSession(s.id)}>{s.phase === "ended" ? "View" : "Open"}<span className="sr-only"> {s.participantId}</span></button>
                  <button type="button" className="btn btn-quiet" onClick={() => setDel(s)}>Delete<span className="sr-only"> {s.participantId}</span></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <section className="m-backup" aria-labelledby="bk-h">
        <h2 id="bk-h">Backup and import</h2>
        <p className="m-hint">Sessions live only in this browser. Download a backup after every session; import it on another machine to carry on or to combine results.</p>
        <div className="m-actions">
          <button type="button" className="btn btn-secondary" disabled={sessions.length === 0} onClick={() => download(`wayfinding-all-${stamp()}.json`, "application/json", toJsonBundle(sessions, content, new Date().toISOString()))}><DownloadIcon />Download all sessions (JSON)</button>
          <button type="button" className="btn btn-secondary" onClick={() => file.current?.click()}>Import sessions (JSON)</button>
          <button type="button" className="btn btn-quiet" onClick={() => setClearing(true)}>Clear this test's saved data</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void onImport(e.target.files?.[0])} />
        </div>
        {msg && <p role="status" className="m-hint">{msg}</p>}
      </section>
      {del && <Confirm title={`Delete ${del.participantId || "this session"}?`} confirmLabel="Delete" danger onCancel={() => setDel(null)} onConfirm={() => { deleteSession(del.id); setDel(null); }}>
        This removes the session and its results from this browser. It cannot be undone, so download a backup first if you might need it.
      </Confirm>}
      {clearing && <Confirm title="Clear this test's saved data?" confirmLabel="Clear and reload" danger onCancel={() => setClearing(false)} onConfirm={clearAllSaved}
        alt={sessions.length > 0 ? { label: "Download a backup first", onClick: () => download(`wayfinding-all-${stamp()}.json`, "application/json", toJsonBundle(sessions, content, new Date().toISOString())) } : undefined}>
        This deletes only what Wayfinding Check has saved here: the {sessions.length} saved session{sessions.length === 1 ? "" : "s"} and any task edits from the Content tab. Your other browser data is not touched: no history, cookies, passwords or anything saved by other sites or tools. The tool then reloads with the built-in tasks. This cannot be undone. Use it when an old session or saved copy of the tasks is showing out-of-date wording.
      </Confirm>}
      {review && <ImportReview {...review} onCancel={() => setReview(null)} onApply={(items) => {
        const res = applyImport(items, { file: review.file, sha256: review.sha256 ?? "unavailable", size: review.size });
        setReview(null);
        setMsg(res.error ?? `Imported ${res.imported} session${res.imported === 1 ? "" : "s"}${res.skipped > 0 ? `, skipped ${res.skipped}` : ""}.`);
      }} />}
    </main>
  );
}
