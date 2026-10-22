/**
 * Homepage imagery, from the design's "Prod (CF-h)" folder. Resized and saved as WebP (about 390 KB in all) so the
 * single-file build stays inside its size budget; duplicates in the design (the same photo under several names) are
 * kept once. The test file may be opened in Chrome or Edge only, which both read WebP.
 */
import campaignAbode from "./images/campaign-abode.webp";
import campaignDeepBlue from "./images/campaign-deep-blue.webp";
import campaignOnGuard from "./images/campaign-on-guard.webp";
import catSkin from "./images/cat-skin.webp";
import catWellness from "./images/cat-wellness.webp";
import credibility from "./images/credibility.webp";
import hero from "./images/hero.webp";
import newsletter from "./images/newsletter.webp";
import productDeepBlueRub from "./images/product-deep-blue-rub.webp";
import productFrankincense from "./images/product-frankincense.webp";
import productLavender from "./images/product-lavender.webp";
import productOnGuard from "./images/product-on-guard.webp";
import productYlangYlang from "./images/product-ylang-ylang.webp";

export const homeImages = {
  hero,
  newsletter,
  credibility,
  valueOils: campaignDeepBlue,
  valueSourcing: campaignOnGuard,
  valueTesting: campaignAbode,
  campaignDeepBlue,
  campaignOnGuard,
  campaignAbode,
  catWellness,
  catEssentialOils: campaignOnGuard,
  catBlends: hero,
  catSkin,
  catSport: campaignDeepBlue,
  catHome: campaignAbode,
  catDiffusers: newsletter,
  productLavender,
  productOnGuard,
  productFrankincense,
  productDeepBlueRub,
  productYlangYlang,
} as const;
