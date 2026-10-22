import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { StartAgainDialog, START_AGAIN_LABEL } from "./StartAgain.tsx";
import { AdminMenu } from "./AdminMenu.tsx";
import { Closing, needsClosing } from "./Closing.tsx";
import { Cued } from "../Cued.tsx";
import type { FormEvent } from "react";
import { makeId, useApp } from "../state.tsx";
import { Frame } from "../Frame.tsx";
import { currentRun, leadInFor, reserveTasksLeft } from "../domain/session.ts";
import type { Session } from "../domain/session.ts";
import { taskById } from "../domain/content.ts";
import type { Task } from "../domain/tasks.ts";
import type { Breakpoint, ProtoMessage } from "../../shared/protocol.ts";
import { AppHeader } from "../AppHeader.tsx";
import { ArrowIcon, DeviceIcon, Logo, PersonIcon } from "../brand.tsx";
import { useEnterPrimary } from "../Shortcuts.tsx";
import { SELF_RUN } from "../edition.ts";
import { Tour } from "./Tour.tsx";
import type { TourStep } from "./Tour.tsx";

/**
 * Everything the participant sees. The name on screen is "Wayfinding Check", which keeps the method out of view, and
 * there is no moderator control on any of these screens. A moderator can reach an "end early" menu with Ctrl+Shift+M.
 */

/** What the participant is told they will be looking at: the device, not the pixel width. */
const DEVICE: Record<Breakpoint, string> = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" };

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Each screen moves focus to its heading, so a keyboard or screen reader user lands at the top of what changed. */
function useHeadingFocus(key: unknown) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => { ref.current?.focus(); }, [key]);
  return ref;
}

