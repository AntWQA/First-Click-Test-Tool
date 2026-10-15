import { PROTO_SOURCE, SHELL_SOURCE } from "../../shared/protocol.ts";
import type { ClickKind, MenuSurface, ProtoMessage } from "../../shared/protocol.ts";
import { SECTION_IDS, lookupFooter, lookupHeader } from "../../shared/navIndex.ts";

/**
 * The click recorder. It lives in the duplicate of the prototype only; the original is untouched. It reports what a
 * participant does to the page that embeds the frame (the test shell) and records nothing itself. Section and column
 * come from the same data files the prototype renders, looked up by href, so no DOM structure is trusted.
 */

const nonce = () => window.__WC_NONCE__ ?? new URLSearchParams(window.location.search).get("nonce") ?? "";

let t0 = performance.now();
export const startClock = () => { t0 = performance.now(); };
const now = () => Math.round((performance.now() - t0) * 10) / 10;

/** The frame's origin is opaque (sandbox without same-origin), so no narrower target origin exists. The shell checks the source window and the nonce. */
function post(msg: ProtoMessage) {
  if (window.parent === window) return;
  window.parent.postMessage({ source: PROTO_SOURCE, nonce: nonce(), msg }, "*");
}

export const emitReady = () => post({ type: "ready", at: now(), w: window.innerWidth, h: window.innerHeight });
export const emitRoute = (path: string) => post({ type: "route", at: now(), path });
export const emitSearch = (query: string) => post({ type: "search-submit", at: now(), query });
const emitOpen = (section: string, surface: MenuSurface, via: "hover" | "click") => post({ type: "menu-open", at: now(), section, surface, via });
const emitClose = (section: string) => post({ type: "menu-close", at: now(), section });

// ---------- classification ----------

export interface Classified {
  kind: ClickKind;
  href?: string;
  section?: string;
  column?: string;
  label?: string;
  testid?: string;
  ends: boolean;
}

const TOP = new RegExp(`^nav-(${SECTION_IDS.join("|")})$`);
const MOBILE_ROW = new RegExp(`^mobile-(${SECTION_IDS.join("|")})$`);
const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

/** The footer lists some routes in more than one menu, so the heading above the link settles which one was used. */
function footerColumn(a: Element, href: string): string | undefined {
  const entries = lookupFooter(href);
  if (entries.length <= 1) return entries[0]?.column;
  const heading = clean(a.parentElement?.firstElementChild?.textContent).toUpperCase();
  return (entries.find((e) => e.column.toUpperCase() === heading) ?? (a.closest("ul") ? entries.find((e) => e.column === "Legal") : undefined) ?? entries[0])?.column;
}

export function classify(target: Element): Classified {
  const anchor = target.closest("a[href]");
  const testid = target.closest("[data-testid]")?.getAttribute("data-testid") ?? undefined;
  const href = anchor?.getAttribute("href") ?? undefined;
  const label = clean((anchor ?? target).textContent);
  const base = { href, label, testid };

  if (anchor && target.closest("footer")) {
    return { ...base, kind: "footer", section: "footer", column: footerColumn(anchor, href ?? ""), ends: true };
  }
  if (anchor && (testid?.startsWith("nav-link-") || testid?.startsWith("mobile-link-") || testid === "content-card-action-link")) {
    const entry = href ? lookupHeader(href) : undefined;
    const featured = testid === "content-card-action-link" || entry?.column === "Featured";
    return { ...base, kind: featured ? "featured" : "nav-leaf", section: entry?.section, column: entry?.column, ends: true };
  }
  if (testid === "header-logo") return { ...base, kind: "logo", ends: false };
  if (testid === "toolbar-account" || testid === "toolbar-bag") return { ...base, kind: "utility", ends: false };
  if (testid === "mobile-menu-toggle" || testid === "drawer-close") return { ...base, kind: "menu-toggle", ends: false };
  if (testid === "mobile-back") return { ...base, kind: "back", ends: false };
  const top = testid ? (TOP.exec(testid) ?? MOBILE_ROW.exec(testid)) : null;
  if (top) return { ...base, kind: "nav-top", section: top[1], ends: false };
  if (testid === "toolbar-search" || testid === "header-search-input" || testid === "overlay-search-input" || testid === "overlay-cancel" || target.closest('[data-testid="search-panel"], [data-testid="search-overlay"]')) {
    return { ...base, kind: "search", ends: false };
  }
  return { ...base, kind: "other", ends: false };
}

// ---------- menus ----------

