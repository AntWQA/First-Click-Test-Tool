import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AppProvider, makeId, useApp } from "../state.tsx";
import { Boundary } from "../Boundary.tsx";
import { AppHeader } from "../AppHeader.tsx";
import { DownloadIcon } from "../brand.tsx";
import { useFollowedTheme } from "../theme.tsx";
import { NOTICE, SEND_TO } from "../edition.ts";
import { Participant } from "./Participant.tsx";
import { StartAgain } from "./StartAgain.tsx";
import { reduce, countedRuns } from "../domain/session.ts";
import type { Group, Session } from "../domain/session.ts";
import { toJsonBundle } from "../domain/exports.ts";
import { download } from "../format.ts";
import { DEFAULT_CONTENT } from "../domain/tasks.ts";
import { useEnterPrimary } from "../Shortcuts.tsx";

/**
 * The participant edition. The participant sets themselves up, runs through the scenarios on their own, and ends on a page
 * that gives them their results as a file to send back. There is no moderator anywhere in it: no tabs, no header options,
 * no shortcuts panel, no hand-back screen. The moderator imports the file in the full tool.
 */
export function SelfRunApp() {
  return <Boundary><AppProvider><SelfRunRoot /></AppProvider></Boundary>;
}

function SelfRunRoot() {
  const { sessions, active, openSession } = useApp();
  const [theme, toggleTheme] = useFollowedTheme();
  const [booted, setBooted] = useState(false);
  // Carry on where this person left off if they closed the window part-way through (or came back to download again).
  useEffect(() => {
    const latest = sessions.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (latest && latest.phase !== "setup") openSession(latest.id);
    setBooted(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!booted) return null;
  if (!active) return <Frame theme={theme} onToggleTheme={toggleTheme}><SelfSetup /></Frame>;
  if (active.phase === "handBack" || active.phase === "debrief" || active.phase === "ended") return <Frame theme={theme} onToggleTheme={toggleTheme}><Finished session={active} /></Frame>;
  if (active.phase === "setup") return <Frame theme={theme} onToggleTheme={toggleTheme}><SelfSetup /></Frame>;
  return <Participant session={active} theme={theme} onToggleTheme={toggleTheme} />;
}

function Frame({ theme, onToggleTheme, children }: { theme: "light" | "dark"; onToggleTheme: () => void; children: React.ReactNode }) {
  return (
    <div className="p-root">
      <AppHeader moderator={false} theme={theme} onToggleTheme={onToggleTheme} />
      {children}
    </div>
  );
}

const ID_OK = /^[A-Za-z0-9_.-]{1,40}$/;

/** The one setup screen: what to expect, the participant's code, and Start. Starting goes straight to the first scenario. */
function SelfSetup() {
  const { start, dispatch, sessions } = useApp();
  const [id, setId] = useState("");
  const [group, setGroup] = useState<Group>("");
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(window.innerWidth < 1000);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 1000);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  useEnterPrimary(".p-setup button[type=submit]");
  const core = DEFAULT_CONTENT.tasks.filter((t) => !t.reserve);
  const scenarios = core.length;
  // Task allowances plus a few minutes for the welcome and the final page, rounded to the nearest 5.
  const minutes = Math.max(5, Math.round((core.reduce((n, t) => n + t.minutes, 0) + 6) / 5) * 5);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const pid = id.trim();
    if (!ID_OK.test(pid)) { setError("Enter the code you were given, using letters and numbers only (for example P7)."); return; }
    if (group === "") { setError("Please choose one of the answers about membership."); return; }
    if (!adult) { setError("This study is for adults. Please confirm that you are 18 or over."); return; }
    start({ participantId: pid, group, selfRun: true });
    dispatch({ type: "start", at: Date.now() });
    dispatch({ type: "present", at: Date.now(), runId: makeId("r") });
  };
  return (
    <main className="p-screen p-center phase-enter">
      <form className="p-card p-setup" onSubmit={submit} noValidate>
        <p className="p-eyebrow">Welcome</p>
        <h1>Thanks for taking part</h1>
        <p>You will see {scenarios} short scenarios, one at a time. For each, part of a website appears and you do what you would do first. Where a scenario asks you something, answer in your own words in the box that follows.</p>
        <p className="p-note"><strong>We are testing the website, not you.</strong> There are no right or wrong answers. If something is hard to find, that tells us how to improve the website.</p>
        <ul className="p-setup-facts">
          <li>It takes about {minutes} minutes.</li>
          <li>Use a laptop or desktop computer, with this window as large as you can.</li>
          <li>Nothing is sent anywhere. At the end you save a file and send it to us.</li>
        </ul>
        <section className="p-notice" aria-labelledby="notice-h">
          <h2 id="notice-h">How your results are used</h2>
          <p>This study is run by <strong>{NOTICE.controller || "[organization not set]"}</strong>, who decides how your results are used.</p>
          <p>We record your code, whether you are a member, where you click, how long each step takes, the size of your browser window, and anything you type in the search box or the notes. We do not ask for your name. Nothing leaves your computer until you email us your results file, so we will also see the email address you send it from.</p>
          <p>We use it to find out how easy the website is to understand and use, and we report results together, not about individuals.</p>
          <p>We keep your results for <strong>{NOTICE.retention || "[retention not set]"}</strong>. You can stop at any time. To see or delete your results, email <strong>{SEND_TO || "the researcher who gave you this tool"}</strong>.</p>
          <p>Please do not put your name, contact details or anything about your health in the search box or the notes.</p>
        </section>
        <label className="p-field p-setup-field" htmlFor="pid">Your code
          <input id="pid" value={id} onChange={(e) => { setId(e.target.value); setError(null); }} maxLength={40} autoComplete="off" aria-describedby="pid-hint pid-error" />
          <small id="pid-hint">The code the researcher gave you. Please do not use your name.</small>
        </label>
        <label className="p-field p-setup-field" htmlFor="grp">Are you a doTERRA member?
          <select id="grp" value={group} onChange={(e) => { setGroup(e.target.value as Group); setError(null); }} required>
            <option value="" disabled>Choose one</option>
            <option value="non-member">No, I am not a member</option>
            <option value="WC">Yes, a wholesale customer</option>
            <option value="WA">Yes, a Wellness Advocate</option>
          </select>
        </label>
        <label className="p-check" htmlFor="adult">
          <input id="adult" type="checkbox" checked={adult} onChange={(e) => { setAdult(e.target.checked); setError(null); }} />
          <span>I am 18 or over.</span>
        </label>
        <p id="pid-error" className="p-error" role="alert">{error}</p>
        {narrow && <p className="p-note" role="status">This window is quite small, so the websites will be shown scaled down. If you can, make it larger before you start.</p>}
        <button type="submit" className="btn btn-primary btn-lg">Start <span className="enter-chip" aria-hidden="true">↵</span></button>
        <p className="p-fine">By pressing Start you agree to your results being used in this way.</p>
        {sessions.length > 0 && <StartAgain />}
      </form>
    </main>
  );
}

