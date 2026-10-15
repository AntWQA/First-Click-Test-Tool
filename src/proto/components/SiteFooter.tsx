import { useEffect } from "react";
import type { FocusEvent, MouseEvent } from "react";
import { Box } from "@doterra-it/design-system-ui-base";
import { FooterRecipeV2 } from "@doterra-it/design-system-ui-ecommerce";
import { sectionLabel } from "./sectionLabel";
import footer from "../data/footer.json";

/**
 * Footer menu links underline on hover and keyboard focus (register PC-45, approved exception 8 Oct 2026).
 * FooterRecipeV2 renders them as Link tertiary with underline never and takes no link props, so the underline is set
 * with one delegated handler as an inline style. The legal row sits in a list and already underlines on hover in Pure.
 * Remove when Pure adds hover and pressed states to Link or exposes underline on the recipe.
 */
const setMenuLinkUnderline = (event: MouseEvent<HTMLElement> | FocusEvent<HTMLElement>, on: boolean) => {
  const link = (event.target as HTMLElement).closest("a");
  if (link && !link.closest("ul")) link.style.textDecorationLine = on ? "underline" : "";
};

/**
 * Touch row height (register PC-48, approved exception 8 Oct 2026). Below lg the main nav sets links and section
 * labels at line height 1.5 with spacing-4 (12px) above and below, so rows are tap targets of about 48px. FooterRecipeV2 takes no spacing props, so the
 * same spacing is set on its links and titles as inline styles using Pure tokens. The recipe's own 16px row gap is
 * absorbed with a negative margin of half that gap (spacing-3, 8px), so rows keep a 48px pitch and the tap targets touch but never overlap.
 * Remove when Pure adds a touch size to FooterRecipeV2 or Link.
 */
const TOUCH_PAD = "var(--spacing-4)";
const TOUCH_PULL = "calc(var(--spacing-3) * -1)";
const TOUCH_LINE_HEIGHT = "1.5";
const touchStyles = (root: HTMLElement, touch: boolean) => {
  root.querySelectorAll<HTMLElement>("a").forEach((link) => {
    const legal = Boolean(link.closest("ul"));
    link.style.paddingBlock = touch ? TOUCH_PAD : "";
    link.style.lineHeight = touch ? TOUCH_LINE_HEIGHT : "";
    link.style.marginBlock = touch && !legal ? TOUCH_PULL : "";
    link.style.display = touch && legal ? "inline-block" : "";
    const title = legal ? null : (link.parentElement?.firstElementChild as HTMLElement | null | undefined);
    if (title && title !== link) {
      title.style.paddingBlock = touch ? TOUCH_PAD : "";
      title.style.lineHeight = touch ? TOUCH_LINE_HEIGHT : "";
    }
  });
};

/**
 * Page footer: Pure FooterRecipeV2 fed by src/data/footer.json.
 * Menu titles are uppercased here to match the primary navigation headings; Text has no text-transform prop (PC-44).
 */
export function SiteFooter() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("footer");
    if (!root) return;
    // Pure's lg breakpoint (1024px). Listens to resize as well as the media query so it also follows live viewport changes.
    const mql = window.matchMedia("(min-width: 1024px)");
    const apply = () => touchStyles(root, !mql.matches);
    apply();
    mql.addEventListener("change", apply);
    window.addEventListener("resize", apply);
    return () => {
      mql.removeEventListener("change", apply);
      window.removeEventListener("resize", apply);
      touchStyles(root, false);
    };
  }, []);
  return (
    <Box
      onMouseOver={(e: MouseEvent<HTMLElement>) => setMenuLinkUnderline(e, true)}
      onMouseOut={(e: MouseEvent<HTMLElement>) => setMenuLinkUnderline(e, false)}
      onFocus={(e: FocusEvent<HTMLElement>) => setMenuLinkUnderline(e, true)}
      onBlur={(e: FocusEvent<HTMLElement>) => setMenuLinkUnderline(e, false)}
    >
      <FooterRecipeV2
        tagline={footer.tagline}
        taglineEmphasis={footer.taglineEmphasis}
        menus={footer.menus.map((menu) => ({ ...menu, title: sectionLabel(menu.title) }))}
        fdaDisclaimer={footer.fdaDisclaimer}
        informationalDisclaimer={footer.informationalDisclaimer}
        copyright={footer.copyright}
        links={footer.legalLinks}
      />
    </Box>
  );
}
