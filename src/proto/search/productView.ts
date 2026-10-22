import { slugify } from "./format";
import { imageFor } from "./images";
import type { Product } from "./types";
import { homeImages as img } from "../pages/home/images";

/**
 * One definition of how a product is shown, used by every card that surfaces a product (homepage best sellers, search
 * results, typeahead, the product page and its recommendations) so the same product always has the same name, image
 * and price wherever it appears. Name and price come from the catalogue record itself; the image is the shot from the
 * homepage design for the five best sellers it features (keyed by name slug, for the dummy and the live catalogue) and
 * the catalogue image for everything else.
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
};

export const productImage = (p: Product): string => FEATURED_IMAGES[slugify(p.name)] ?? imageFor(p.image);

const SIZE: Record<string, string> = { "Essential Oils": "15 mL", "Personal Care": "4 oz", "Supplements & Nutrition": "60 softgels", Accessories: "1 ea", "Bundles & Collections": "1 kit" };
/** The live catalogue carries a size; the dummy one does not. */
export const productSize = (p: Product & { size?: string }): string => p.size || SIZE[p.category] || "1 ea";
export const productMeta = (p: Product): string => `${p.productType} · ${productSize(p)}`;
