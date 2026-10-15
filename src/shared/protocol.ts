/**
 * Shared vocabulary between the duplicated prototype (which records what the participant does) and the shell
 * (which scores it). Erasable TypeScript only, so Node can run the domain tests without a build step.
 */

export type Breakpoint = "desktop" | "tablet" | "mobile";

export interface BreakpointSpec {
  width: number;
  /** Fixed viewport height, taken from the Figma frames, so every session sees the same space. */
  height: number;
  label: string;
  /** Clicks in the tablet and mobile frames are reported as taps: layout interpretation is tested, not touch ability. */
  input: "click" | "tap";
}

export const BREAKPOINTS: Record<Breakpoint, BreakpointSpec> = {
  desktop: { width: 1440, height: 1024, label: "Desktop 1440", input: "click" },
  tablet: { width: 768, height: 1024, label: "Tablet 768", input: "tap" },
  mobile: { width: 402, height: 874, label: "Mobile 402", input: "tap" },
};

export const BREAKPOINT_IDS: Breakpoint[] = ["desktop", "tablet", "mobile"];

export type ClickKind =
  | "nav-leaf"
  | "nav-top"
  | "menu-toggle"
  | "back"
  | "footer"
  | "featured"
  | "logo"
  | "search"
  | "utility"
  | "other";

/** mega = desktop hover mega menu, dropdown = desktop Rewards popover, drill = mobile and tablet section view. */
export type MenuSurface = "mega" | "dropdown" | "drill";
export type MenuVia = "hover" | "click";

/** `at` is milliseconds since the recorder started in the frame (one clock inside the frame, deltas are computed in the shell). */
interface Stamped { at: number }

export interface ReadyMsg extends Stamped { type: "ready"; w: number; h: number }
export interface MenuOpenMsg extends Stamped { type: "menu-open"; section: string; surface: MenuSurface; via: MenuVia }
export interface MenuCloseMsg extends Stamped { type: "menu-close"; section: string }
export interface ClickMsg extends Stamped {
  type: "click";
  kind: ClickKind;
  href?: string;
  section?: string;
  column?: string;
  label?: string;
  testid?: string;
  x: number;
  y: number;
  /** True when this click takes the participant to a destination page (leaf, footer or featured link). The shell ends the task. */
  ends: boolean;
}
export interface RouteMsg extends Stamped { type: "route"; path: string }
export interface SearchSubmitMsg extends Stamped { type: "search-submit"; query: string }
/** The moderator chord (Ctrl+Shift+M) pressed while focus is inside the frame, where the shell cannot see key events. Never stored in a run. */
export interface ModeratorKeyMsg extends Stamped { type: "moderator-key" }

export type ProtoMessage = ReadyMsg | MenuOpenMsg | MenuCloseMsg | ClickMsg | RouteMsg | SearchSubmitMsg | ModeratorKeyMsg;
export type CapturedEvent = ProtoMessage;

export const PROTO_SOURCE = "wc-proto" as const;
export const SHELL_SOURCE = "wc-shell" as const;

export interface ProtoEnvelope { source: typeof PROTO_SOURCE; nonce: string; msg: ProtoMessage }
export interface ShellEnvelope { source: typeof SHELL_SOURCE; nonce: string; type: "reset" }

const CLICK_KINDS = new Set<string>(["nav-leaf", "nav-top", "menu-toggle", "back", "footer", "featured", "logo", "search", "utility", "other"]);
const SURFACES = new Set<string>(["mega", "dropdown", "drill"]);
const VIAS = new Set<string>(["hover", "click"]);
const MAX_TEXT = 200;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v.slice(0, MAX_TEXT) : null);
const optStr = (v: unknown): string | undefined => (typeof v === "string" ? v.slice(0, MAX_TEXT) : undefined);

/**
 * Rebuilds a clean message from known fields only (or null). Used for live messages and for events read back from an
 * import, so nothing unexpected is carried into a session record.
 */
export function parseProtoMessage(m: unknown): ProtoMessage | null {
  if (!isRecord(m)) return null;
  const at = num(m.at);
  if (at === null || at < 0) return null;
  switch (m.type) {
    case "ready": {
      const w = num(m.w), h = num(m.h);
      return w === null || h === null ? null : { type: "ready", at, w, h };
    }
    case "menu-open": {
      const section = str(m.section);
      if (section === null || typeof m.surface !== "string" || !SURFACES.has(m.surface) || typeof m.via !== "string" || !VIAS.has(m.via)) return null;
      return { type: "menu-open", at, section, surface: m.surface as MenuSurface, via: m.via as MenuVia };
    }
    case "menu-close": {
      const section = str(m.section);
      return section === null ? null : { type: "menu-close", at, section };
    }
    case "click": {
      const x = num(m.x), y = num(m.y);
      if (typeof m.kind !== "string" || !CLICK_KINDS.has(m.kind) || x === null || y === null || typeof m.ends !== "boolean") return null;
      return { type: "click", at, kind: m.kind as ClickKind, href: optStr(m.href), section: optStr(m.section), column: optStr(m.column), label: optStr(m.label), testid: optStr(m.testid), x, y, ends: m.ends };
    }
    case "route": {
      const path = str(m.path);
      return path === null ? null : { type: "route", at, path };
    }
    case "search-submit": {
      const query = str(m.query);
      return query === null ? null : { type: "search-submit", at, query };
    }
    case "moderator-key":
      return { type: "moderator-key", at };
    default:
      return null;
  }
}

/**
 * Validates a live message from the frame. The frame is sandboxed without same-origin access, so its origin is opaque
 * and cannot be checked: callers verify `event.source` and this per-load nonce instead.
 */
export function parseProtoEnvelope(data: unknown, nonce: string): ProtoMessage | null {
  if (!isRecord(data) || data.source !== PROTO_SOURCE || data.nonce !== nonce) return null;
  return parseProtoMessage(data.msg);
}
