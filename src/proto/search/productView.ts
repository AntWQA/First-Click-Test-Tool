import { slugify } from "./format";
import { liveImage } from "./data/liveCatalogue";
import { imageFor } from "./images";
import type { Product } from "./types";
import { homeImages as img } from "../pages/home/images";
import { pdpImages } from "../pages/pdp/images";

/**
 * One definition of how a product is shown, and of which products may be shown at all.
 *
 * THE IMAGE BANK RULE: a product is served anywhere in the prototype (search results, suggestions, the product page,
 * recommendations, the homepage) only when we hold an image that really shows that product. The dummy catalogue reuses
 * a few placeholder photos across dozens of unrelated products, so a product that only has one of those is not served.
 * Three sources count, in this order:
 *   1. the product shots from the homepage and product page designs, for the best sellers the homepage features and the MetaPWR products;
 *   2. the live catalogue's own photo for the product (matched by item code), where the live catalogue is loaded;
 *   3. the few dummy photos that genuinely show a product (EO Mega+, VMG+, PB Restore).
 * Name and price come from the catalogue record, so a card, a page and a search result always agree.
 */
const FEATURED_IMAGES: Record<string, string> = {
  "lavender-essential-oil": img.productLavender,
  "lavender-oil": img.productLavender,
  "on-guard-protecting-blend": img.productOnGuard,
  "d-terra-on-guard-oil-blend": img.productOnGuard,
  "frankincense-essential-oil": img.productFrankincense,
  "15ml-frankincense-essential-oil": img.productFrankincense,
  "deep-blue-rub": img.productDeepBlueRub,
  "ylang-ylang-essential-oil": img.productYlangYlang,
  "metapwr-advantage": pdpImages.metapwrAdvantage,
  "metapwr-starter-system": pdpImages.metapwr,
};

/** Dummy photos that show exactly the product they are named after, keyed by the product's name slug. */
const DUMMY_OWN_IMAGES: Record<string, string> = {
  "eo-mega": imageFor("eo-mega"),
  "vmg": imageFor("vmg-plus"),
  "pb-restore": imageFor("pb-restore"),
};

const imageOrUndefined = (p: Product): string | undefined =>
  FEATURED_IMAGES[slugify(p.name)] ?? (p.image ? liveImage(p.image) : undefined) ?? DUMMY_OWN_IMAGES[slugify(p.name)];

/** True when we hold an image that really shows this product. Only these products are served. */
export const inImageBank = (p: Product): boolean => imageOrUndefined(p) !== undefined;
/** The product's own image. Only call it for products in the bank (everything the prototype serves is). */
export const productImage = (p: Product): string => imageOrUndefined(p) ?? "";

const SIZE: Record<string, string> = { "Essential Oils": "15 mL", "Personal Care": "4 oz", "Supplements & Nutrition": "60 softgels", Accessories: "1 ea", "Bundles & Collections": "1 kit" };
/** The live catalogue carries a size; the dummy one does not. */
export const productSize = (p: Product & { size?: string }): string => p.size || SIZE[p.category] || "1 ea";
export const productMeta = (p: Product): string => `${p.productType} · ${productSize(p)}`;
