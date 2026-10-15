import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useApp } from "../state.tsx";
import type { SaveProblem } from "../state.tsx";
import { AppHeader } from "../AppHeader.tsx";
import { Shortcuts } from "../Shortcuts.tsx";

export type Tab = "sessions" | "ledger" | "content" | "preview";

const PROBLEMS: Record<Exclude<SaveProblem, null>, string> = {
  unavailable: "This browser is not saving anything (a private window, or site data is blocked). Sessions will be lost when you reload. Download a backup after every session, or open the file in a normal window.",
  quota: "Browser storage is full, so the latest changes were NOT saved. Download a backup now, then clear space or start a new browser profile.",
  verify: "The browser accepted the last save but did not keep it. Download a backup now.",
};

/** Header, tabs and honest status for every moderator screen. Participants never see this. */
export function ModeratorShell({ tab, onTab, children, inSession, wide, theme, onToggleTheme }: {
  tab: Tab; onTab: (t: Tab) => void; children: ReactNode; inSession: boolean; wide: boolean; theme: "light" | "dark"; onToggleTheme: () => void;
}) {
  const { lastSavedAt, saveProblem, notice, clearNotice, skippedOnLoad, contentFellBack } = useApp();
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "?" && !(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && !document.querySelector("dialog[open]")) { e.preventDefault(); setHelp(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const nav = inSession ? null : (
    <nav className="views" aria-label="Sections">
      {(["sessions", "ledger", "content", "preview"] as Tab[]).map((t) => (
        <button key={t} type="button" className="m-tab" aria-current={tab === t ? "page" : undefined} onClick={() => onTab(t)}>{t === "sessions" ? "Sessions" : t === "ledger" ? "Ledger" : t === "content" ? "Content" : "Preview"}</button>
      ))}
    </nav>
  );
  return (
    <div className="m-root" data-wide={wide}>
      <AppHeader moderator nav={nav} theme={theme} onToggleTheme={onToggleTheme} onShortcuts={() => setHelp(true)}
        status={<span className="m-save" role="status">{saveProblem ? "Not saved" : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : "Nothing to save yet"}</span>} />
      {saveProblem && <p className="m-banner m-banner-bad" role="alert">{PROBLEMS[saveProblem]}</p>}
      {skippedOnLoad > 0 && <p className="m-banner m-banner-warn" role="status">{skippedOnLoad} saved session{skippedOnLoad === 1 ? " was" : "s were"} unreadable and skipped. Import a backup to recover.</p>}
      {contentFellBack && <p className="m-banner m-banner-warn" role="status">The saved task content could not be read, so the plan's original tasks are in use. Check the Content tab before running a session.</p>}
      {notice && <p className="m-banner m-banner-warn" role="alert">{notice} <button type="button" className="btn btn-quiet" onClick={clearNotice}>Dismiss</button></p>}
      {children}
      {help && <Shortcuts onClose={() => setHelp(false)} />}
    </div>
  );
}
