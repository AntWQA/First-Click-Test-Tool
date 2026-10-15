import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/** A native modal dialog: focus is trapped and Escape cancels without any extra code. */
export function Confirm({ title, children, confirmLabel, danger = false, alt, onConfirm, onCancel }: {
  title: string; children: ReactNode; confirmLabel: string; danger?: boolean; alt?: { label: string; onClick: () => void }; onConfirm: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="m-dialog" onClose={onCancel} aria-labelledby="confirm-title">
      <h2 id="confirm-title">{title}</h2>
      <div>{children}</div>
      <div className="m-dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()}>Cancel</button>
        {alt && <button type="button" className="btn btn-secondary" onClick={alt.onClick}>{alt.label}</button>}
        <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={() => { onConfirm(); }}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
