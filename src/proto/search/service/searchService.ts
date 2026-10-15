import mockCatalogue from "../data/catalogue.json";
import { liveCatalogue } from "../data/liveCatalogue";
import { popularSearches } from "../content";
import { slugify } from "../format";
import {
  SearchError,
  type Article, type FacetGroup, type FacetKey, type Product, type ResultTab,
  type SearchParams, type SearchResponse, type SuggestResponse, type Suggestion,
} from "../types";

/*
 * Mock search service. Same request and response shape an Algolia adapter would return, so engineering can replace
 * this module without touching the UI. Everything is in memory over the dummy catalogue.
 *
 * Scenario words (the whole query): "error" fails, "offline" simulates no connection, "slow" takes 2.5 s,
 * "oos" returns the out of stock products. Any query with no match (for example "zzz") returns zero results.
 */

const catalogue = liveCatalogue ?? mockCatalogue;
const products = catalogue.products as unknown as Product[];
const articles = catalogue.articles as unknown as Article[];

/** Product behind a /shop/products/:slug route (the slug is the slugified name, see format.ts). */
export const findProductBySlug = (slug: string): Product | undefined => products.find((p) => slugify(p.name) === slug);

let latency = { suggest: 200, search: 450 };
/** Tests and stories set this to 0. */
export const setLatency = (next: Partial<typeof latency>) => { latency = { ...latency, ...next }; };
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const normalise = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s+-]/g, " ").replace(/[-+]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string) => normalise(s).split(" ").filter(Boolean);

const productWords = (p: Product) => tokens([p.name, p.keywords, p.category, p.productType, p.collection ?? "", p.goals.join(" ")].join(" "));
const articleWords = (a: Article) => tokens([a.title, a.keywords, a.category, a.type, a.excerpt].join(" "));

const wordCache = new Map<string, string[]>();
const wordsOf = (id: string, build: () => string[]) => { let w = wordCache.get(id); if (!w) { w = build(); wordCache.set(id, w); } return w; };

const vocabulary = Array.from(new Set([
  ...products.flatMap((p) => tokens(p.name + " " + p.keywords + " " + p.category)),
  ...articles.flatMap((a) => tokens(a.title + " " + a.keywords)),
])).filter((w) => w.length >= 4);

function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/** Returns a corrected query if any token has no prefix match but a close vocabulary word, otherwise null. */
function correct(q: string): string | null {
  const parts = tokens(q);
  let changed = false;
  const fixed = parts.map((t) => {
    if (t.length < 4 || vocabulary.some((w) => w.startsWith(t))) return t;
    const best = vocabulary.map((w) => ({ w, d: distance(t, w) })).filter((x) => x.d <= 2).sort((a, b) => a.d - b.d)[0];
    if (best) { changed = true; return best.w; }
    return t;
  });
  return changed ? fixed.join(" ") : null;
}

function score(words: string[], titleWords: string[], qTokens: string[]): number {
  let s = 0;
  for (const t of qTokens) {
    const inTitle = titleWords.some((w) => w === t) ? 6 : titleWords.some((w) => w.startsWith(t)) ? 4 : 0;
    const inAny = words.some((w) => w === t) ? 2 : words.some((w) => w.startsWith(t)) ? 1 : -1000;
    s += inTitle + inAny;
  }
  return s;
}

const matchProducts = (qTokens: string[]) => qTokens.length === 0 ? products.map((p) => ({ p, s: 0 })) : products
  .map((p) => ({ p, s: score(wordsOf(p.id, () => productWords(p)), tokens(p.name), qTokens) + (p.status.includes("Best Sellers") ? 0.5 : 0) }))
  .filter((x) => x.s > 0);
const matchArticles = (qTokens: string[], kind: "blog" | "other") => articles
  .filter((a) => a.kind === kind)
  .map((a) => ({ a, s: score(wordsOf(a.id, () => articleWords(a)), tokens(a.title), qTokens) }))
  .filter((x) => qTokens.length > 0 && x.s > 0);

const facetTitles: Record<FacetKey, string> = {
  goals: "Wellness goal", availability: "Availability", rating: "Rating", category: "Category",
  productType: "Product type", collection: "Collection", applications: "Applications", status: "Status",
};
export const facetOrder: FacetKey[] = ["goals", "availability", "rating", "category", "productType", "collection", "applications", "status"];

const valuesFor = (p: Product, key: FacetKey): string[] => {
  switch (key) {
    case "goals": return p.goals;
    case "availability": return p.inStock ? ["in-stock"] : [];
    case "rating": return [2, 3, 4, 5].filter((n) => p.rating >= n).map(String);
    case "category": return [p.category];
    case "productType": return [p.productType];
    case "collection": return p.collection ? [p.collection] : [];
    case "applications": return p.applications;
    case "status": return p.status;
  }
};
const labelFor = (key: FacetKey, value: string) => key === "availability" ? "In stock only" : key === "rating" ? `${value}+ stars` : value;

function passes(p: Product, params: SearchParams, skip?: FacetKey): boolean {
  for (const key of facetOrder) {
    if (key === skip) continue;
    const chosen = params.filters[key];
    if (chosen && chosen.length > 0 && !chosen.some((v) => valuesFor(p, key).includes(v))) return false;
  }
  if (params.priceMin !== undefined && p.retail < params.priceMin) return false;
  if (params.priceMax !== undefined && p.retail > params.priceMax) return false;
  return true;
}

