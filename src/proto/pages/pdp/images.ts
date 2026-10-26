/**
 * Product page imagery for MetaPWR Advantage, from its page on the doTERRA US storefront (item 60222772), plus the
 * CPTG mark and the MetaPWR Starter System photo from the updated PDP design. Saved as WebP to keep the single-file
 * build inside its size budget. `metapwrAdvantage` is the product shot (the pack shot cropped to the product) used on cards, in search, in the bag and first in the gallery,
 * so a card and its page always show the same photo.
 */
import cptg from "./images/cptg-logo.svg";
import metapwr from "./images/metapwr.jpg";
import box from "./images/metapwr-advantage-box.webp";
import lifestyle from "./images/metapwr-advantage-lifestyle.webp";
import mixing from "./images/metapwr-advantage-mixing.webp";
import pack from "./images/metapwr-advantage-pack.webp";

const metapwrAdvantage = pack;

export const pdpImages = { cptg, metapwr, metapwrAdvantage } as const;

/** The MetaPWR Advantage gallery: image, alt text, thumbnail. */
export const METAPWR_GALLERY: Array<{ src: string; alt: string; thumb: string }> = [
  { src: pack, alt: "MetaPWR Advantage box and two sachets, Lemon-Orange flavor", thumb: pack },
  { src: box, alt: "A sachet being taken from the MetaPWR Advantage box, beside a MetaPWR bottle and a bottle of MetaPWR essential oil", thumb: box },
  { src: lifestyle, alt: "A woman pouring a MetaPWR Advantage sachet into a water bottle at a table", thumb: lifestyle },
  { src: mixing, alt: "A MetaPWR Advantage sachet being poured into a bottle of water", thumb: mixing },
];
