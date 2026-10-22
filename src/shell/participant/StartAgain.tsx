import { useEffect, useRef, useState } from "react";
import { useApp } from "../state.tsx";

/**
 * A way to throw away what THIS TEST has saved in the browser and begin again: the session in progress and any saved copy of the tasks.
 * Behind a confirmation, because it also deletes answers that have not been saved to a file.
 */
export function StartAgain({ saved = false }: { saved?: boolean }) {
  const { clearAllSaved } = useApp();
  const [ask, setAsk] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (ask) ref.current?.showModal(); }, [ask]);
  return (
    <>
      <button type="button" className="p-textlink" onClick={() => setAsk(true)}>Clear my progress in this test and start again</button>
      {ask && (
        <dialog ref={ref} className="p-dialog" onClose={() => setAsk(false)} aria-labelledby="again-title">
          <h2 id="again-title">Start again from the beginning?</h2>
          <p>{saved ? "This deletes only the results this test has saved in this browser. Save your results file first if you want to keep them." : "This deletes only the progress this test has saved in this browser, including any answers you have not saved to a file, and the first screen appears again."} Nothing else in your browser is touched: your history, cookies, passwords and other sites are left alone.</p>
          <div className="p-dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()}>Keep what I have</button>
            <button type="button" className="btn btn-danger" onClick={clearAllSaved}>Yes, start again</button>
          </div>
        </dialog>
      )}
    </>
  );
}
