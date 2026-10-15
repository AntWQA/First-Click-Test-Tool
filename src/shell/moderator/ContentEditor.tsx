import { useEffect, useRef, useState } from "react";
import { useApp } from "../state.tsx";
import { nextContent, validateContent } from "../domain/content.ts";
import { DEFAULT_CONTENT } from "../domain/tasks.ts";
import { Confirm } from "./Confirm.tsx";

export function ContentEditor() {
  const { content, saveContent } = useApp();
  const [text, setText] = useState(() => JSON.stringify(content, null, 2));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [reset, setReset] = useState(false);

  const validate = (): ReturnType<typeof validateContent> => {
    try { return validateContent(JSON.parse(text)); } catch (e) { return { ok: false, errors: ["That is not valid JSON: " + (e as Error).message] }; }
  };
  const check = () => { const r = validate(); setErrors(r.ok ? [] : r.errors); setSaved(r.ok ? "Valid. Nothing has been saved." : null); };
  const save = () => {
    const r = validate();
    if (!r.ok) { setErrors(r.errors); setSaved(null); return; }
    const next = nextContent(content, r.content, new Date().toISOString());
    const res = saveContent(next);
    if (!res.ok) { setErrors([`Could not save (${res.reason}). Download a backup and free some browser storage.`]); return; }
    setErrors([]); setSaved(`Saved as version ${next.version}. New sessions will use it; existing sessions keep the version they started with.`);
    setText(JSON.stringify(next, null, 2));
  };

  // Ctrl or Cmd+S saves, even while typing in the editor (the whole point of a save shortcut).
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="m-page m-wide">
      <h1>Content</h1>
      <p className="m-lede">The tasks, their scenarios and the links that count as Primary, Acceptable or recorded separately. Version {content.version}. Edits are checked before saving: every link must exist in the navigation or footer, and ids must be unique. Each session keeps a copy of the version it ran against, so editing never rescores past sessions.</p>
      <label className="m-field">Tasks (JSON)
        <textarea className="m-code" rows={26} spellCheck={false} value={text} onChange={(e) => { setText(e.target.value); setSaved(null); }} aria-describedby="content-status" />
      </label>
      <div id="content-status" role="status">
        {errors.length > 0 && <ul className="m-errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        {saved && <p className="m-ok">{saved}</p>}
      </div>
      <div className="m-actions">
        <button type="button" className="btn btn-quiet" onClick={() => setReset(true)}>Reset to the plan's tasks</button>
        <button type="button" className="btn btn-secondary" onClick={check}>Check</button>
        <button type="button" className="btn btn-primary" onClick={save}>Save as version {content.version + 1}</button>
      </div>
      {reset && <Confirm title="Reset to the plan's tasks?" confirmLabel="Reset" onCancel={() => setReset(false)} onConfirm={() => { setReset(false); setText(JSON.stringify(DEFAULT_CONTENT, null, 2)); setSaved("Loaded the plan's tasks into the editor. Save to use them."); setErrors([]); }}>
        This replaces the text in the editor with the original {DEFAULT_CONTENT.tasks.length} tasks. Nothing is saved until you press Save.
      </Confirm>}
    </main>
  );
}
