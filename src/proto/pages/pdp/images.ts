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
import pbBerries from "./images/pb-restore-berries.webp";
import pbHand from "./images/pb-restore-hand.webp";
import pbPack from "./images/pb-restore-pack.webp";
import pbShelf from "./images/pb-restore-shelf.webp";

const metapwrAdvantage = pack;

export const pdpImages = { cptg, metapwr, metapwrAdvantage, pbRestore: pbPack } as const;

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
