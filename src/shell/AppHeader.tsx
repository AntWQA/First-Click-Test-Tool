import type { ReactNode } from "react";
import { KeyboardIcon, Logo } from "./brand.tsx";
import { ThemeToggle } from "./theme.tsx";

/**
 * The header the other Storefront research tools share: wordmark with the tool name beneath it, navigation as a pill
 * group, and icon buttons. The moderator header carries the navigation; the participant header is just the brand and the
 * theme button, so nothing about the method or the moderator's tools is on their screen.
 */
export function AppHeader({ moderator, nav, status, theme, onToggleTheme, onShortcuts }: {
  moderator: boolean; nav?: ReactNode; status?: ReactNode; theme: "light" | "dark"; onToggleTheme?: () => void; onShortcuts?: () => void;
}) {
  return (
    <header className={`top${moderator ? " m-header" : ""}`}>
      <div className="wrap top-inner">
        <div className="brand">
          <Logo />
          <p className="brand-name">Wayfinding Check</p>
        </div>
        <div className="top-actions">
          {status}
          {nav}
          {onShortcuts && <button type="button" className="icon-btn" aria-label="Keyboard shortcuts" onClick={onShortcuts}><KeyboardIcon /></button>}
          {onToggleTheme && <ThemeToggle theme={theme} onToggle={onToggleTheme} />}
        </div>
      </div>
    </header>
  );
}
