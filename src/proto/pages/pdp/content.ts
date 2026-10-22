import type { UsageIconType } from "@doterra-it/design-system-ui-ecommerce";
import { slugify } from "../../search/format";
import { productImage, productSize } from "../../search/productView";
import { allProducts, findProductBySlug } from "../../search/service/searchService";
import type { Product } from "../../search/types";
import { homeImages as img } from "../home/images";

/**
 * Product page content. The layout is the signed-out retail design ("Retail customer not logged in" in the Figma
 * Product Detail Page page). Everything in this file is PROTOTYPE COPY written for testing, not approved content:
 * Lavender has its own copy, every other product gets copy generated from its catalogue fields, and the reviews and
 * FAQ are invented stand-ins. Replace them with the PDP team's copy before any result is read as evidence about copy.
 */

export interface PdpReview { stars: number; body: string; name: string; title: string }
export interface PdpFaq { q: string; a: string }
export interface PdpImage { src: string; alt: string }
export interface Pdp {
  slug: string;
  name: string;
  /** The catalogue record, used for the breadcrumb trail. */
  product: Product;
  sku: string;
  size: string;
  retail: number;
  /** Price with an account: the catalogue wholesale price, which is 25% off retail, as the design states. */
  account: number;
  rating: number;
  reviewCount: number;
  bestSeller: boolean;
  soldThisWeek: boolean;
  images: PdpImage[];
  blurb: string;
  things: string[];
  cautions: string;
  usage: UsageIconType[];
  description: string[];
  howTo: string[];
  reviews: PdpReview[];
  faq: PdpFaq[];
  related: Product[];
}

const FILLERS = [img.credibility, img.hero, img.catSkin, img.catWellness, img.campaignAbode];

/** The catalogue only: a product that is not served has no page. */
export const findPdpProduct = (slug: string): Product | undefined => findProductBySlug(slug);

/**
 * The page slug for a homepage card. The dummy and the live catalogue name the same products differently (Lavender
 * Essential Oil, Lavender Oil), so each card lists the slugs to try; the first one that exists wins and the last is the
 * fallback (which then renders the plain stub).
 */
export const pdpSlugFor = (candidates: string[]): string => candidates.find((c) => findPdpProduct(c)) ?? candidates[candidates.length - 1];

/** The live catalogue also carries a size and a description; the dummy one does not. */
type Rec = Product & { size?: string; description?: string };

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

const APPLICATION_ICON: Record<string, { icon: UsageIconType; use: string; how: string }> = {
  "Aromatic / Diffusion": { icon: { type: "diffused", label: "Aromatically" }, use: "Diffuse three to four drops in the room of your choice.", how: "Aromatic: add three to four drops to a diffuser." },
  Topical: { icon: { type: "topically", label: "Topically" }, use: "Apply one to two drops to the area of choice, diluted with a carrier oil if you have sensitive skin.", how: "Topical: apply one to two drops to the area of choice." },
  "Internal / Dietary Supplement": { icon: { type: "internally", label: "Internally" }, use: "Take as directed on the label.", how: "Internal: follow the directions on the label." },
};

const REVIEW_NAMES = ["Alicia M.", "Daniel R.", "Priya S.", "Chris T."];

const FAQ: PdpFaq[] = [
  { q: "How should I store my essential oils?", a: "Keep the bottle tightly closed, out of direct sunlight and away from heat. A cool cupboard or drawer works well." },
  { q: "How long does a 15 mL bottle last?", a: "That depends on how you use it. With daily diffusing a bottle lasts a few weeks; for occasional topical use it can last many months." },
  { q: "Is it safe to use around children and pets?", a: "Keep all essential oils out of reach of children. Some oils are not suitable for use around pets, so check with your vet if you are unsure." },
  { q: "Can I diffuse it with other oils?", a: "Yes. Many people blend two or three oils in a diffuser. Start with a drop or two of each and adjust to taste." },
  { q: "What is the difference between a single oil and a blend?", a: "A single oil comes from one plant. A blend combines several oils to create a particular aroma or purpose." },
  { q: "Where can I find the Safety Data Sheet?", a: "Use the download button beside the product details to open the Safety Data Sheet for this product." },
];

