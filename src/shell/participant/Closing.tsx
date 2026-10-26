import { useEffect, useRef, useState } from "react";
import type { FormEvent, PointerEvent as ReactPointerEvent } from "react";
import { useApp } from "../state.tsx";
import { closingQuestionsFor } from "../domain/session.ts";
import type { Session } from "../domain/session.ts";
import { OTHER_OPTION } from "../domain/tasks.ts";
import type { ClosingQuestion } from "../domain/tasks.ts";

/** True when the closing questions should be put to this participant now: at the hand-back screen, with questions to ask and none answered yet. The moderated tool and the participant edition use the same rule. */
export const needsClosing = (s: Session): boolean => s.phase === "handBack" && s.closing === undefined && closingQuestionsFor(s).length > 0;

interface Choice { choice: string; words: string }
interface Order { items: string[]; set: boolean }

/** The words that label the box a chosen option opens: the question's own for an option with a box, "Please say what" for Other, none otherwise. */
const boxLabel = (q: ClosingQuestion, choice: string): string | undefined => (choice === OTHER_OPTION ? "Please say what" : q.follow?.[choice]);

/**
 * The closing questions, which replace the spoken debrief for the participant in both editions: a few last questions, answered on screen, after the last scenario and before the results
 * page. Every question is optional. A choice is one option, with a box for words only where the option has one (Other, or Yes and No on the video question). A ranking is four cards dragged
 * into order, recorded only once the participant has moved a card or said the order is right.
 */
export function Closing({ session }: { session: Session }) {
  const { dispatch } = useApp();
  const asked = closingQuestionsFor(session);
  const [text, setText] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const answers: Record<string, string | string[]> = {};
    for (const q of asked) {
      if (q.kind === "text") { if ((text[q.id] ?? "").trim() !== "") answers[q.id] = text[q.id]!; continue; }
      if (q.kind === "choice") {
        const c = choices[q.id];
        if (!c || c.choice === "") continue;
        const words = boxLabel(q, c.choice) !== undefined ? c.words.trim() : "";
        answers[q.id] = words === "" ? c.choice : `${c.choice}: ${words}`;
        continue;
      }
      const o = orders[q.id];
      if (o?.set) answers[q.id] = o.items;
    }
    dispatch({ type: "closing", at: Date.now(), answers });
  };

  return (
    <main className="p-screen p-center phase-enter">
      <form className="p-card p-closing" onSubmit={submit} noValidate>
        <p className="p-eyebrow">Nearly done</p>
        <h1 ref={heading} tabIndex={-1}>A few last questions</h1>
        <p>Every question is optional, so skip any you like.</p>
        {asked.map((q) => {
          if (q.kind === "text") {
            return (
              <label key={q.id} className="p-field p-setup-field" htmlFor={`cq-${q.id}`}>{q.prompt}
                <textarea id={`cq-${q.id}`} rows={3} maxLength={1500} value={text[q.id] ?? ""} onChange={(e) => setText({ ...text, [q.id]: e.target.value })} />
                {q.hint && <small>{q.hint}</small>}
              </label>
            );
          }
          if (q.kind === "choice") {
            return <ChoiceQuestion key={q.id} q={q} value={choices[q.id] ?? { choice: "", words: "" }} onChange={(v) => setChoices({ ...choices, [q.id]: v })} />;
          }
          return <RankQuestion key={q.id} q={q} value={orders[q.id] ?? { items: q.items ?? [], set: false }} onChange={(v) => setOrders({ ...orders, [q.id]: v })} />;
        })}
        <button type="submit" className="btn btn-primary btn-lg">Continue</button>
      </form>
    </main>
  );
}

function ChoiceQuestion({ q, value, onChange }: { q: ClosingQuestion; value: Choice; onChange: (v: Choice) => void }) {
  const options = [...(q.options ?? []), ...(q.other ? [OTHER_OPTION] : [])];
  const label = value.choice === "" ? undefined : boxLabel(q, value.choice);
  return (
    <fieldset className="p-choice">
      <legend>{q.prompt}</legend>
      {q.hint && <small>{q.hint}</small>}
      <div className="p-choice-list">
        {options.map((opt, i) => (
          <label key={opt} className={`p-choice-row${value.choice === opt ? " is-chosen" : ""}`} htmlFor={`cq-${q.id}-${i}`}>
            <input type="radio" id={`cq-${q.id}-${i}`} name={`cq-${q.id}`} value={opt} checked={value.choice === opt} onChange={() => onChange({ choice: opt, words: value.choice === opt ? value.words : "" })} />
            <span>{opt}</span>
          </label>
        ))}
      </div>
      {label !== undefined && (
        <label className="p-field p-choice-words" htmlFor={`cq-${q.id}-words`}>{label}
          <textarea id={`cq-${q.id}-words`} rows={2} maxLength={1500} value={value.words} onChange={(e) => onChange({ ...value, words: e.target.value })} />
        </label>
      )}
    </fieldset>
  );
}

