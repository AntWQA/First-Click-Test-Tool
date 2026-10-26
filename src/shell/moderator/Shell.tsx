import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useApp } from "../state.tsx";
import type { SaveProblem } from "../state.tsx";
import { AppHeader } from "../AppHeader.tsx";
import { Shortcuts } from "../Shortcuts.tsx";

export type Tab = "sessions" | "ledger" | "preview";

const TABS: Tab[] = ["sessions", "ledger", "preview"];

const PROBLEMS: Record<Exclude<SaveProblem, null>, string> = {
  unavailable: "This browser is not saving anything (a private window, or site data is blocked). Sessions will be lost when you reload. Download a backup after every session, or open the file in a normal window.",
  quota: "Browser storage is full, so the latest changes were NOT saved. Download a backup now, then clear space or start a new browser profile.",
  verify: "The browser accepted the last save but did not keep it. Download a backup now.",
};

/** Header, tabs and honest status for every moderator screen. Participants never see this. */
export function ModeratorShell({ tab, onTab, children, inSession, wide, theme, onToggleTheme }: {
  tab: Tab; onTab: (t: Tab) => void; children: ReactNode; inSession: boolean; wide: boolean; theme: "light" | "dark"; onToggleTheme: () => void;
}) {
  const { lastSavedAt, saveProblem, notice, clearNotice, skippedOnLoad } = useApp();
  const [help, setHelp] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "?") { e.preventDefault(); setHelp(true); return; }
      if (e.key.toLowerCase() === "t") { e.preventDefault(); onToggleTheme(); return; }
      // The tabs are hidden while a session or a findings screen is open, so the number keys only work when they are showing.
      const i = ["1", "2", "3"].indexOf(e.key);
      if (i >= 0 && !inSession) { e.preventDefault(); onTab(TABS[i]!); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inSession, onTab, onToggleTheme]);
  const nav = inSession ? null : (
    <nav className="views" aria-label="Sections">
      {TABS.map((t) => (
        <button key={t} type="button" className="m-tab" aria-current={tab === t ? "page" : undefined} onClick={() => onTab(t)}>{t === "sessions" ? "Sessions" : t === "ledger" ? "Ledger" : "Preview"}</button>
      ))}
    </nav>
  );
  return (
    <div className="m-root" data-wide={wide}>
      <AppHeader moderator nav={nav} theme={theme} onToggleTheme={onToggleTheme} onShortcuts={() => setHelp(true)}
        status={<span className="m-save" role="status">{saveProblem ? "Not saved" : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : "Nothing to save yet"}</span>} />
      {saveProblem && <p className="m-banner m-banner-bad" role="alert">{PROBLEMS[saveProblem]}</p>}
      {skippedOnLoad > 0 && <p className="m-banner m-banner-warn" role="status">{skippedOnLoad} saved session{skippedOnLoad === 1 ? " was" : "s were"} unreadable and skipped. Import a backup to recover.</p>}
      {notice && <p className="m-banner m-banner-warn" role="alert">{notice} <button type="button" className="btn btn-quiet" onClick={clearNotice}>Dismiss</button></p>}
      {children}
      {help && <Shortcuts onClose={() => setHelp(false)} />}
    </div>
  );
}