const LAVENDER = {
  blurb: "A calming, floral essential oil with a sweet herbaceous aroma. Diffuse it in the evening, or apply it to the skin, to help you wind down.",
  things: [
    "Diffuse three to four drops in the bedroom or living room to create a calm, relaxing atmosphere.",
    "Apply one to two drops to the back of the neck or the soles of the feet, diluted with a carrier oil.",
    "Add a few drops to a warm bath, or place a drop on your pillow before bed.",
    "Keep a bottle on the bedside table so it is part of your evening routine.",
  ],
  cautions: "Possible skin sensitivity. Keep out of reach of children. If you are pregnant, nursing or under a doctor’s care, consult your physician before use. Avoid contact with eyes, inner ears and sensitive areas.",
  usage: [{ type: "diffused", label: "Aromatically" }, { type: "topically", label: "Topically" }, { type: "droplets", label: "With no dilution (neat)" }] as UsageIconType[],
  description: [
    "Lavender has a sweet, floral, herbaceous aroma. The oil is steam distilled from the flowering tops of the plant and tested to the CPTG Certified Pure Tested Grade® standard.",
    "Keep a bottle by the bed, in the bathroom or in your bag for the moments when you want to slow down.",
  ],
  howTo: [
    "Aromatic: add three to four drops to a diffuser and run it for 30 to 60 minutes in the evening.",
    "Topical: apply one to two drops to the back of the neck or the soles of the feet. Dilute with a carrier oil if you have sensitive skin.",
    "Bedtime: add a few drops to a warm bath, or place one drop on your pillow.",
  ],
  reviews: [
    { stars: 5, body: "I diffuse this an hour before bed. The smell is soft, not too sweet, and now part of how I wind down.", name: "Alicia M.", title: "Customer" },
    { stars: 4, body: "A clean lavender scent. A little goes a long way, so the bottle is lasting longer than I expected.", name: "Daniel R.", title: "Customer" },
    { stars: 5, body: "A few drops in a warm bath on Sunday nights. I keep a spare bottle in the cupboard now.", name: "Priya S.", title: "Customer" },
    { stars: 4, body: "Easy to use and the aroma is great. I wish it came with a dropper cap.", name: "Chris T.", title: "Customer" },
  ],
};

export function buildPdp(slug: string): Pdp | undefined {
  const product = findPdpProduct(slug) as Rec | undefined;
  if (!product) return undefined;
  const key = slugify(product.name);
  const lavender = key === "lavender-essential-oil" || key === "lavender-oil";
  const h = hash(key);
  const apps = product.applications.map((a) => APPLICATION_ICON[a]).filter(Boolean);
  const goals = product.goals.slice(0, 2).join(" and ").toLowerCase();
  const own = productImage(product);
  const related = allProducts()
    .filter((p) => p.id !== product.id && p.inStock)
    .sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category) || Number(b.status.includes("Best Sellers")) - Number(a.status.includes("Best Sellers")))
    .slice(0, 6);
  return {
    slug: key,
    name: product.name,
    product,
    sku: product.sku,
    size: productSize(product),
    retail: product.retail,
    account: product.wholesale,
    rating: product.rating > 0 ? product.rating : 4,
    reviewCount: lavender ? 220 : 40 + (h % 360),
    bestSeller: product.status.includes("Best Sellers"),
    soldThisWeek: product.status.includes("Best Sellers"),
    images: [{ src: own, alt: product.name }, ...FILLERS.map((src, i) => ({ src, alt: `${product.name}, image ${i + 2}` }))],
    blurb: lavender ? LAVENDER.blurb : `A ${product.productType.toLowerCase()} from our ${product.category.toLowerCase()} range, popular with customers looking for ${goals || "everyday support"}.`,
    things: lavender ? LAVENDER.things : [...apps.map((a) => a.use), "Store in a cool, dry place.", "Keep out of reach of children."],
    cautions: lavender ? LAVENDER.cautions : "Keep out of reach of children. If you are pregnant, nursing or under a doctor’s care, consult your physician before use. Avoid contact with eyes and sensitive areas.",
    usage: lavender ? LAVENDER.usage : apps.map((a) => a.icon),
    description: lavender ? LAVENDER.description : product.description ? [product.description] : [`${product.name} is part of our ${product.category} range and is made to be part of a daily routine.`, "Every batch is tested to the CPTG Certified Pure Tested Grade® standard."],
    howTo: lavender ? LAVENDER.howTo : apps.length ? apps.map((a) => a.how) : ["Follow the directions on the label."],
    reviews: lavender ? LAVENDER.reviews : REVIEW_NAMES.map((name, i) => ({ stars: i % 2 ? 4 : 5, body: i % 2 ? `A solid choice. ${product.name} does what I wanted and I will order it again.` : `I use ${product.name} most days and it has become part of my routine.`, name, title: "Customer" })),
    faq: FAQ,
    related,
  };
}
