import { useEffect, useRef } from "react";

const ROWS: { keys: string[]; desc: string; scope: string }[] = [
  { keys: ["Ctrl", "Shift", "M"], desc: "Open the moderator menu to end the session early", scope: "On any participant screen, even while the website has focus" },
  { keys: ["Enter"], desc: "Press the main button", scope: "Hand-over, Begin and Next screens, and findings, when no field is focused" },
  { keys: ["Esc"], desc: "Close a dialog", scope: "Anywhere" },
  { keys: ["?"], desc: "Show these shortcuts", scope: "Moderator screens, when no field is focused" },
];

/** The same shortcuts panel the other tools have: a modal list of keys. */
export function Shortcuts({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="shortcuts-panel" onClose={onClose} aria-labelledby="sc-title">
      <h2 id="sc-title">Keyboard shortcuts</h2>
      <ul className="shortcuts-list">
        {ROWS.map((r) => (
          <li key={r.desc}>
            <span className="desc">{r.desc}<span className="scope">{r.scope}</span></span>
            <span className="kbd-row">{r.keys.map((k) => <kbd key={k} className="kbd">{k}</kbd>)}</span>
          </li>
        ))}
      </ul>
      <div className="btn-row"><button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>Close</button></div>
    </dialog>
  );
}

/** Enter presses the page's main button when nothing else wants the key, as in the other tools. */
export function useEnterPrimary(selector: string, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector("dialog[open]")) return;
      const btn = document.querySelector<HTMLButtonElement>(selector);
      if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selector, active]);
}
