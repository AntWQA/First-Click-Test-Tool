import navigation from "../proto/data/navigation.json" with { type: "json" };
import footer from "../proto/data/footer.json" with { type: "json" };

/**
 * Lookup from a link's href to where it lives in the navigation, built from the same data files the prototype renders.
 * Header hrefs are unique across the whole navigation (checked by a test), so a click can be described without
 * trusting any DOM structure. Footer hrefs reuse header routes (for example /shop), so they live in their own index.
 */

export interface NavEntry {
  href: string;
  label: string;
  /** shop, learn, our-story, rewards for the header; "footer" for footer links. */
  section: string;
  /** Raw column title (for example "Shop by Goal"). Rewards has no columns, so it uses the item label. */
  column: string;
  area: "header" | "footer";
}

interface RawLink { label: string; href: string; children?: RawLink[] }
interface RawColumn { title: string; links: RawLink[] }
interface RawItem { id: string; label: string; type: string; columns?: RawColumn[]; links?: RawLink[]; featured?: { link: RawLink } }
interface RawMenu { title: string; links: RawLink[] }

export const SECTION_IDS = (navigation as unknown as { items: RawItem[] }).items.map((i) => i.id);
export const SECTION_LABELS: Record<string, string> = Object.fromEntries((navigation as unknown as { items: RawItem[] }).items.map((i) => [i.id, i.label]));

/** Strips query, hash and any trailing slash, so /shop/ and /shop?x=1 compare equal to /shop. */
export function normaliseHref(href: string): string {
  const cut = href.split("#")[0]!.split("?")[0]!;
  return cut.length > 1 ? cut.replace(/\/+$/, "") : cut;
}

const header = new Map<string, NavEntry>();
const footerIndex = new Map<string, NavEntry[]>();

const addHeader = (link: RawLink, section: string, column: string) => {
  header.set(normaliseHref(link.href), { href: normaliseHref(link.href), label: link.label, section, column, area: "header" });
  for (const child of link.children ?? []) addHeader(child, section, column);
};

for (const item of (navigation as unknown as { items: RawItem[] }).items) {
  if (item.type === "dropdown") for (const l of item.links ?? []) addHeader(l, item.id, item.label);
  else {
    for (const col of item.columns ?? []) for (const l of col.links) addHeader(l, item.id, col.title);
    if (item.featured) addHeader(item.featured.link, item.id, "Featured");
  }
}

const addFooter = (link: RawLink, column: string) => {
  const href = normaliseHref(link.href);
  const list = footerIndex.get(href) ?? [];
  list.push({ href, label: link.label, section: "footer", column, area: "footer" });
  footerIndex.set(href, list);
};
for (const menu of (footer as unknown as { menus: RawMenu[] }).menus) for (const l of menu.links) addFooter(l, menu.title);
for (const l of (footer as unknown as { legalLinks: RawLink[] }).legalLinks) addFooter(l, "Legal");

export const lookupHeader = (href: string): NavEntry | undefined => header.get(normaliseHref(href));
export const lookupFooter = (href: string): NavEntry[] => footerIndex.get(normaliseHref(href)) ?? [];
export const hrefExists = (href: string): boolean => header.has(normaliseHref(href)) || footerIndex.has(normaliseHref(href));
export const allHeaderEntries = (): NavEntry[] => [...header.values()];
export const allFooterEntries = (): NavEntry[] => [...footerIndex.values()].flat();
