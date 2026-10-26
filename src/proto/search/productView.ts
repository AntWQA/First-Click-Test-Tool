import { slugify } from "./format";
import { liveImage } from "./data/liveCatalogue";
import type { Product } from "./types";
import { productPackFor } from "../pages/pdp/images";

/**
 * One definition of how a product is shown, and of which products may be shown at all.
 *
 * THE IMAGE BANK RULE: a product is served anywhere in the prototype (search results, suggestions, the product page,
 * recommendations, the homepage) only when we hold an image that really shows that product. The dummy catalogue reuses
 * a few placeholder photos across dozens of unrelated products, so a product that only has one of those is not served.
 * Two sources count, in this order:
 *   1. the photos taken from the product's own page on the doTERRA US storefront (pages/pdp/images.ts), for the products this prototype features;
 *   2. the live catalogue's own photo for the product (matched by item code), where the live catalogue is loaded.
 * An image that was cropped or shrunk from a bigger one is not acceptable: the dummy catalogue's own 180 by 160 photos were removed for that reason.
 * Name and price come from the catalogue record, so a card, a page and a search result always agree.
 */
const imageOrUndefined = (p: Product): string | undefined => productPackFor(slugify(p.name)) ?? (p.image ? liveImage(p.image) : undefined);

/** True when we hold an image that really shows this product. Only these products are served. */
export const inImageBank = (p: Product): boolean => imageOrUndefined(p) !== undefined;
/** The product's own image. Only call it for products in the bank (everything the prototype serves is). */
export const productImage = (p: Product): string => imageOrUndefined(p) ?? "";

const SIZE: Record<string, string> = { "Essential Oils": "15 mL", "Personal Care": "4 oz", "Supplements & Nutrition": "60 softgels", Accessories: "1 ea", "Bundles & Collections": "1 kit" };
/** The live catalogue carries a size; the dummy one does not. */
export const productSize = (p: Product & { size?: string }): string => p.size || SIZE[p.category] || "1 ea";
export const productMeta = (p: Product): string => `${p.productType} · ${productSize(p)}`;
