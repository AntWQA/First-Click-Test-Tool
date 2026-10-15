import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Button, Header } from "@doterra-it/design-system-ui-base";

const T = "var(--time-transition-base)";

/** One stacked layer. The hidden layer is also visibility:hidden (after the fade), which removes it from the tab order and the accessibility tree. */
const layerStyle = (visible: boolean, reduceMotion: boolean): CSSProperties => ({
  gridArea: "1 / 1",
  opacity: visible ? 1 : 0,
  visibility: visible ? "visible" : "hidden",
  transition: reduceMotion ? "none" : `opacity ${T} ease, visibility 0s linear ${visible ? "0s" : T}`,
});

/**
 * The mobile menu button. Pure's Header.MenuToggle shows the menu icon and the open state is the labelled primary
 * Close button, so the two are stacked in one grid cell and cross-faded: the menu icon fades out as the Close
 * button fades in, and back again on close.
 *
 * Strict-mode exception (inline style, timing from Pure's --time-transition-base token, reduced motion gets no
 * transition; register PC-50). Remove if Pure adds a fade to Header.MenuToggle.
 *
 * The menu toggle owns the real controls target ("mobile-menu", the Pure MobileMenu panel); the Close button
 * repeats it by hand.
 */
export function MenuToggle({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const reduceMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  return (
    // The Close button (69px) is wider than Pure's 56px menu toggle, so the shared cell is 69px in both states: the header icons sit 13px further left than with the toggle alone, which keeps a clear gap before Close and means nothing moves when the menu opens. Both layers align to the right edge, so the menu icon stays where Pure puts it.
    <div style={{ display: "grid" }}>
      <div style={{ ...layerStyle(!isOpen, reduceMotion), justifySelf: "end" }}>
        <Header.MenuToggle id="mobile-menu" name="Show Header Menu" isOpen={false} onToggleClick={onToggle} />
      </div>
      <div style={{ ...layerStyle(isOpen, reduceMotion), justifySelf: "end", alignSelf: "center" }}>
        <Button variant="primary" size="small" onClick={onToggle} aria-controls="mobile-menu" aria-expanded={isOpen} data-testid="drawer-close">Close</Button>
      </div>
    </div>
  );
}
