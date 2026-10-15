import { useCallback, useEffect, useRef, useState } from "react";
import { BREAKPOINTS, BREAKPOINT_IDS } from "../../shared/protocol.ts";
import type { Breakpoint, ProtoMessage } from "../../shared/protocol.ts";
import { Frame } from "../Frame.tsx";
import { describeEvent } from "../format.ts";

/** The log keeps the latest events; a long rehearsal drops the oldest, but the numbering and the count keep going. */
const KEEP = 200;
interface Recorded { events: ProtoMessage[]; total: number; readyAt: number }
const EMPTY: Recorded = { events: [], total: 0, readyAt: 0 };

/** Rehearsal: the prototype at each breakpoint with a live view of what the recorder reports. Nothing here is saved. */
export function Preview() {
  const [bp, setBp] = useState<Breakpoint>("desktop");
  const [resetKey, setResetKey] = useState(0);
  const [rec, setRec] = useState<Recorded>(EMPTY);
  const list = useRef<HTMLOListElement>(null);
  // "ready" starts a new run: the clock restarts, so the log restarts with it. Anything else is added to the end.
  const onMessage = useCallback((m: ProtoMessage) => setRec((r) => (m.type === "ready"
    ? { events: [m], total: 1, readyAt: m.at }
    : { events: [...r.events.slice(-(KEEP - 1)), m], total: r.total + 1, readyAt: r.readyAt })), []);
  // Keep the newest event in view as the log grows.
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [rec.total]);
  // Changing the breakpoint restarts the prototype at the new size, so the log begins with its own "Menu ready (w x h)" and a demonstration never shows the previous breakpoint's events.
  const pick = (b: Breakpoint) => { if (b === bp) return; setBp(b); setRec(EMPTY); setResetKey((k) => k + 1); };
  const first = rec.total - rec.events.length + 1;
  return (
    <div className="check">
      <div className="check-bar">
        <h1>Preview</h1>
        {BREAKPOINT_IDS.map((b) => <button key={b} type="button" aria-pressed={bp === b} onClick={() => pick(b)}>{BREAKPOINTS[b].label}</button>)}
        <button type="button" onClick={() => { setRec(EMPTY); setResetKey((k) => k + 1); }}>Reset</button>
        <span data-testid="message-count">{rec.total} recorded</span>
        <details className="check-log">
          <summary>What the recorder sees</summary>
          <ol ref={list} start={first}>{rec.events.map((m, i) => <li key={first + i}>{describeEvent(m, rec.readyAt)}</li>)}</ol>
        </details>
      </div>
      <Frame breakpoint={bp} resetKey={resetKey} onMessage={onMessage} />
    </div>
  );
}
