import { useCallback, useState } from "react";
import { BREAKPOINTS, BREAKPOINT_IDS } from "../../shared/protocol.ts";
import type { Breakpoint, ProtoMessage } from "../../shared/protocol.ts";
import { Frame } from "../Frame.tsx";
import { describeEvent } from "../format.ts";

/** Rehearsal: the prototype at each breakpoint with a live view of what the recorder reports. Nothing here is saved. */
export function Preview() {
  const [bp, setBp] = useState<Breakpoint>("desktop");
  const [resetKey, setResetKey] = useState(0);
  const [log, setLog] = useState<ProtoMessage[]>([]);
  const onMessage = useCallback((m: ProtoMessage) => setLog((l) => (m.type === "ready" ? [m] : [...l.slice(-29), m])), []);
  const readyAt = log.find((m) => m.type === "ready")?.at ?? 0;
  return (
    <div className="check">
      <div className="check-bar">
        <h1>Preview</h1>
        {BREAKPOINT_IDS.map((b) => <button key={b} type="button" aria-pressed={bp === b} onClick={() => setBp(b)}>{BREAKPOINTS[b].label}</button>)}
        <button type="button" onClick={() => { setLog([]); setResetKey((k) => k + 1); }}>Reset</button>
        <span data-testid="message-count">{log.length} recorded</span>
        <details className="check-log">
          <summary>What the recorder sees</summary>
          <ol>{log.slice(-8).map((m, i) => <li key={i}>{describeEvent(m, readyAt)}</li>)}</ol>
        </details>
      </div>
      <Frame breakpoint={bp} resetKey={resetKey} onMessage={onMessage} />
    </div>
  );
}
