import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Box, Flex, Grid, Icon, Link, Stack, Text, utilClassNames } from "@doterra-it/design-system-ui-base";
import type { IconName } from "@doterra-it/design-system-ui-base";
import { ContentCard } from "@doterra-it/design-system-ui-ecommerce";
import { Link as RouterLink } from "react-router-dom";
import type { NavColumn, NavFeatured, NavItem, NavLink } from "../types/navigation";
import { FeaturedMedia } from "./FeaturedMedia";
import { testIdFor } from "./NavLinkItem";
import { SECTION_LABEL_STYLE, sectionLabel } from "./sectionLabel";

interface Props {
  items: NavItem[];
  onNavigate: () => void;
  /** EXPERIMENT: section crumb. Open drilled into this item instead of the first stage. */
  initialId?: string | null;
}

/**
 * One sub category as a text-only Pure Link, with its optional leading icon or trailing arrow. Link (not Button)
 * because every Button link variant is hard-coded underlined in Pure; Link's underline="hover" matches Figma,
 * where rows are plain until hovered or pressed. py-4 (12px) top and bottom makes each 24px link a 48px row (Figma uses
 * 44px; no Pure spacing token gives 44, and 48 keeps the tap target above the 44px minimum).
 */
function NavLinkButton({ link, onNavigate }: { link: NavLink; onNavigate: () => void }) {
  const viewAll = link.variant === "viewAll";
  const icon = (viewAll ? "arrow-right" : link.icon) as IconName | undefined;
  return (
    <Link as={RouterLink} to={link.href} underline="hover" size="textMd" className={utilClassNames("py-4")} onClick={onNavigate} data-testid={testIdFor("mobile-link", link.href)}>
      <Flex align="center" spacing="sm">
        {icon && !viewAll && <Icon name={icon} size="md" color="brand" />}
        <span>{link.label}</span>
        {icon && viewAll && <Icon name={icon} size="sm" />}
      </Flex>
    </Link>
  );
}

// Section labels are all caps with letter spacing (PC-44): see sectionLabel.ts for the single approved exception.
function Section({ column, onNavigate, showChildren = false }: { column: NavColumn; onNavigate: () => void; showChildren?: boolean }) {
  return (
    <Stack spacing={0} align="start">
      <Text as="h3" size="textXs" weight="semiBold" color="text-subtle" style={SECTION_LABEL_STYLE} className={utilClassNames("py-4", "mt-6")}>{sectionLabel(column.title)}</Text>
      {column.links.map((l) => (
        <Stack key={l.href} spacing={0} align="start">
          <NavLinkButton link={l} onNavigate={onNavigate} />
          {showChildren && l.children && (
            <Stack spacing={0} align="start" className={utilClassNames("pl-4")}>
              {l.children.map((c) => <NavLinkButton key={c.href} link={c} onNavigate={onNavigate} />)}
            </Stack>
          )}
        </Stack>
      ))}
    </Stack>
  );
}

function FeaturedBlock({ featured, onNavigate }: { featured: NavFeatured; onNavigate: () => void }) {
  return (
    <Stack spacing="md" align="start">
      <Text as="h3" size="textXs" weight="semiBold" color="text-subtle" style={SECTION_LABEL_STYLE} className={utilClassNames("py-4", "mt-6")}>FEATURED</Text>
      <ContentCard href={featured.link.href} zoomOnHover shadow="none" borderWidth="none">
        <Flex direction="column" spacing="md"><FeaturedMedia href={featured.link.href} /><Text size="textMd">{featured.title}</Text></Flex>
      </ContentCard>
      <NavLinkButton link={{ ...featured.link }} onNavigate={onNavigate} />
    </Stack>
  );
}

const byOrder = (key: "mobileOrder" | "tabletOrder") => (a: NavColumn, b: NavColumn) => (a[key] ?? 0) - (b[key] ?? 0);

/**
 * Section content for one menu. Mobile (Figma 3121:12693) is a flat single column in `mobileOrder`; nested
 * `children` appear on tablet only (Figma 3135:14710). Tablet is two columns
 * (left and right) when every column sets `tabletSide`, otherwise a wrapped two-column grid.
 */
function SectionView({ columns, featured, onNavigate }: { columns: NavColumn[]; featured?: NavFeatured; onNavigate: () => void }) {
  const mobile = [...columns].sort(byOrder("mobileOrder"));
  const twoSided = columns.every((c) => c.tabletSide);
  const side = (which: "left" | "right") => columns.filter((c) => c.tabletSide === which).sort(byOrder("tabletOrder"));
  return (
    <>
      <Stack spacing={0} align="start" className={utilClassNames("md:hidden")}>
        {mobile.map((col) => <Section key={col.title} column={col} onNavigate={onNavigate} />)}
        {featured && <FeaturedBlock featured={featured} onNavigate={onNavigate} />}
      </Stack>
      <Box className={utilClassNames("hidden", "md:display-block")}>
      <Grid gap="xl">
        {twoSided ? (
          <>
            <Grid.Column span={{ xs: 12, md: 6 }}>
              {side("left").map((col) => <Section key={col.title} column={col} onNavigate={onNavigate} showChildren />)}
            </Grid.Column>
            <Grid.Column span={{ xs: 12, md: 6 }}>
              {side("right").map((col) => <Section key={col.title} column={col} onNavigate={onNavigate} showChildren />)}
              {featured && <FeaturedBlock featured={featured} onNavigate={onNavigate} />}
            </Grid.Column>
          </>
        ) : (
          <>
            {mobile.map((col) => (
              <Grid.Column key={col.title} span={{ xs: 12, md: 6 }}><Section column={col} onNavigate={onNavigate} showChildren /></Grid.Column>
            ))}
            {featured && <Grid.Column span={{ xs: 12, md: 6 }}><FeaturedBlock featured={featured} onNavigate={onNavigate} /></Grid.Column>}
          </>
        )}
      </Grid>
      </Box>
    </>
  );
}

