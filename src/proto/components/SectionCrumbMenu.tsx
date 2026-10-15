import { useEffect } from "react";
import { Link } from "@doterra-it/design-system-ui-base";
import { useIsDesktop } from "../search/useIsDesktop";

/*
 * EXPERIMENT (9 Oct 2026): a breadcrumb crumb for a menu-only primary item (Learn, Our Story, Rewards) looks like a
 * link and opens that item's navigation instead of going to a page. Below lg it opens the mobile menu on that
 * section; from lg it opens the real header menu for that item (Learn's mega menu, Rewards' dropdown).
 *
 * To turn it off, set the flag below to false: the crumbs go back to plain text and nothing else changes.
 * To remove it, delete this file and the lines marked "EXPERIMENT: section crumb" in PageBreadcrumbs.tsx,
 * StubPage.tsx, SiteHeader.tsx and MobileNav.tsx.
 */
export const SECTION_CRUMB_OPENS_NAV = true;

const OPEN_EVENT = "open-nav-section";

/** Ask the site header to open the mobile menu on a primary item. */
const openNavSection = (id: string) => window.dispatchEvent(new CustomEvent<string>(OPEN_EVENT, { detail: id }));

/** Header side of the experiment: runs `onOpen` when a section crumb asks for the mobile menu. */
export function useOpenNavSectionRequest(onOpen: (id: string) => void) {
  useEffect(() => {
    if (!SECTION_CRUMB_OPENS_NAV) return undefined;
    const handler = (e: Event) => onOpen((e as CustomEvent<string>).detail);
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, [onOpen]);
}

/**
 * Open the header menu of a primary item. Pure's Nav submenu and Popover open only on hover (mouseenter on the item),
 * and there is no API to open them, so the same event is sent to the item. Pure never closes a submenu on an outside
 * click, and no mouse is over the item to leave it, so the next press elsewhere or Escape sends mouseleave.
 * Relies on Pure internals (Nav.js sub menu listeners, Popover hover); the first thing to check after a Pure upgrade.
 */
const openHeaderMenu = (id: string) => {
  const link = document.getElementById(`nav-menu-${id}`);
  const own = link?.closest<HTMLElement>("li");
  if (!link || !own) return;
  // A mega menu listens on the nav item; a dropdown (Rewards) is a Popover whose hover trigger is the span around the link
  const item = own.querySelector("section") ? own : link.closest<HTMLElement>("span") ?? own;
  item.dispatchEvent(new MouseEvent("mouseenter"));
  const close = (e: Event) => {
    if (e instanceof KeyboardEvent && e.key !== "Escape") return;
    if (e instanceof PointerEvent && own.contains(e.target as Node)) return;
    item.dispatchEvent(new MouseEvent("mouseleave"));
    document.removeEventListener("pointerdown", close, true);
    document.removeEventListener("keydown", close, true);
  };
  // Attached after the current click has finished, so it does not close the menu it just opened
  window.setTimeout(() => {
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", close, true);
  }, 0);
};

/** The crumb: link styling, though it opens a menu rather than a page. */
function CrumbButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <Link as="button" type="button" underline="always" onClick={onClick} aria-haspopup="true">
      {label}
    </Link>
  );
}

export function SectionCrumb({ id, label }: { id: string; label: string }) {
  const isDesktop = useIsDesktop();
  return <CrumbButton label={label} onClick={() => (isDesktop ? openHeaderMenu(id) : openNavSection(id))} />;
}
