import type { ReactNode } from "react";
import { Box, Container, Main, Section, Stack, Text, utilClassNames } from "@doterra-it/design-system-ui-base";
import { useLocation } from "react-router-dom";
import { PageBreadcrumbs } from "../components/PageBreadcrumbs";
import type { Crumb } from "../components/PageBreadcrumbs";
import navigation from "../data/navigation.json";
import type { Navigation } from "../types/navigation";
import type { Product } from "../search/types";
import { findProductBySlug } from "../search/service/searchService";

const titleCase = (slug: string) => slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/**
 * Paths that are not pages. "/shop" is the All Products page, so "/shop/all" is not a page, and the goal, highlights
 * and products groups are not visited either; Learn / Our Story column headings are not pages. Nothing links to
 * them, so a hand-typed or bookmarked URL is redirected to the nearest real page. Keyed by full path because the same
 * slug can be a real page elsewhere (/shop/essential-oils is a category, /learn/essential-oils is a column
 * heading). Being redirected, they never render, so the breadcrumb simply skips them as parents.
 */
export const NON_PAGE_REDIRECTS: Record<string, string> = {
  "/shop/all": "/shop",
  "/shop/goal": "/shop",
  "/shop/highlights": "/shop",
  "/shop/products": "/shop",
  // Learn, Our Story and Rewards are menu-only sections with no page of their own (see MENU_ONLY_SECTIONS), so they and their column headings go Home
  "/learn": "/",
  "/learn/blog": "/",
  "/learn/business": "/",
  "/learn/essential-oils": "/",
  "/learn/resources": "/",
  "/our-story": "/",
  "/our-story/about": "/",
  "/our-story/difference": "/",
  "/our-story/events": "/",
  "/rewards": "/",
};
/** Primary nav items that only open a menu: no page, so their crumb is plain text. Only Shop (All Products) is a page and is linked. */
const MENU_ONLY_SECTIONS = new Set(["/learn", "/our-story", "/rewards"]);
/** Catalogue category to its Shop category page (nav "Shop by Category"); a bundle belongs to Collections & Enrollment. */
const CATEGORY_PAGES: Record<string, { label: string; to: string }> = {
  "Essential Oils": { label: "Essential Oils", to: "/shop/essential-oils" },
  "Personal Care": { label: "Personal Care", to: "/shop/personal-care" },
  "Supplements & Nutrition": { label: "Supplements", to: "/shop/supplements" },
  "Accessories": { label: "Accessories", to: "/shop/accessories" },
  "Bundles & Collections": { label: "Collections & Enrollment", to: "/shop/collections-and-enrollment" },
};
/** Essential oil product types that have their own sub category page; other product types stop at the category. */
const ESSENTIAL_OIL_SUBCATEGORIES: Record<string, { label: string; to: string }> = {
  "Single Oil": { label: "Single Oils", to: "/shop/essential-oils/single-oils" },
  "Proprietary Blend": { label: "Proprietary Blends", to: "/shop/essential-oils/proprietary-blends" },
};
/** The category trail above a product: category, then sub category where the nav has one. */
export const productCategoryCrumbs = (product: Product) => {
  const category = CATEGORY_PAGES[product.category];
  const sub = product.category === "Essential Oils" ? ESSENTIAL_OIL_SUBCATEGORIES[product.productType] : undefined;
  return [category, sub].filter((c): c is { label: string; to: string } => Boolean(c));
};

/** Primary nav labels by path, used for the first crumb of a trail (linked, unless the section is menu-only). */
const SECTION_LABELS = new Map((navigation as unknown as Navigation).items.map((i) => [i.href, i.label]));
const SECTION_IDS = new Map((navigation as unknown as Navigation).items.map((i) => [i.href, i.id])); // EXPERIMENT: section crumb
const segmentLabel = titleCase;

/**
 * Page wrapper. Pure's Header is position fixed: 100px tall from lg, about 77px on mobile. Section size is not
 * responsive, so a small Section (xs, 4px) is used and the clearance is set with responsive padding: pt-12 (96px)
 * puts the first element about 23px under the mobile header, and lg:pt-8 (40px) on the Container restores the
 * desktop gap (4 + 40 + 96 = 140px, 40px under the 100px header).
 * The h-screen spacer below the content pushes the footer a full viewport down, so it stays off screen while the navigation is tested.
 * Pages with real content (search results) pass footerSpacer={false} so the footer follows the content directly.
 */
export function PageShell({ children, footerSpacer = true }: { children: ReactNode; footerSpacer?: boolean }) {
  return (
    <Main isFlush>
      <Section size="xs">
        <Container width="wide" className={utilClassNames("lg:pt-8")}>
          <Stack spacing="lg" className={utilClassNames("pt-12", "pb-12")}>{children}{footerSpacer && <Box aria-hidden="true" className={utilClassNames("h-screen")}>{null}</Box>}</Stack>
        </Container>
      </Section>
    </Main>
  );
}

/** Placeholder destination for any nav link: shows the route so wayfinding can be demonstrated. */
export function StubPage() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  // A product page (/shop/products/:slug) shows where the product sits in the catalogue: Home > Shop > Category > Sub category > Product
  const product = parts[0] === "shop" && parts[1] === "products" && parts.length === 3 ? findProductBySlug(parts[2]) : undefined;
  const crumbs: Crumb[] = [
    { label: "Home", to: "/" },
    ...(product
      ? [{ label: "Shop", to: "/shop" }, ...productCategoryCrumbs(product), { label: product.name, to: pathname }]
      : parts.flatMap((p, i): Crumb[] => {
        const to = `/${parts.slice(0, i + 1).join("/")}`;
        if (to in NON_PAGE_REDIRECTS && !MENU_ONLY_SECTIONS.has(to)) return [];
        // A menu-only section stays in the trail for context, as text
        if (MENU_ONLY_SECTIONS.has(to)) return [{ label: SECTION_LABELS.get(to) ?? segmentLabel(p), menuId: SECTION_IDS.get(to) }]; // EXPERIMENT: section crumb (menuId)
        return [{ label: SECTION_LABELS.get(to) ?? segmentLabel(p), to }];
      })),
  ];
  return (
    <PageShell>
      <PageBreadcrumbs crumbs={crumbs} />
      <Text as="h1" size="displayMd" weight="extraBold">{crumbs[crumbs.length - 1].label}</Text>
      <Text>Prototype page. Path: <code>{pathname}</code></Text>
    </PageShell>
  );
}
