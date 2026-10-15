/**
 * The ONE strict-mode exception in the app (approved 6 Oct 2026, register PC-44): Figma sets section labels in all
 * caps with 2.4px letter spacing. Pure Text has neither option, so the caps come from the string and the spacing is
 * applied with a Pure token through inline style. Remove when Pure adds a Text option.
 */
export const SECTION_LABEL_STYLE = { letterSpacing: "var(--font-letter-spacing-looser)" };

/** All caps for section labels, keeping the brand name as dōTERRA (Figma: "ABOUT dōTERRA"). */
export const sectionLabel = (text: string) => text.toUpperCase().replace(/D[OŌ]TERRA/g, "dōTERRA");
