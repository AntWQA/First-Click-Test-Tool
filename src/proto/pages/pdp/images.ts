/**
 * Product page imagery for MetaPWR Advantage, from its page on the doTERRA US storefront (item 60222772), plus the
 * CPTG mark and the MetaPWR Starter System photo from the updated PDP design. Saved as WebP to keep the single-file
 * build inside its size budget. `metapwrAdvantage` is the product shot (the pack shot cropped to the product) used on cards, in search, in the bag and first in the gallery,
 * so a card and its page always show the same photo.
 */
import cptg from "./images/cptg-logo.svg";
import box from "./images/metapwr-advantage-box.webp";
import lifestyle from "./images/metapwr-advantage-lifestyle.webp";
import mixing from "./images/metapwr-advantage-mixing.webp";
import pack from "./images/metapwr-advantage-pack.webp";
import pbBerries from "./images/pb-restore-berries.webp";
import pbHand from "./images/pb-restore-hand.webp";
import pbPack from "./images/pb-restore-pack.webp";
import pbShelf from "./images/pb-restore-shelf.webp";
import deep_blue_rub_1 from "./images/products/deep-blue-rub-1.webp";
import deep_blue_rub_2 from "./images/products/deep-blue-rub-2.webp";
import deep_blue_rub_pack from "./images/products/deep-blue-rub-pack.webp";
import eo_mega_1 from "./images/products/eo-mega-1.webp";
import eo_mega_2 from "./images/products/eo-mega-2.webp";
import eo_mega_3 from "./images/products/eo-mega-3.webp";
import eo_mega_pack from "./images/products/eo-mega-pack.webp";
import frankincense_1 from "./images/products/frankincense-1.webp";
import frankincense_2 from "./images/products/frankincense-2.webp";
import frankincense_pack from "./images/products/frankincense-pack.webp";
import lavender_1 from "./images/products/lavender-1.webp";
import lavender_pack from "./images/products/lavender-pack.webp";
import on_guard_1 from "./images/products/on-guard-1.webp";
import on_guard_2 from "./images/products/on-guard-2.webp";
import on_guard_pack from "./images/products/on-guard-pack.webp";
import starter_1 from "./images/products/starter-1.webp";
import starter_2 from "./images/products/starter-2.webp";
import starter_pack from "./images/products/starter-pack.webp";
import vmg_1 from "./images/products/vmg-1.webp";
import vmg_2 from "./images/products/vmg-2.webp";
import vmg_3 from "./images/products/vmg-3.webp";
import vmg_pack from "./images/products/vmg-pack.webp";
import ylang_ylang_1 from "./images/products/ylang-ylang-1.webp";
import ylang_ylang_2 from "./images/products/ylang-ylang-2.webp";
import ylang_ylang_3 from "./images/products/ylang-ylang-3.webp";
import ylang_ylang_pack from "./images/products/ylang-ylang-pack.webp";

export const pdpImages = { cptg } as const;

/** The MetaPWR Advantage gallery: image, alt text, thumbnail. */
export const METAPWR_GALLERY: Array<{ src: string; alt: string; thumb: string }> = [
  { src: pack, alt: "MetaPWR Advantage box and two sachets, Lemon-Orange flavor", thumb: pack },
  { src: box, alt: "A sachet being taken from the MetaPWR Advantage box, beside a MetaPWR bottle and a bottle of MetaPWR essential oil", thumb: box },
  { src: lifestyle, alt: "A woman pouring a MetaPWR Advantage sachet into a water bottle at a table", thumb: lifestyle },
  { src: mixing, alt: "A MetaPWR Advantage sachet being poured into a bottle of water", thumb: mixing },
];

/** The PB Restore gallery, from its page on the doTERRA US storefront (item 60225766). */
export const PB_RESTORE_GALLERY: Array<{ src: string; alt: string; thumb: string }> = [
  { src: pbPack, alt: "PB Restore ProBiome Complex bottle, 30 dual chamber capsules", thumb: pbPack },
  { src: pbHand, alt: "A capsule in an open hand beside a bottle of PB Restore", thumb: pbHand },
  { src: pbBerries, alt: "A bottle of PB Restore on a plate of blueberries, strawberries and blackberries", thumb: pbBerries },
  { src: pbShelf, alt: "A bottle of PB Restore on a wooden shelf with two capsules beside it", thumb: pbShelf },
];

/**
 * Photos from each product's page on the doTERRA US storefront: the 600x900 product shot (set on a white 3:4 canvas so a card shows the whole
 * product) first, then up to three photos from the page. A product that is not listed here has only the one product shot the catalogue holds.
 * Never use an image that was cropped or shrunk from a larger one: take the page's own.
 */
const CURATED: Array<{ name: string; slugs: string[]; images: string[] }> = [
  { name: "MetaPWR Advantage", slugs: ["metapwr-advantage"], images: METAPWR_GALLERY.map((g) => g.src) },
  { name: "PB Restore", slugs: ["pb-restore", "pb-restore-probiome-complex"], images: PB_RESTORE_GALLERY.map((g) => g.src) },
  { name: "Lavender essential oil", slugs: ["lavender-essential-oil", "lavender-oil"], images: [lavender_pack, lavender_1] },
  { name: "On Guard protective blend", slugs: ["on-guard-protecting-blend", "d-terra-on-guard-oil-blend"], images: [on_guard_pack, on_guard_1, on_guard_2] },
  { name: "Frankincense essential oil", slugs: ["frankincense-essential-oil", "15ml-frankincense-essential-oil"], images: [frankincense_pack, frankincense_1, frankincense_2] },
  { name: "Deep Blue Rub", slugs: ["deep-blue-rub"], images: [deep_blue_rub_pack, deep_blue_rub_1, deep_blue_rub_2] },
  { name: "Ylang Ylang essential oil", slugs: ["ylang-ylang-essential-oil"], images: [ylang_ylang_pack, ylang_ylang_1, ylang_ylang_2, ylang_ylang_3] },
  { name: "EO Mega+", slugs: ["eo-mega", "eo-mega-essential-oil-omega-complex"], images: [eo_mega_pack, eo_mega_1, eo_mega_2, eo_mega_3] },
  { name: "VMG+", slugs: ["vmg", "vmg-redefines-the-daily-multivitamin"], images: [vmg_pack, vmg_1, vmg_2, vmg_3] },
  { name: "MetaPWR Starter System", slugs: ["metapwr-starter-system", "metapwr-system-enrollment-collection"], images: [starter_pack, starter_1, starter_2] },
];

const bySlug = new Map(CURATED.flatMap((c) => c.slugs.map((s) => [s, c] as const)));

/** The product shot for a product (by the slug of its name), or undefined when this prototype holds no US storefront image for it. */
export const productPackFor = (slug: string): string | undefined => bySlug.get(slug)?.images[0];

/** The gallery for a product (by the slug of its name), or undefined when the catalogue's own image is the only one. */
export const productGalleryFor = (slug: string): Array<{ src: string; alt: string; thumb: string }> | undefined => {
  const c = bySlug.get(slug);
  if (!c) return undefined;
  return c.images.map((src, i) => ({ src, thumb: src, alt: i === 0 ? `${c.name}, product shot` : `${c.name}, image ${i + 1}` }));
};
