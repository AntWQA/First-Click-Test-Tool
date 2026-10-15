import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Pure's result cards render plain anchors (href only, no router link prop). This wrapper turns clicks on same-site
 * anchors into client side navigation so the demo does not reload the page.
 */
export function SpaLinks({ children, onNavigate }: { children: ReactNode; onNavigate?: () => void }) {
  const navigate = useNavigate();
  return (
    <div
      onClick={(e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        const a = (e.target as HTMLElement).closest("a");
        const href = a?.getAttribute("href");
        if (a && href && href.startsWith("/") && !a.hasAttribute("target")) { e.preventDefault(); navigate(href); onNavigate?.(); }
      }}
    >
      {children}
    </div>
  );
}
