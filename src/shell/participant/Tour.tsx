import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface TourStep {
  /** The element the step points at, read when the step is shown. */
  target: () => HTMLElement | null;
  title: string;
  text?: string;
}

/**
 * The same minimal onboarding the Tree Testing and Card Sort tools use: a spotlight on one real element with a small
 * tip (step label, short title, one line, Skip, Back, Next). It appears a beat after the screen does, can be skipped
 * with the button or Esc, and moves keyboard focus into the tip and then on to `returnFocus`. The time it is on screen
 * is reported through `onVisibleMs` so the caller can leave it out of the reading time.
 */
export function Tour({ steps, delayMs = 900, onClose, onVisibleMs, returnFocus }: {
  steps: TourStep[]; delayMs?: number; onClose: () => void; onVisibleMs: (ms: number) => void; returnFocus?: () => HTMLElement | null;
}) {
  const [i, setI] = useState<number | null>(null);
  const [place, setPlace] = useState<{ spot: { top: number; left: number; width: number; height: number }; tip: { left: number; width: number; top?: number; bottom?: number } } | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const shownAt = useRef<number | null>(null);

  // A beat of plain screen first.
  useEffect(() => { const t = window.setTimeout(() => setI(0), delayMs); return () => window.clearTimeout(t); }, [delayMs]);

  // Count the time the tour is on screen, however it ends (closed, or the participant pressed Begin underneath it).
  useEffect(() => {
    if (i === null) return undefined;
    shownAt.current = Date.now();
    return () => { if (shownAt.current !== null) { onVisibleMs(Date.now() - shownAt.current); shownAt.current = null; } };
  }, [i === null, onVisibleMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const measure = useCallback(() => {
    if (i === null) return;
    const el = steps[i]?.target();
    if (!el) { setPlace(null); return; }
    const r = el.getBoundingClientRect();
    const width = Math.min(300, window.innerWidth - 24);
    const left = Math.min(Math.max(r.left, 12), window.innerWidth - width - 12);
    const gap = 26; // clears the spotlight's own padding plus a visual gap
    const below = window.innerHeight - r.bottom;
    const tipPos = below < 200 && r.top > 200 ? { bottom: window.innerHeight - r.top + gap } : { top: r.bottom + gap };
    setPlace({ spot: { top: r.top - 12, left: r.left - 12, width: r.width + 24, height: r.height + 24 }, tip: { left, width, ...tipPos } });
  }, [i, steps]);
  useLayoutEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const close = useCallback(() => { onClose(); window.setTimeout(() => returnFocus?.()?.focus(), 0); }, [onClose, returnFocus]);
  useEffect(() => { if (i !== null && place) tip.current?.focus(); }, [i, place === null]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (i === null) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, close]);

  if (i === null || !place) return null;
  const step = steps[i]!;
  const last = i === steps.length - 1;
  const next = () => { if (last) close(); else setI(i + 1); };
  return (
    <div className="tour-root">
      <div className="tour-spotlight" style={place.spot} aria-hidden="true" />
      <div
        className="tour-tip" ref={tip} role="dialog" tabIndex={-1} aria-labelledby="tour-title" aria-describedby={step.text ? "tour-text" : undefined}
        style={place.tip}
        onKeyDown={(e) => { if (e.key === "Enter" && e.target === tip.current) { e.preventDefault(); next(); } }}
      >
        <div className="tour-step">Step {i + 1} of {steps.length}</div>
        <div className="tour-title" id="tour-title">{step.title}</div>
        {step.text && <div className="tour-text" id="tour-text">{step.text}</div>}
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={close}>Skip</button>
          <div className="tour-nav">
            {i > 0 && <button type="button" className="btn btn-secondary" onClick={() => setI(i - 1)}>Back</button>}
            <button type="button" className="btn btn-primary" onClick={next}>{last ? "Got it" : "Next →"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
