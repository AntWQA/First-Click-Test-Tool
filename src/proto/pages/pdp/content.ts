import type { UsageIconType } from "@doterra-it/design-system-ui-ecommerce";
import { slugify } from "../../search/format";
import { productImage, productSize } from "../../search/productView";
import { allProducts, findProductBySlug } from "../../search/service/searchService";
import type { Product } from "../../search/types";
import { homeImages as img } from "../home/images";
import { METAPWR_GALLERY } from "./images";

/**
 * Product page content. The layout is the updated PDP design ("updated PDP/pdp.html", the version without the member
 * overlay). MetaPWR Advantage, the product the test uses, takes its details, price and images from its page on the
 * doTERRA US storefront (item 60222772): $112.67 retail, $84.50 with an account (25% off). Only the "Can be used" labels,
 * the rating and the badges come from the design. The reviews and FAQ are PROTOTYPE COPY (the design's are Lorem ipsum).
 * Every other product gets copy generated from its catalogue fields. Replace the invented parts with the PDP team's copy
 * before any result is read as evidence about copy.
 */

export interface PdpReview { stars: number; body: string; name: string; title: string }
export interface PdpFaq { q: string; a: string }
export interface PdpImage { src: string; alt: string; thumb?: string }
/** A "Can be used" label (the design shows them as small coloured tags). `tone` picks one of four colours. */
export interface UsageTag { label: string; tone: 1 | 2 | 3 | 4 }
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
  /** When set, the "Can be used" row shows these tags instead of the usage icons. */
  usageTags?: UsageTag[];
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

/** Products shown with no reviews yet (a newer product): an empty reviews section and no rating, for the "no reviews yet" scenario. */
const NO_REVIEWS = new Set(["pb-restore"]);

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

const APPLICATION_ICON: Record<string, { icon: UsageIconType; use: string; how: string }> = {
  "Aromatic / Diffusion": { icon: { type: "diffused", label: "Aromatically" }, use: "Diffuse three to four drops in the room of your choice.", how: "Aromatic: add three to four drops to a diffuser." },
  Topical: { icon: { type: "topically", label: "Topically" }, use: "Apply one to two drops to the area of choice, diluted with a carrier oil if you have sensitive skin.", how: "Topical: apply one to two drops to the area of choice." },
  "Internal / Dietary Supplement": { icon: { type: "internally", label: "Internally" }, use: "Take as directed on the label.", how: "Internal: follow the directions on the label." },
};

const REVIEW_NAMES = ["Alicia M.", "Daniel R.", "Priya S.", "Chris T."];

const OIL_FAQ: PdpFaq[] = [
  { q: "How should I store my essential oils?", a: "Keep the bottle tightly closed, out of direct sunlight and away from heat. A cool cupboard or drawer works well." },
  { q: "How long does a 15 mL bottle last?", a: "That depends on how you use it. With daily diffusing a bottle lasts a few weeks; for occasional topical use it can last many months." },
  { q: "Is it safe to use around children and pets?", a: "Keep all essential oils out of reach of children. Some oils are not suitable for use around pets, so check with your vet if you are unsure." },
  { q: "Can I diffuse it with other oils?", a: "Yes. Many people blend two or three oils in a diffuser. Start with a drop or two of each and adjust to taste." },
  { q: "What is the difference between a single oil and a blend?", a: "A single oil comes from one plant. A blend combines several oils to create a particular aroma or purpose." },
  { q: "Where can I find the Safety Data Sheet?", a: "Use the download button beside the product details to open the Safety Data Sheet for this product." },
];

const GENERAL_FAQ: PdpFaq[] = [
  { q: "How should I take or use it?", a: "Follow the directions on the label and in the How to use section on this page." },
  { q: "How should I store it?", a: "Store it in a cool, dry place, out of direct sunlight and out of reach of children." },
  { q: "Can I use it with other products?", a: "If you take other supplements or medication, or have a medical condition, check with your physician first." },
  { q: "Where can I find the product information?", a: "Use the download button beside the product details to open the product information." },
  { q: "How long will an order take to arrive?", a: "Delivery times depend on the method you choose. Open Shipping & Returns Information on this page to see them." },
  { q: "Is it tested?", a: "Every batch is tested to the CPTG Certified Pure Tested Grade standard." },
];

