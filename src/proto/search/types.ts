export type ResultTab = "products" | "blog" | "other";
export type SortKey = "relevance" | "rating" | "price-asc" | "price-desc" | "name";

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  productType: string;
  collection: string | null;
  goals: string[];
  applications: string[];
  retail: number;
  wholesale: number;
  rating: number;
  inStock: boolean;
  status: string[];
  keywords: string;
  image: string;
  suggestionLabel: string;
}

export interface Article {
  id: string;
  kind: "blog" | "other";
  title: string;
  excerpt: string;
  /** Content type tag: Article, Recipe, Page, Support, Legal */
  type: string;
  category: string;
  date: string | null;
  image: string | null;
  keywords: string;
  href: string;
}

export type FacetKey = "goals" | "availability" | "rating" | "category" | "productType" | "collection" | "applications" | "status";

export interface FacetOption { value: string; label: string; count: number }
export interface FacetGroup { key: FacetKey; title: string; options: FacetOption[] }

export interface SearchParams {
  q: string;
  tab: ResultTab;
  sort: SortKey;
  page: number;
  pageSize: number;
  filters: Partial<Record<FacetKey, string[]>>;
  priceMin?: number;
  priceMax?: number;
}

export interface SearchResponse {
  /** The query actually searched (differs from the request when auto-corrected) */
  query: string;
  correctedFrom?: string;
  counts: Record<ResultTab, number>;
  products: Product[];
  articles: Article[];
  total: number;
  totalPages: number;
  facets: FacetGroup[];
  related: string[];
}

export interface Suggestion { text: string; label?: string; /** Where picking the suggestion goes, when it is a product: its page. Otherwise picking it runs a search. */ href?: string; /** What to search when picked, if different from the text (for example a correction) */ value?: string }
export interface SuggestResponse {
  query: string;
  suggestions: Suggestion[];
  products: Product[];
  articles: { blog: Article[]; other: Article[] };
  counts: Record<ResultTab, number>;
}

export type SearchFailure = "error" | "offline";
export class SearchError extends Error {
  constructor(public kind: SearchFailure) { super(kind); }
}
