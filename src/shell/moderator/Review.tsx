import { useApp } from "../state.tsx";
import { effective } from "../domain/session.ts";
import type { RunModerator, Session } from "../domain/session.ts";
import type { Tier, WrongClickCode } from "../domain/scoring.ts";
import { taskById } from "../domain/content.ts";
import { lookupHeader } from "../../shared/navIndex.ts";
import { BREAKPOINTS } from "../../shared/protocol.ts";
import { CODE_LABELS, TIER_LABELS, describeEvent, sectionLabel, seconds } from "../format.ts";
import { useEnterPrimary } from "../Shortcuts.tsx";

const TIERS: Tier[] = ["P", "A", "X", "R", "S"];
const label = (href: string) => { const e = lookupHeader(href); return e ? `${e.label} (${sectionLabel(e.section)} > ${e.column})` : href; };

/**
 * Findings for one completed run, added after the session (or at any later time). Nothing here is shown to the participant
 * and the session never waits for it. The captured facts and the suggestion are read-only; everything below them is yours.
 */
export function Review({ session, runId, onBack, backLabel }: { session: Session; runId: string; onBack: () => void; backLabel: string }) {
  const { reviewRun } = useApp();
  useEnterPrimary(".m-sticky .btn-primary");
  const run = session.runs.find((r) => r.runId === runId);
  const task = run ? taskById(session.content, run.taskId) : undefined;
  if (!run || !task || !run.suggestion) {
    return (
      <main className="m-page"><h1>That run is no longer available</h1><p><button type="button" className="btn btn-primary" onClick={onBack}>{backLabel}</button></p></main>
    );
  }
  const sug = run.suggestion;
  const eff = effective(run);
  const m = run.moderator;
  const set = (p: Partial<RunModerator>) => reviewRun(session.id, run.runId, p);
  const readyAt = run.events.find((e) => e.type === "ready")?.at ?? 0;
  const changed = m.tier !== undefined && m.tier !== sug.tier || m.code !== undefined && m.code !== sug.code || m.level1 !== undefined && m.level1 !== sug.level1;
  const lvl = (v: boolean | null) => (v === null ? "not applicable" : v ? "hit" : "miss");

  return (
    <main className="m-page m-review">
      <header className="m-review-head">
        <div>
          <p className="m-kicker">{session.participantId} · {BREAKPOINTS[run.breakpoint].label} · task {run.position + 1} of {session.order.length}{session.practice ? " · practice" : ""}{run.attempt > 1 ? ` · attempt ${run.attempt}` : ""}</p>
          <h1>{task.id} {task.title}{task.highRisk ? " (high risk)" : ""}</h1>
        </div>
        <div className="m-ease" role="group" aria-label="Participant ease rating"><span>Ease</span><strong>{run.ease}</strong><span>of 7</span></div>
      </header>
      <div className="m-cols">
        <section aria-labelledby="cap-h" className="m-col">
          <h2 id="cap-h">Captured automatically</h2>
          <dl className="m-facts">
            <dt>Scenario</dt><dd>{task.scenario}</dd>
            <dt>Breakpoint</dt><dd>{BREAKPOINTS[run.breakpoint].label}. Earlier tasks this session at another breakpoint: {session.runs.filter((r) => r.status === "completed" && r.position < run.position && r.breakpoint !== run.breakpoint).length} of {run.position}. The earlier someone meets the navigation, the less of it they have already seen.</dd>
            <dt>Ended by</dt><dd>{run.end === "destination" ? "Chose a destination" : run.end === "found" ? "Pressed I found it" : "Pressed I can't find it"}</dd>
            <dt>Time</dt><dd>reading {seconds(run.readingMs)} · to first interaction {seconds(sug.firstInteractionMs)} · total {seconds(run.durationMs)}{run.scale !== 1 ? ` · shown at ${Math.round(run.scale * 100)}% size` : ""}{run.windowResized ? " · window resized during the task" : ""}</dd>
            <dt>Sections opened</dt><dd>{sug.sectionsOpened.length ? sug.sectionsOpened.map(sectionLabel).join(", then ") : "none"}</dd>
            <dt>Section choice</dt><dd>{sectionLabel(sug.levelOneSection)} ({lvl(sug.level1)}){sug.firstOpenSection && sug.firstOpenSection !== sug.levelOneSection ? `; first menu to open was ${sectionLabel(sug.firstOpenSection)}, left within 0.3 s` : ""}</dd>
            <dt>Final choice</dt><dd>{sug.finalHref ? `${label(sug.finalHref)}${sug.viaFooter ? " via the footer" : ""}` : sug.finalKind === "search-submit" ? "Searched" : "none"} ({lvl(sug.level2)})</dd>
          </dl>
          <h3>Targets for this task</h3>
          <ul className="m-targets">
            {task.primary.map((t) => <li key={t.href} className="is-p"><strong>Primary</strong> {label(t.href)}</li>)}
            {task.acceptable.map((t) => <li key={t.href} className="is-a"><strong>Acceptable</strong> {label(t.href)}{t.note ? ` (${t.note})` : ""}</li>)}
            {task.separate.map((t) => <li key={t.href} className="is-s"><strong>Recorded separately</strong> {label(t.href)}{t.note ? ` (${t.note})` : ""}</li>)}
          </ul>
          <p className="m-hint"><strong>Watch for:</strong> {task.watchFor}</p>
          <details>
            <summary>What we need back from this task</summary>
            <ul>{task.needBack.map((n) => <li key={n}>{n}</li>)}</ul>
          </details>
          <h3>What they did</h3>
          <ol className="m-timeline">{run.events.filter((e) => e.type !== "route").map((e, i) => <li key={i}>{describeEvent(e, readyAt)}</li>)}</ol>
          <h3>In their words</h3>
          <p className="m-quote">{run.participantNotes || <em>No notes.</em>}</p>
        </section>

        <section aria-labelledby="rev-h" className="m-col m-col-edit">
          <h2 id="rev-h">Your review</h2>
          <p className="m-hint">Add what you saw and heard in the session. The suggestion stands until you change it, and the Ledger counts your choice once you do.{m.reviewed ? "" : " Nothing has been added for this run yet."}</p>
          <fieldset>
            <legend>Tier <span className="m-badge">suggested {sug.tier}: {TIER_LABELS[sug.tier]}</span></legend>
            <div className="m-radios">{TIERS.map((t) => (
              <label key={t}><input type="radio" name="tier" checked={eff.tier === t} onChange={() => set({ tier: t })} /> <strong>{t}</strong> {TIER_LABELS[t]}</label>
            ))}</div>
          </fieldset>
          <div className="m-row">
            <label className="m-field">Wrong-click code <span className="m-badge">suggested {sug.code ?? "none"}</span>
              <select value={eff.code === null ? "" : String(eff.code)} onChange={(e) => set({ code: e.target.value === "" ? null : (Number(e.target.value) as WrongClickCode) })}>
                <option value="">None</option>
                {Object.entries(CODE_LABELS).map(([k, v]) => <option key={k} value={k}>{k} {v}</option>)}
              </select>
            </label>
            <label className="m-field">Section choice <span className="m-badge">suggested {lvl(sug.level1)}</span>
              <select value={eff.level1 === null ? "na" : eff.level1 ? "hit" : "miss"} onChange={(e) => set({ level1: e.target.value === "na" ? null : e.target.value === "hit" })}>
                <option value="hit">Hit</option><option value="miss">Miss</option><option value="na">Not applicable</option>
              </select>
            </label>
          </div>
          <fieldset>
            <legend>Did the menu open without help?</legend>
            <div className="m-radios">
              <label><input type="radio" name="menu" checked={m.menu === "U"} onChange={() => set({ menu: "U" })} /> Yes, unaided</label>
              <label><input type="radio" name="menu" checked={m.menu === "P"} onChange={() => set({ menu: "P" })} /> After a prompt (code 7)</label>
            </div>
          </fieldset>
          {changed && <label className="m-field">Reason for the change<textarea rows={2} value={m.overrideReason} onChange={(e) => set({ overrideReason: e.target.value })} /></label>}
          <label className="m-field">Expected to find (verbatim)<textarea rows={2} value={m.expected} onChange={(e) => set({ expected: e.target.value })} /></label>
          {eff.tier === "X" && <label className="m-field">Where else would they have looked?<textarea rows={2} value={m.secondChance} onChange={(e) => set({ secondChance: e.target.value })} /></label>}
          <label className="m-field">Observed<small>What happened: hesitation, hover path, reading labels aloud, prompts given.</small><textarea rows={3} value={m.observed} onChange={(e) => set({ observed: e.target.value })} /></label>
          <label className="m-field">Interpretation<small>What it might mean. Keep it apart from what you observed.</small><textarea rows={3} value={m.interpretation} onChange={(e) => set({ interpretation: e.target.value })} /></label>
        </section>
      </div>
      <div className="m-actions m-sticky">
        <button type="button" className="btn btn-primary btn-lg" onClick={onBack}>{backLabel} <span className="enter-chip" aria-hidden="true">↵</span></button>
      </div>
    </main>
  );
}