/** The end: an optional note, then the results file to save and send. Reached after the last scenario, or after ending early. */
function Finished({ session }: { session: Session }) {
  const { dispatch, content, closeSession } = useApp();
  const [notes, setNotes] = useState(session.debriefNotes);
  const [saved, setSaved] = useState<string | null>(null);
  const [copy, setCopy] = useState<"idle" | "done" | "manual">("idle");
  const ended = session.phase === "ended";
  const early = session.status === "ended-early";
  const done = countedRuns(session).length;
  const heading = useHeadingFocus();
  // Closing the session (once) happens on the first save or copy, so the file always holds the final note.
  const finalised = (): Session => {
    if (ended) return session;
    const action = { type: "complete" as const, at: Date.now(), notes };
    dispatch(action);
    return reduce(session, action);
  };
  // Named so it is easy to spot in a downloads folder or an inbox: doterra_research_<code>_<date>.json, with the local date.
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const file = (s: Session) => `doterra_research_${s.participantId}_${today()}.json`;
  const text = (s: Session) => toJsonBundle([s], content, new Date().toISOString());
  const save = () => { const s = finalised(); const name = file(s); download(name, "application/json", text(s)); setSaved(name); };
  const copyIt = async () => {
    const s = finalised();
    try { await navigator.clipboard.writeText(text(s)); setCopy("done"); } catch { setCopy("manual"); }
  };
  useEnterPrimary(".p-finish .btn-primary");
  return (
    <main className="p-screen p-center phase-enter">
      <div className="p-card p-finish">
        <p className="p-eyebrow">{early ? "Stopped here" : "All done"}</p>
        <h1 ref={heading} tabIndex={-1}>{early ? "Thank you for your time" : "Thank you for finishing the scenarios"}</h1>
        <p>{early ? `You finished ${done} ${done === 1 ? "scenario" : "scenarios"} and stopped there, which is fine.` : `You finished ${done} ${done === 1 ? "scenario" : "scenarios"}.`} There is nothing more to do in the test.</p>
        <p className="p-note p-send-note"><strong>One last thing: please send us your results file.</strong> We only receive your answers when you do.</p>
        <label className="p-field p-setup-field" htmlFor="fin-notes">Anything you would like to add? (optional)
          <textarea id="fin-notes" rows={3} maxLength={2000} value={notes} readOnly={ended} onChange={(e) => setNotes(e.target.value)} />
          <small>For example anything that was confusing, or that you expected to find on the page.</small>
        </label>
        <ol className="p-finish-steps">
          <li>Save your results file with the button below.</li>
          <li>{SEND_TO ? <>Send it to <strong>{SEND_TO}</strong>.</> : "Send it to the researcher who gave you this tool."}</li>
        </ol>
        <div className="p-offer-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={save}><DownloadIcon />Save my results</button>
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => void copyIt()}>Copy instead</button>
        </div>
        <div role="status" className="p-finish-status">
          {saved && <p className="p-note p-send-note"><strong>Saved as {saved}.</strong> Please send that file now, and keep this window open until you have.</p>}
          {copy === "done" && <p className="p-note">Copied. Paste it into an email or message to us.</p>}
        </div>
        {copy === "manual" && (
          <label className="p-field p-setup-field" htmlFor="fin-copy">Select all of this text, copy it, and paste it into a message to us.
            <textarea id="fin-copy" rows={4} readOnly value={text(session)} onFocus={(e) => e.currentTarget.select()} />
          </label>
        )}
        <button type="button" className="p-textlink" onClick={closeSession}>Start a new session</button>
        <StartAgain saved />
      </div>
    </main>
  );
}

function useHeadingFocus() {
  const [el, setEl] = useState<HTMLHeadingElement | null>(null);
  useEffect(() => { el?.focus(); }, [el]);
  return setEl;
}
