import { useEffect, useRef, useState } from "react";
import { makeId } from "../state.tsx";

export interface AdminItem { label: string; onSelect: () => void }

/**
 * One small, quiet "Admin" button that opens a short list of the actions a participant should rarely need (ending the
 * session, clearing saved progress). It is a disclosure, not a menu: the items are ordinary buttons, in the tab order
 * once it is open. Escape or a click elsewhere closes it.
 */
export function AdminMenu({ items }: { items: AdminItem[] }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [listId] = useState(() => makeId("admin"));
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); button.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey, true); };
  }, [open]);
  if (items.length === 0) return null;
  return (
    <div className="p-admin" ref={root}>
      <button ref={button} type="button" className="p-admin-btn" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={() => setOpen((o) => !o)}>
        Admin
        <svg className="p-admin-caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <ul className="p-admin-list" id={listId}>
          {items.map((i) => (
            <li key={i.label}><button type="button" className="p-admin-item" onClick={() => { setOpen(false); i.onSelect(); }}>{i.label}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