function buildFacets(matched: Product[], params: SearchParams): FacetGroup[] {
  return facetOrder.map((key) => {
    const pool = matched.filter((p) => passes(p, params, key));
    const counts = new Map<string, number>();
    for (const p of pool) for (const v of valuesFor(p, key)) counts.set(v, (counts.get(v) ?? 0) + 1);
    // keep selected values visible even when their count drops to zero
    for (const v of params.filters[key] ?? []) if (!counts.has(v)) counts.set(v, 0);
    const options = Array.from(counts.entries())
      .map(([value, count]) => ({ value, label: labelFor(key, value), count }))
      .sort((a, b) => key === "rating" ? Number(b.value) - Number(a.value) : b.count - a.count || a.label.localeCompare(b.label));
    return { key, title: facetTitles[key], options };
  }).filter((g) => g.options.length > 0);
}

const sorters: Record<string, (a: { p: Product; s: number }, b: { p: Product; s: number }) => number> = {
  relevance: (a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name),
  rating: (a, b) => b.p.rating - a.p.rating || b.s - a.s || a.p.name.localeCompare(b.p.name),
  "price-asc": (a, b) => a.p.retail - b.p.retail,
  "price-desc": (a, b) => b.p.retail - a.p.retail,
  name: (a, b) => a.p.name.localeCompare(b.p.name),
};

const related = (q: string): string[] => {
  const t = tokens(q);
  const pool = ["essential oil gift set", "diffuser starter kit", "sleep collection", "immunity blend", "lavender roller", "peppermint touch"];
  return pool.filter((r) => !t.some((w) => tokens(r).includes(w))).slice(0, 4).concat(popularSearches).slice(0, 4);
};

async function scenario(raw: string, ms: number): Promise<string> {
  const word = normalise(raw);
  if (word === "error") { await wait(ms); throw new SearchError("error"); }
  if (word === "offline") { await wait(ms); throw new SearchError("offline"); }
  if (word === "slow") { await wait(2500); return "lavender"; }
  await wait(ms);
  return raw;
}

export async function search(params: SearchParams): Promise<SearchResponse> {
  let q = await scenario(params.q, latency.search);
  const oos = normalise(q) === "oos";
  let qTokens = oos ? [] : tokens(q);
  let correctedFrom: string | undefined;

  let matched = oos ? products.filter((p) => !p.inStock).map((p) => ({ p, s: 0 })) : matchProducts(qTokens);
  let blog = matchArticles(qTokens, "blog");
  let other = matchArticles(qTokens, "other");
  if (!oos && matched.length + blog.length + other.length === 0) {
    const fixed = correct(q);
    if (fixed) {
      correctedFrom = q; q = fixed; qTokens = tokens(fixed);
      matched = matchProducts(qTokens); blog = matchArticles(qTokens, "blog"); other = matchArticles(qTokens, "other");
    }
  }

  const filtered = matched.filter((x) => passes(x.p, params));
  const counts: Record<ResultTab, number> = { products: filtered.length, blog: blog.length, other: other.length };
  const list = params.tab === "products" ? filtered.slice().sort(sorters[params.sort] ?? sorters.relevance) : params.tab === "blog" ? blog : other;
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(Math.max(1, params.page), totalPages);
  const slice = list.slice((page - 1) * params.pageSize, page * params.pageSize);

  return {
    query: q,
    correctedFrom,
    counts,
    products: params.tab === "products" ? (slice as { p: Product }[]).map((x) => x.p) : [],
    articles: params.tab === "products" ? [] : (slice as { a: Article }[]).map((x) => x.a),
    total,
    totalPages,
    facets: buildFacets(matched.map((x) => x.p), params),
    related: related(q),
  };
}

const phrases = [...products.map((p) => ({ text: p.name, label: p.suggestionLabel })), ...Array.from(new Set(products.map((p) => p.collection).filter(Boolean) as string[])).map((c) => ({ text: c, label: "Collection" })), ...popularSearches.map((t) => ({ text: t, label: undefined as string | undefined }))];

export async function suggest(raw: string): Promise<SuggestResponse> {
  const q = await scenario(raw, latency.suggest);
  let qTokens = tokens(q);
  let fixed: string | null = null;
  let matched = matchProducts(qTokens);
  if (matched.length === 0) { fixed = correct(q); if (fixed) { qTokens = tokens(fixed); matched = matchProducts(qTokens); } }
  const blog = matchArticles(qTokens, "blog");
  const other = matchArticles(qTokens, "other");

  const suggestions: Suggestion[] = phrases
    .filter((ph) => qTokens.every((t) => tokens(ph.text).some((w) => w.startsWith(t))))
    .slice(0, 4);
  if (fixed && suggestions.length < 4) suggestions.unshift({ text: `${q.trim()} - Did you mean ${fixed}?`, value: fixed });

  return {
    query: q,
    suggestions: suggestions.slice(0, 4),
    products: matched.sort(sorters.relevance).slice(0, 5).map((x) => x.p),
    articles: { blog: blog.slice(0, 4).map((x) => x.a), other: other.slice(0, 4).map((x) => x.a) },
    counts: { products: matched.length, blog: blog.length, other: other.length },
  };
}
