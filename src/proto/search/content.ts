import mockCatalogue from "./data/catalogue.json";
import { liveCatalogue } from "./data/liveCatalogue";
import type { Article, Product } from "./types";

const catalogue = liveCatalogue ?? mockCatalogue;

/** Static dummy content for the search demo (popular chips, browse links, default recent searches). */
export const popularSearches = ["essential oil gift set", "diffuser starter kit", "sleep collection", "immunity blend"];

export const browseCategories: { label: string; href: string }[] = [
  { label: "Essential Oils", href: "/shop/essential-oils" },
  { label: "Personal Care", href: "/shop/personal-care" },
  { label: "Supplements", href: "/shop/supplements" },
  { label: "Accessories & Diffusers", href: "/shop/accessories" },
  { label: "Latest Products", href: "/shop/new-products" },
  { label: "Special Offers", href: "/shop/limited-time-offers" },
];

export const defaultRecentSearches = ["lavender roller", "Peppermint", "Sleep blend", "diffuser"];

export const priceBands: { label: string; min?: number; max?: number }[] = [
  { label: "Under $30", max: 29.99 },
  { label: "$30 to $60", min: 30, max: 60 },
  { label: "$60 to $100", min: 60, max: 100 },
  { label: "$100 to $150", min: 100, max: 150 },
  { label: "Over $150", min: 150.01 },
];

const allSortOptions = [
  { value: "relevance", label: "Relevance" },
  { value: "rating", label: "Rating" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A to Z" },
] as const;

/** The live storefront publishes no ratings, so the Rating sort (and the Rating filter, which drops out when no product has one) only appear with the dummy catalogue. */
export const sortOptions = liveCatalogue ? allSortOptions.filter((o) => o.value !== "rating") : allSortOptions;

export const pageSizes = [16, 32, 48] as const;

/** Popular content shown in the empty-focus typeahead (Popular products panel, one list per tab). */
export const popularProducts = (catalogue.products as Product[]).filter((p) => p.status.includes("Best Sellers")).slice(0, 5);
export const popularBlog = (catalogue.articles as Article[]).filter((a) => a.kind === "blog").slice(0, 4);
export const popularOther = (catalogue.articles as Article[]).filter((a) => a.kind === "other").slice(0, 4);