export function Participant({ session, theme, onToggleTheme }: { session: Session; theme: "light" | "dark"; onToggleTheme?: () => void }) {
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (SELF_RUN) return undefined; // no moderator in the participant edition, so no moderator menu
    const onKey = (e: KeyboardEvent) => { if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "m") { e.preventDefault(); setMenu(true); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // While the website is on screen the header steps aside, so the task banner is the top of the page and the website gets the room.
  const showHeader = !(session.phase === "task" && currentRun(session)?.status === "active");
  return (
    <div className="p-root" data-phase={session.phase}>
      {showHeader && <AppHeader moderator={false} theme={theme} onToggleTheme={onToggleTheme} />}
      {session.phase === "intro" && <Intro session={session} />}
      {session.phase === "task" && <Task key={currentRun(session)!.runId} session={session} onModeratorKey={() => setMenu(true)} />}
      {session.phase === "rating" && <Rating session={session} />}
      {session.phase === "offer" && <Offer session={session} />}
      {/* The moderated tool puts the same closing questions to the participant before the hand-back screen. */}
      {!SELF_RUN && needsClosing(session) && <Closing session={session} />}
      {session.phase === "handBack" && !SELF_RUN && !needsClosing(session) && <HandBack session={session} />}
      {menu && !SELF_RUN && <ModeratorMenu onClose={() => setMenu(false)} />}
    </div>
  );
}

function Intro({ session }: { session: Session }) {
  const { dispatch } = useApp();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [again, setAgain] = useState(false);
  useEnterPrimary(".p-intro .btn-primary");
  const first = session.runs.length === 0;
  const extra = !first && taskById(session.content, session.order[session.cursor] ?? "")?.reserve === true;
  const heading = useHeadingFocus("intro");
  return (
    <main className="p-screen p-center phase-enter">
      <div className="p-card p-intro">
        <p className="p-eyebrow">{first ? "Welcome" : extra ? "One more" : `Scenario ${session.cursor + 1} of ${session.order.length}`}</p>
        <h1 ref={heading} tabIndex={-1}>{first ? "Thanks for taking part" : "Ready for the next scenario?"}</h1>
        {first ? (
          <>
            <p>You will see a short scenario, then part of a website. Do what you would do first to find what you need, and tell us what you are thinking.</p>
            <p><strong>We are testing the website, not you.</strong> There are no right or wrong answers. If something is hard to find, that tells us how to improve the website. Please say your thoughts out loud as you go.</p>
          </>
        ) : (
          <p>The next scenario will start when you press the button.</p>
        )}
        <button type="button" className="btn btn-primary btn-lg" onClick={() => dispatch({ type: "present", at: Date.now(), runId: makeId("r") })}>
          {first ? "Show me the first scenario" : "Show me the next scenario"} <span className="enter-chip" aria-hidden="true">↵</span>
        </button>
        <AdminMenu items={[
          ...(!first ? [{ label: "End session", onSelect: () => setConfirmEnd(true) }] : []),
          ...(SELF_RUN ? [{ label: START_AGAIN_LABEL, onSelect: () => setAgain(true) }] : []),
        ]} />
        {again && <StartAgainDialog onClose={() => setAgain(false)} />}
        {confirmEnd && <EndConfirm onCancel={() => setConfirmEnd(false)} onConfirm={() => dispatch({ type: "stopSession", at: Date.now() })} />}
      </div>
    </main>
  );
}

function Task({ session, onModeratorKey }: { session: Session; onModeratorKey: () => void }) {
  const { dispatch } = useApp();
  const run = currentRun(session)!;
  const task = taskById(session.content, run.taskId)!;
  const leadIn = leadInFor(task, session);
  const begun = run.status === "active";
  const card = useRef<HTMLDivElement>(null);
  const before = useRef<DOMRect | null>(null);
  const heading = useHeadingFocus(`${run.runId}:${begun}`);
  // Onboarding: two steps on the very first scenario's brief screen (not on a retry, not on any later scenario).
  const [tourOn, setTourOn] = useState(session.cursor === 0 && run.attempt === 1 && !begun);
  const tourMs = useRef(0);
  const addTourMs = useCallback((ms: number) => { tourMs.current += ms; }, []);
  const tourSteps = useRef<TourStep[]>([
    { target: () => document.querySelector<HTMLElement>(".p-task-text"), title: "Your scenario", text: "Imagine you really are looking for this. The label shows which screen size you will see." },
    { target: () => document.querySelector<HTMLElement>(".p-task-card .btn-primary"), title: "Press Begin when you're ready", text: task.kind === "observe" ? "The website appears below. Look at it, say what you think, then press Done." : "The website appears below. Click where you would look first, or press I can't find it." },
  ]);
  useEnterPrimary(".p-task-card .btn-primary", !begun && !tourOn);
  // The end buttons wait for the website to be ready (plus a beat), so a double-click on Begin cannot land on "I can't find
  // it" as the buttons swap in. If the frame never reports, they unlock after 5 s; a moderator can always press Ctrl+Shift+M.
  const [canEnd, setCanEnd] = useState(false);
  const frameClock = useRef<{ frame: number; wall: number } | null>(null);

  const begin = () => {
    before.current = card.current?.getBoundingClientRect() ?? null;
    dispatch({ type: "begin", at: Date.now(), scale: 1, tourMs: tourMs.current });
  };

  useEffect(() => {
    if (!begun) return undefined;
    const t = window.setTimeout(() => setCanEnd(true), 5000);
    return () => window.clearTimeout(t);
  }, [begun]);

  /** The end of the task on the frame's own clock, so a menu left open at the end is measured to the moment it ended. */
  const frameNow = () => (frameClock.current ? frameClock.current.frame + (Date.now() - frameClock.current.wall) : undefined);
  const end = (reason: "found" | "gave-up") => dispatch({ type: "end", at: Date.now(), reason, frameAt: frameNow() });

  // The card moves from the middle of the screen to the top: measure where it was, let the layout change, then play the move.
  useLayoutEffect(() => {
    const from = before.current;
    before.current = null;
    if (!begun || !from || !card.current || reducedMotion()) return;
    const dy = from.top - card.current.getBoundingClientRect().top;
    card.current.animate([{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }], { duration: 520, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
  }, [begun]);

  useEffect(() => {
    if (!begun) return undefined;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [begun]);

  const onMessage = useCallback((m: ProtoMessage) => {
    if (m.type === "moderator-key") { onModeratorKey(); return; }
    if (m.type === "ready") { frameClock.current = { frame: m.at, wall: Date.now() }; window.setTimeout(() => setCanEnd(true), 500); }
    dispatch({ type: "event", event: m });
    // A click on a destination link (or a search) ends the task: this is a first click test, so the participant stops there.
    if ((m.type === "click" && m.ends) || m.type === "search-submit") dispatch({ type: "end", at: Date.now(), reason: "destination", frameAt: m.at });
  }, [dispatch, onModeratorKey]);
  const onScale = useCallback((scale: number) => dispatch({ type: "scale", scale }), [dispatch]);

  return (
    <main className={`p-screen p-task${begun ? " is-begun" : ""}`}>
      <div className="p-task-card" ref={card}>
        <span className="p-banner-logo"><Logo /></span>
        <div className="p-task-text">
          <p className="p-label">{begun ? "Your task" : task.reserve ? "One more scenario" : `Scenario ${session.cursor + 1} of ${session.order.length}`}</p>
          {leadIn && <p className="p-leadin">{leadIn}</p>}
          <h1 ref={heading} tabIndex={-1} className="p-scenario"><Cued text={task.scenario} /></h1>
          {task.questions.length > 0 && <ul className="p-questions">{task.questions.map((q) => <li key={q}><Cued text={q} /></li>)}</ul>}
          {!begun && <p className="p-device"><span className="pill"><DeviceIcon device={run.breakpoint} />You'll be viewing: {DEVICE[run.breakpoint]}</span></p>}
        </div>
        {!begun ? (
          <button type="button" className="btn btn-primary btn-lg" onClick={begin}>Begin <span className="enter-chip" aria-hidden="true">↵</span></button>
        ) : (
          <div className="p-actions">
            {task.kind !== "observe" && <button type="button" className="btn btn-secondary" disabled={!canEnd} onClick={() => end("gave-up")}>I can't find it</button>}
            <button type="button" className="btn btn-primary" disabled={!canEnd} onClick={() => end("found")}>{task.kind === "observe" ? "Done" : "I found it"}</button>
          </div>
        )}
      </div>
      {tourOn && !begun && <Tour steps={tourSteps.current} onClose={() => setTourOn(false)} onVisibleMs={addTourMs} returnFocus={() => document.querySelector<HTMLElement>(".p-task-card .btn-primary")} />}
      {!begun && <p className="p-hint">When you press Begin, the website will appear below, as it looks on a {DEVICE[run.breakpoint].toLowerCase()} screen.</p>}
      {begun && (
        <div className="p-stage">
          <Frame breakpoint={run.breakpoint} resetKey={0} onMessage={onMessage} onScale={onScale} start={task.start} />
        </div>
      )}
    </main>
  );
}

const EASE_LABELS = ["Very difficult", "Difficult", "A little difficult", "Neither", "A little easy", "Easy", "Very easy"];

function Rating({ session }: { session: Session }) {
  const { dispatch } = useApp();
  const task: Task | undefined = taskById(session.content, currentRun(session)?.taskId ?? "");
  const [ease, setEase] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const heading = useHeadingFocus("rating");
  const asksConfidence = (task?.confidence ?? "") !== "";
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ease !== null && (!asksConfidence || confidence !== null)) dispatch({ type: "rate", at: Date.now(), ease, notes, confidence });
  };
  return (
    <main className="p-screen p-center phase-enter">
      <form className="p-card p-rating" onSubmit={submit}>
        <fieldset>
          <legend><h1 ref={heading} tabIndex={-1}>{task?.kind === "nav" || task === undefined ? "Overall, how easy was it to know where to start?" : "Overall, how easy was it to complete that task?"}</h1></legend>
          <div className="p-scale">
            {EASE_LABELS.map((label, i) => (
              <label key={label} className="p-scale-item">
                <input type="radio" name="ease" value={i + 1} checked={ease === i + 1} onChange={() => setEase(i + 1)} />
                <span className="p-scale-box" aria-hidden="true">{i + 1}</span>
                <span className="sr-only">{i + 1}, {label}</span>
              </label>
            ))}
          </div>
          <div className="p-scale-ends" aria-hidden="true"><span>Very difficult</span><span>Very easy</span></div>
        </fieldset>
        {asksConfidence && (
          <fieldset>
            <legend><h2 className="p-subq">{task!.confidence}</h2></legend>
            <div className="p-scale">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <label key={n} className="p-scale-item">
                  <input type="radio" name="confidence" value={n} checked={confidence === n} onChange={() => setConfidence(n)} />
                  <span className="p-scale-box" aria-hidden="true">{n}</span>
                  <span className="sr-only">{n} of 7</span>
                </label>
              ))}
            </div>
            <div className="p-scale-ends" aria-hidden="true"><span>Not at all sure</span><span>Completely sure</span></div>
          </fieldset>
        )}
        <label className="p-field" htmlFor="ease-notes">{task?.notesPrompt ? `${task.notesPrompt} (optional)` : "What did you expect to find there? Was anything confusing or surprising? (optional)"}</label>
        <textarea id="ease-notes" rows={4} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-lg" disabled={ease === null || (asksConfidence && confidence === null)}>Done</button>
      </form>
    </main>
  );
}

/** "Are you sure?" before a participant ends the session themselves. Stopping is as easy as carrying on: nothing already done is lost. */
function EndConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="p-dialog" onClose={onCancel} aria-labelledby="end-title">
      <h2 id="end-title">End the session?</h2>
      <p>{SELF_RUN ? "Everything you have done so far is kept. You will be taken to the page where you can send your results." : "Everything you have done so far is kept. You will be asked to hand the device back to the researcher."}</p>
      <div className="p-dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={() => { ref.current?.close(); onCancel(); }}>Keep going</button>
        <button type="button" className="btn btn-danger" onClick={onConfirm}>Yes, end the session</button>
      </div>
    </dialog>
  );
}

