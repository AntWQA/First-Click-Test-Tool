import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useApp } from "../state.tsx";
import { closingQuestionsFor } from "../domain/session.ts";
import type { Session } from "../domain/session.ts";
import type { ClosingQuestion } from "../domain/tasks.ts";

/**
 * The participant edition's debrief: a few last questions, answered on screen, after the last scenario and before the results
 * page. Every question is optional. A ranking is recorded only when every item has its own place.
 */
export function Closing({ session }: { session: Session }) {
  const { dispatch } = useApp();
  const asked = closingQuestionsFor(session);
  const [text, setText] = useState<Record<string, string>>({});
  const [ranks, setRanks] = useState<Record<string, Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const answers: Record<string, string | string[]> = {};
    for (const q of asked) {
      if (q.kind === "text") { if ((text[q.id] ?? "").trim() !== "") answers[q.id] = text[q.id]!; continue; }
      const items = q.items ?? [];
      const given = items.map((i) => ranks[q.id]?.[i] ?? "");
      if (given.every((g) => g === "")) continue;
      if (given.some((g) => g === "") || new Set(given).size !== given.length) {
        setError(`For "${q.prompt.slice(0, 60)}...", give every item its own number from 1 to ${items.length}, or leave them all blank to skip.`);
        return;
      }
      answers[q.id] = items.slice().sort((a, b) => Number(ranks[q.id]![a]) - Number(ranks[q.id]![b]));
    }
    dispatch({ type: "closing", at: Date.now(), answers });
  };

  return (
    <main className="p-screen p-center phase-enter">
      <form className="p-card p-closing" onSubmit={submit} noValidate>
        <p className="p-eyebrow">Nearly done</p>
        <h1 ref={heading} tabIndex={-1}>A few last questions</h1>
        <p>Please answer in your own words. Every question is optional, so skip any you like.</p>
        {asked.map((q) => (q.kind === "text" ? (
          <label key={q.id} className="p-field p-setup-field" htmlFor={`cq-${q.id}`}>{q.prompt}
            <textarea id={`cq-${q.id}`} rows={3} maxLength={1500} value={text[q.id] ?? ""} onChange={(e) => { setText({ ...text, [q.id]: e.target.value }); setError(null); }} />
            {q.hint && <small>{q.hint}</small>}
          </label>
        ) : (
          <Rank key={q.id} q={q} value={ranks[q.id] ?? {}} onChange={(v) => { setRanks({ ...ranks, [q.id]: v }); setError(null); }} />
        )))}
        <p className="p-error" role="alert">{error}</p>
        <button type="submit" className="btn btn-primary btn-lg">Continue</button>
      </form>
    </main>
  );
}

function Rank({ q, value, onChange }: { q: ClosingQuestion; value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const items = q.items ?? [];
  return (
    <fieldset className="p-rank">
      <legend>{q.prompt}</legend>
      {q.hint && <small>{q.hint}</small>}
      {items.map((item, i) => (
        <label key={item} className="p-rank-row" htmlFor={`cq-${q.id}-${i}`}>
          <span>{item}</span>
          <select id={`cq-${q.id}-${i}`} value={value[item] ?? ""} onChange={(e) => onChange({ ...value, [item]: e.target.value })}>
            <option value="">Choose</option>
            {items.map((_, n) => <option key={n} value={String(n + 1)}>{n + 1}</option>)}
          </select>
        </label>
      ))}
    </fieldset>
  );
}