/**
 * Desktop menus open on hover. Pure marks an open mega menu with a class and aria-hidden on its <section>, and renders
 * the Rewards popover as a dialog in a portal, so a mutation observer reads both without touching the app. Pure applies
 * its own 150 ms hover intent before opening, so what is recorded is what the participant actually saw open.
 */
export function startMenuObserver(): () => void {
  const mega = new Map<string, boolean>();
  let rewardsOpen = false;
  let queued = 0;
  const scan = () => {
    queued = 0;
    document.querySelectorAll<HTMLElement>('section[aria-labelledby^="nav-menu-"]').forEach((el) => {
      const id = (el.getAttribute("aria-labelledby") ?? "").replace("nav-menu-", "");
      const open = el.classList.contains("dtds-nav__sub-menu--is-open") && el.getAttribute("aria-hidden") !== "true";
      const was = mega.get(id) ?? false;
      if (open && !was) { mega.set(id, true); emitOpen(id, "mega", "hover"); }
      else if (!open && was) { mega.set(id, false); emitClose(id); }
    });
    const dialog = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find((d) => d.querySelector('a[data-testid^="nav-link-rewards-"]'));
    const open = !!dialog && dialog.getAttribute("aria-hidden") !== "true";
    if (open && !rewardsOpen) { rewardsOpen = true; emitOpen("rewards", "dropdown", "hover"); }
    else if (!open && rewardsOpen) { rewardsOpen = false; emitClose("rewards"); }
  };
  const observer = new MutationObserver(() => { if (!queued) queued = requestAnimationFrame(scan); });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "aria-hidden"] });
  scan();
  return () => { observer.disconnect(); if (queued) cancelAnimationFrame(queued); };
}

/** Below 1024px the menu is a drawer with a section view: a section row opened by click or tap is the section choice. */
let drillSection: string | null = null;
export const resetDrill = () => { drillSection = null; };

// ---------- clicks, interception and reset ----------

type Navigate = (to: string) => void;
let navigator: Navigate | null = null;
export const setNavigator = (fn: Navigate | null) => { navigator = fn; };

const resetListeners = new Set<() => void>();
export function onShellReset(cb: () => void): () => void {
  resetListeners.add(cb);
  return () => { resetListeners.delete(cb); };
}

let installed = false;
export function installRecorder() {
  if (installed) return;
  installed = true;

  // Pure expands the desktop search field on focus and moves the input between press and release, so the browser never
  // fires a click for it. A press on any search control is therefore recorded on its own, and a click that does follow
  // within half a second is not counted twice.
  let searchPressAt = -1000;
  window.addEventListener("pointerdown", (e) => {
    if (!(e.target instanceof Element) || e.button !== 0) return;
    const c = classify(e.target);
    if (c.kind !== "search") return;
    searchPressAt = now();
    post({ type: "click", at: searchPressAt, kind: "search", href: c.href, label: c.label, testid: c.testid, x: Math.round(e.clientX), y: Math.round(e.clientY), ends: false });
  }, true);

  // Captured on window, before the app's own handlers, so nothing in the page can stop propagation and hide a click.
  window.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const c = classify(target);
    if (c.kind === "search" && now() - searchPressAt < 500) return;
    post({ type: "click", at: now(), kind: c.kind, href: c.href, section: c.section, column: c.column, label: c.label, testid: c.testid, x: Math.round(e.clientX), y: Math.round(e.clientY), ends: c.ends });
    if (c.kind === "nav-top" && c.testid && MOBILE_ROW.test(c.testid) && c.section) {
      drillSection = c.section;
      emitOpen(c.section, "drill", "click");
    } else if (c.kind === "back" && drillSection) {
      emitClose(drillSection);
      drillSection = null;
    }
  }, true);

  // After the app has had its turn: any link nobody handled (the footer, the featured tile) would load a real page inside
  // the frame. Router links call preventDefault themselves, so an unhandled anchor is routed here instead.
  document.addEventListener("click", (e) => {
    const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!a || e.defaultPrevented) return;
    e.preventDefault();
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("/") && !href.startsWith("//")) navigator?.(href);
  });

  // Key events inside the frame never reach the shell, so the moderator chord is forwarded as a message.
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "m") { e.preventDefault(); post({ type: "moderator-key", at: now() }); }
  }, true);

  window.open = () => null;

  window.addEventListener("message", (e) => {
    const d = e.data as { source?: string; nonce?: string; type?: string } | null;
    if (e.source !== window.parent || !d || d.source !== SHELL_SOURCE || d.nonce !== nonce() || d.type !== "reset") return;
    resetListeners.forEach((cb) => cb());
  });
}