/**
 * After the last main scenario, and after each extra one, the participant decides whether to do another. Nothing is
 * assumed: declining is as easy as accepting, and the moderator is not involved.
 */
function Offer({ session }: { session: Session }) {
  const { dispatch } = useApp();
  const heading = useHeadingFocus(`offer:${session.order.length}`);
  useEnterPrimary(".p-offer .btn-primary");
  const first = !session.runs.some((r) => taskById(session.content, r.taskId)?.reserve);
  const left = reserveTasksLeft(session).length;
  return (
    <main className="p-screen p-center phase-enter">
      <div className="p-card p-intro p-offer">
        <p className="p-eyebrow">{first ? "That was the last of the main scenarios" : "Thank you"}</p>
        <h1 ref={heading} tabIndex={-1}>{first ? "Would you like to try another?" : "Would you like to try one more?"}</h1>
        <p>{first ? `There ${left === 1 ? "is one more short scenario" : `are ${left} more short scenarios`}, if you have the time. It is completely your choice, and stopping now is fine.` : "It is completely your choice, and stopping now is fine."}</p>
        <div className="p-offer-actions">
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => dispatch({ type: "declineReserves", at: Date.now() })}>No thanks, I'm finished</button>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => dispatch({ type: "acceptReserve", at: Date.now() })}>Yes, show me another <span className="enter-chip" aria-hidden="true">↵</span></button>
        </div>
      </div>
    </main>
  );
}

