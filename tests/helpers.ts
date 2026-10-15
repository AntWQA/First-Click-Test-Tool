import type { CapturedEvent, ClickMsg } from "../src/shared/protocol.ts";
import { DEFAULT_CONTENT } from "../src/shell/domain/tasks.ts";
import type { Task } from "../src/shell/domain/tasks.ts";

export const task = (id: string): Task => {
  const t = DEFAULT_CONTENT.tasks.find((x) => x.id === id);
  if (!t) throw new Error("no task " + id);
  return t;
};

export const ready = (at = 0): CapturedEvent => ({ type: "ready", at, w: 1440, h: 1024 });
export const open = (section: string, at: number, surface: "mega" | "dropdown" | "drill" = "mega", via: "hover" | "click" = "hover"): CapturedEvent => ({ type: "menu-open", at, section, surface, via });
export const close = (section: string, at: number): CapturedEvent => ({ type: "menu-close", at, section });

export const leaf = (href: string, section: string, column: string, at: number, kind: ClickMsg["kind"] = "nav-leaf"): CapturedEvent => ({
  type: "click", at, kind, href, section, column, label: href, x: 10, y: 10, ends: true,
});
export const click = (kind: ClickMsg["kind"], at: number, extra: Partial<ClickMsg> = {}): CapturedEvent => ({ type: "click", at, kind, x: 1, y: 1, ends: false, ...extra });