const METAPWR = {
  slug: "metapwr-advantage",
  blurb: "Dietary supplement with Collagen + NMN, in Lemon-Orange flavor. Developed by dōTERRA researchers to support a healthy metabolism, keep you mentally energized, and to promote healthy weight and body composition.*",
  /** "Primary Benefits" on the product page. */
  things: [
    "May help sustain vigorous metabolic activity to promote youthful function of cells and organ systems.*",
    "Contains nine types of collagen tripeptides, that clinical research has shown to boost skin appearance by promoting skin density, increasing firmness, decreasing wrinkles, and improving hydration.*",
    "Includes vitamin C which promotes collagen biosynthesis.*",
    "Contains ingredients that promote a healthy circulatory system, nervous system, and mitochondria.*",
    "Supports the function of healthy bones*",
    "Formula includes NADH plus additional ingredients that help maintain healthy mental function, and physical function and performance*",
    "Preclinical research has shown to increase amounts of NAD+ and NADH in the body*",
  ],
  cautions: "Consult your physician before use if you're pregnant, nursing, have a medical condition, or take any medication. Keep out of reach of children. This product should only be used as a food supplement. Do not use for weight reduction.",
  /** The design's "Can be used" labels. They are not on the US product page. */
  usageTags: [{ label: "Energise", tone: 1 }, { label: "Body Care", tone: 2 }, { label: "Active", tone: 3 }, { label: "Seasons", tone: 4 }] as UsageTag[],
  description: [
    "As you age, so does your metabolic function. Your metabolism influences your energy, weight, body composition, and even cognitive performance. MetaPWR Advantage was developed by dōTERRA researchers to support a healthy metabolism, keep you mentally energized, and to promote healthy weight and body composition.* Combined with healthy lifestyle choices, taking MetaPWR Advantage once a day can help fortify your metabolic health.*",
    "Preclinical studies suggest metabolic health is bolstered by increasing NADH and NAD+ production in the body and activating the SIRT longevity genes. Advantage also contains nine types of collagen tripeptides from marine source, which may improve skin elasticity, density, and firmness.* The amino acids in the collagen may also support lean muscle and connective tissue, contributing to healthy weight and body composition.*",
    "MetaPWR Advantage is part of the MetaPWR Metabolic System, which supports a healthy lifestyle focused on energy and vitality, metabolic health, and weight management to add health to your lifespan.*",
    "Ingredients: marine collagen, liposomal vitamin C, sea buckthorn fruit extract, red orange fruit extract, hyaluronic acid, and Grapefruit, Lemon, Peppermint, Ginger and Cinnamon Bark essential oils. No GMOs, dairy, soy, gluten or preservatives, and no artificial sweeteners or flavors.",
  ],
  howTo: ["Take 1 sachet per day. Add contents of sachet to 5–8 ounces of cold or room temperature water. Stir or shake before drinking."],
  reviews: [
    { stars: 5, body: "Easy to fit into my morning. I stir a sachet into a glass of water and it mixes in quickly.", name: "Alicia M.", title: "Customer" },
    { stars: 4, body: "Each sachet is pre-measured, which makes it simple. A little pricey, but I take it every day.", name: "Daniel R.", title: "Customer" },
    { stars: 5, body: "The box arrived quickly and is easy to store. I take one sachet most mornings.", name: "Priya S.", title: "Customer" },
    { stars: 4, body: "Good packaging and simple to use. I would like a larger box option.", name: "Chris T.", title: "Customer" },
  ],
  faq: [
    { q: "How do I take MetaPWR Advantage?", a: "Take one sachet a day. Add the contents to 5 to 8 ounces of cold or room temperature water, then stir or shake before drinking." },
    { q: "How many sachets are in a box?", a: "Each box holds 30 sachets, which is a 30-day supply at one sachet a day." },
    { q: "What flavor is it?", a: "This box is Lemon-Orange flavor, with other natural flavors." },
    { q: "Can I take it with other supplements or medication?", a: "Consult your physician before use if you are pregnant, nursing, have a medical condition, or take any medication." },
    { q: "Is it suitable for weight loss?", a: "No. This product should only be used as a food supplement. Do not use for weight reduction." },
    { q: "Where can I find the product information?", a: "Use the download button beside the product details to open the product information." },
  ] as PdpFaq[],
  /** The recommended products, in the design's order, each with the slugs the dummy and live catalogues use; any other products in the catalogue follow. */
  related: [
    ["vmg", "vmg-redefines-the-daily-multivitamin"],
    ["eo-mega", "eo-mega-essential-oil-omega-complex"],
    ["pb-restore", "pb-restore-probiome-complex"],
    ["metapwr-starter-system", "metapwr-system-enrollment-collection"],
  ],
};

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
  const meta = key === METAPWR.slug;
  const isOil = product.category === "Essential Oils";
  const h = hash(key);
  const noReviews = NO_REVIEWS.has(key);
  const apps = product.applications.map((a) => APPLICATION_ICON[a]).filter(Boolean);
  const goals = product.goals.slice(0, 2).join(" and ").toLowerCase();
  const own = productImage(product);
  const preferred = meta ? METAPWR.related.map((keys) => allProducts().find((p) => keys.includes(slugify(p.name)))).filter((p): p is Product => !!p) : [];
  const related = [
    ...preferred,
    ...allProducts()
      .filter((p) => p.id !== product.id && p.inStock && !preferred.includes(p))
      .sort((a, b) => Number(b.category === product.category) - Number(a.category === product.category) || Number(b.status.includes("Best Sellers")) - Number(a.status.includes("Best Sellers"))),
  ].slice(0, 6);
  return {
    slug: key,
    name: product.name,
    product,
    sku: product.sku,
    size: productSize(product),
    retail: product.retail,
    account: product.wholesale,
    rating: product.rating > 0 ? product.rating : 4,
    reviewCount: noReviews ? 0 : meta || lavender ? 220 : 40 + (h % 360),
    bestSeller: !noReviews && product.status.includes("Best Sellers"),
    soldThisWeek: !noReviews && product.status.includes("Best Sellers"),
    images: meta ? METAPWR_GALLERY : [{ src: own, alt: product.name }, ...FILLERS.map((src, i) => ({ src, alt: `${product.name}, image ${i + 2}` }))],
    blurb: meta ? METAPWR.blurb : lavender ? LAVENDER.blurb : `A ${product.productType.toLowerCase()} from our ${product.category.toLowerCase()} range, popular with customers looking for ${goals || "everyday support"}.`,
    things: meta ? METAPWR.things : lavender ? LAVENDER.things : [...apps.map((a) => a.use), "Store in a cool, dry place.", "Keep out of reach of children."],
    cautions: meta ? METAPWR.cautions : lavender ? LAVENDER.cautions : "Keep out of reach of children. If you are pregnant, nursing or under a doctor’s care, consult your physician before use. Avoid contact with eyes and sensitive areas.",
    usage: meta ? [] : lavender ? LAVENDER.usage : apps.map((a) => a.icon),
    usageTags: meta ? METAPWR.usageTags : undefined,
    description: meta ? METAPWR.description : lavender ? LAVENDER.description : product.description ? [product.description] : [`${product.name} is part of our ${product.category} range and is made to be part of a daily routine.`, "Every batch is tested to the CPTG Certified Pure Tested Grade® standard."],
    howTo: meta ? METAPWR.howTo : lavender ? LAVENDER.howTo : apps.length ? apps.map((a) => a.how) : ["Follow the directions on the label."],
    reviews: noReviews ? [] : meta ? METAPWR.reviews : lavender ? LAVENDER.reviews : REVIEW_NAMES.map((name, i) => ({ stars: i % 2 ? 4 : 5, body: i % 2 ? `A solid choice. ${product.name} does what I wanted and I will order it again.` : `I use ${product.name} most days and it has become part of my routine.`, name, title: "Customer" })),
    faq: meta ? METAPWR.faq : isOil ? OIL_FAQ : GENERAL_FAQ,
    related,
  };
}