function HandBack({ session }: { session: Session }) {
  const { dispatch } = useApp();
  const heading = useHeadingFocus("handback");
  return (
    <main className="p-screen p-center phase-enter">
      <div className="p-card p-intro">
        <div className="handoff-graphic" aria-hidden="true">
          <div className="handoff-party dim"><div className="handoff-icon"><PersonIcon /></div><span className="handoff-label">Participant</span></div>
          <span className="handoff-arrow"><ArrowIcon /></span>
          <div className="handoff-party"><div className="handoff-icon"><PersonIcon /></div><span className="handoff-label">Researcher</span></div>
        </div>
        <h1 ref={heading} tabIndex={-1}>{session.status === "ended-early" ? "Thank you for your time" : "Thank you, that was the last one"}</h1>
        <p>Please hand the device back to the researcher.</p>
        <button type="button" className="btn btn-quiet" onClick={() => dispatch({ type: "unlock", at: Date.now() })}>Researcher: continue</button>
      </div>
    </main>
  );
}

/** Ctrl+Shift+M. The only moderator control reachable from a participant screen: end the session early. */
function ModeratorMenu({ onClose }: { onClose: () => void }) {
  const { dispatch } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const end = (e: FormEvent) => {
    e.preventDefault();
    onClose();
    dispatch({ type: "endEarly", at: Date.now() });
  };
  return (
    <dialog ref={ref} className="p-dialog" onClose={onClose} aria-labelledby="mm-title">
      <form onSubmit={end}>
        <h2 id="mm-title">Moderator options</h2>
        <div className="p-dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()}>Cancel</button>
          <button type="submit" className="btn btn-danger">End session early</button>
        </div>
      </form>
    </dialog>
  );
}