/**
 * Strict-mode exception 5 (approved 9 Oct 2026, register PC-51): the first-stage items take a looser line height
 * (Pure's --font-line-height-lg, 1.6) through inline style, because Pure Link has no line-height option. It sits on the label, not the Link, because Pure's size classes set
 * line-height with !important. Remove when Pure adds the option.
 */
const ROOT_ITEM_STYLE = { lineHeight: "var(--font-line-height-lg)" };

const T_BASE = "var(--time-transition-base)";
const T_FAST = "var(--time-transition-fast)";
const SLIDE = "var(--spacing-6)";
/** Matches --time-transition-fast (125ms): how long the outgoing view takes to leave before the next one is swapped in. */
const OUT_MS = 125;
/** Long enough for the incoming view to paint at its start position before it transitions in. */
const PAINT_MS = 30;

type Phase = "idle" | "out" | "pre";

/**
 * Strict-mode exception 6 (approved 9 Oct 2026, register PC-52): moving between the first and second stage fades the
 * old view out while it slides 24px away, then the new view slides in from the other side (drilling in moves left,
 * going back moves right). Pure has no view transition, so it is inline style with Pure's transition and spacing
 * tokens. Reduced motion gets no transition. Remove if Pure adds a drill-in menu transition.
 */
const viewStyle = (phase: Phase, direction: 1 | -1, reduceMotion: boolean): CSSProperties => {
  if (reduceMotion) return {};
  if (phase === "out") return { opacity: 0, transform: `translateX(calc(${-direction} * ${SLIDE}))`, transition: `opacity ${T_FAST} ease, transform ${T_FAST} ease`, pointerEvents: "none" };
  if (phase === "pre") return { opacity: 0, transform: `translateX(calc(${direction} * ${SLIDE}))`, transition: "none", pointerEvents: "none" };
  return { opacity: 1, transform: "translateX(0)", transition: `opacity ${T_BASE} ease, transform ${T_BASE} ease` };
};

/**
 * Mobile and tablet menu following the Figma drill-in: a root list of top-level items, then one
 * section view per item with a back button, category headers and sub categories as text buttons.
 * Built here (not on Pure Menu) because Menu's submenu drill-in does not open in Pure 2.6.0.
 */
export function MobileNav({ items, onNavigate, initialId = null }: Props) {
  const [activeId, setActiveId] = useState<string | null>(initialId); // EXPERIMENT: section crumb (initialId)
  const [phase, setPhase] = useState<Phase>("idle");
  const [direction, setDirection] = useState<1 | -1>(1);
  const reduceMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  /** Swap the view with the slide: out, swap while hidden on the far side, then in. */
  const go = (next: string | null) => {
    if (phase !== "idle") return;
    if (reduceMotion) { setActiveId(next); return; }
    setDirection(next ? 1 : -1);
    setPhase("out");
    timers.current.push(window.setTimeout(() => {
      setActiveId(next);
      setPhase("pre");
      // A short timeout, not requestAnimationFrame (paused while the page is not painting): the hidden start position has to paint before the transition to the resting position begins
      timers.current.push(window.setTimeout(() => setPhase("idle"), PAINT_MS));
    }, OUT_MS));
  };
  const lastId = useRef<string | null>(null);
  const first = useRef(true);
  const active = items.find((i) => i.id === activeId) ?? null;

  // Keep keyboard focus with the view: to the back button when drilling in, back to the row when returning.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const selector = active ? '[data-testid="mobile-back"]' : `[data-testid="mobile-${lastId.current}"]`;
    document.querySelector<HTMLElement>(selector)?.focus();
  }, [active]);

  if (!active) {
    return (
      <div style={viewStyle(phase, direction, reduceMotion)}>
      {/* Only four primary items, so the first stage is set larger (displaySm) than the section views (textMd) and has room to breathe */}
      <Stack spacing="lg" align="start" aria-label="Main menu" as="nav">
        {items.map((item) => (
          <Link
            key={item.id}
            as="button"
            type="button"
            underline="hover"
            size="displaySm"
            onClick={() => go(item.id)}
            data-testid={`mobile-${item.id}`}
          >
            <Flex align="center" spacing="sm"><span style={ROOT_ITEM_STYLE}>{item.label}</span><Icon name="chevron-right" size="lg" /></Flex>
          </Link>
        ))}
      </Stack>
      </div>
    );
  }

  const columns: NavColumn[] = active.type === "megaMenu" ? active.columns : [{ title: active.label, links: active.links }];
  return (
    <div style={viewStyle(phase, direction, reduceMotion)}>
    <Stack spacing="sm" align="start" aria-label={`${active.label} menu`} as="nav">
      <Link as="button" type="button" underline="hover" size="textLg" onClick={() => { lastId.current = active.id; go(null); }} data-testid="mobile-back">
        <Flex align="center" spacing="sm"><Icon name="arrow-left" size="sm" /><span>{active.label}</span></Flex>
      </Link>
      <SectionView columns={columns} featured={active.type === "megaMenu" ? active.featured : undefined} onNavigate={onNavigate} />
    </Stack>
    </div>
  );
}
