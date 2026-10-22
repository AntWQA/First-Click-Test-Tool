import { useEffect, useRef } from "react";
import { useApp } from "../state.tsx";

export const START_AGAIN_LABEL = "Clear my progress in this test and start again";

/**
 * The confirmation for throwing away what THIS TEST has saved in the browser (the session in progress and any saved copy of
 * the tasks) and beginning again. Reached from the Admin menu. It also deletes answers not yet saved to a file, so it asks.
 */
export function StartAgainDialog({ saved = false, onClose }: { saved?: boolean; onClose: () => void }) {
  const { clearAllSaved } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="p-dialog" onClose={onClose} aria-labelledby="again-title">
      <h2 id="again-title">Start again from the beginning?</h2>
      <p>{saved ? "This deletes only the results this test has saved in this browser. Save your results file first if you want to keep them." : "This deletes only the progress this test has saved in this browser, including any answers you have not saved to a file, and the first screen appears again."} Nothing else in your browser is touched: your history, cookies, passwords and other sites are left alone.</p>
      <div className="p-dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={() => { ref.current?.close(); onClose(); }}>Keep what I have</button>
        <button type="button" className="btn btn-danger" onClick={clearAllSaved}>Yes, start again</button>
      </div>
    </dialog>
  );
}