/**
 * Four cards to put in order. Dragging a card by its handle moves it past the others as the pointer crosses their middles (mouse, pen and touch); the arrow
 * buttons move a card one place for anyone who cannot or would rather not drag. The answer counts once a card has been moved or "The order is right" pressed.
 */
function RankQuestion({ q, value, onChange }: { q: ClosingQuestion; value: Order; onChange: (v: Order) => void }) {
  const cards = useRef<Record<string, HTMLLIElement | null>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const refocus = useRef<string[]>([]);
  const list = useRef<HTMLOListElement>(null);
  const { items } = value;

  useEffect(() => {
    for (const id of refocus.current) {
      const el = document.getElementById(id) as HTMLButtonElement | null;
      if (el && !el.disabled) { el.focus(); break; }
    }
    refocus.current = [];
  }, [items]);

  const move = (item: string, to: number) => {
    const from = items.indexOf(item);
    if (to < 0 || to >= items.length || to === from) return;
    const next = items.filter((i) => i !== item);
    next.splice(to, 0, item);
    onChange({ items: next, set: true });
  };

  // The list holds the pointer (not the grip), because the grip is moved in the page as the card changes place.
  const onDown = (e: ReactPointerEvent<HTMLButtonElement>, item: string) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    list.current?.setPointerCapture(e.pointerId);
    setDragging(item);
  };
  const onMove = (e: ReactPointerEvent<HTMLOListElement>) => {
    if (dragging === null) return;
    const item = dragging;
    const others = items.filter((i) => i !== item);
    let to = 0;
    for (const o of others) {
      const r = cards.current[o]?.getBoundingClientRect();
      if (r && e.clientY > r.top + r.height / 2) to += 1;
    }
    move(item, to);
  };
  const onUp = () => setDragging(null);
  const press = (kind: "up" | "down", item: string, to: number) => {
    refocus.current = [`cq-${q.id}-${kind}-${to}`, `cq-${q.id}-${kind === "up" ? "down" : "up"}-${to}`];
    move(item, to);
  };

  return (
    <fieldset className="p-rank p-order">
      <legend>{q.prompt}</legend>
      {q.hint && <small>{q.hint}</small>}
      <div className="p-order-ends" aria-hidden="true"><span>Most sure</span></div>
      <ol ref={list} className="p-order-list" data-testid={`cq-${q.id}-order`} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {items.map((item, i) => (
          <li key={item} ref={(el) => { cards.current[item] = el; }} className={`p-order-card${dragging === item ? " is-dragging" : ""}`} data-item={item}>
            <span className="p-order-num" aria-hidden="true">{i + 1}</span>
            <span className="p-order-label">{item}</span>
            <span className="p-order-tools">
              <button type="button" id={`cq-${q.id}-up-${i}`} className="p-order-btn" aria-label={`Move "${item}" up, now number ${i + 1} of ${items.length}`} disabled={i === 0} onClick={() => press("up", item, i - 1)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
              </button>
              <button type="button" id={`cq-${q.id}-down-${i}`} className="p-order-btn" aria-label={`Move "${item}" down, now number ${i + 1} of ${items.length}`} disabled={i === items.length - 1} onClick={() => press("down", item, i + 1)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              <button type="button" className="p-order-grip" aria-label={`Drag "${item}" to change its place`} onPointerDown={(e) => onDown(e, item)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className="p-order-ends" aria-hidden="true"><span>Least sure</span></div>
      <div className="p-order-status" role="status">
        {value.set ? "Your order is saved." : <button type="button" className="btn btn-quiet" onClick={() => onChange({ items, set: true })}>The order is right</button>}
      </div>
    </fieldset>
  );
}
