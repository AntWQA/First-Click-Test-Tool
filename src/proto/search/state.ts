import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { facetOrder } from "./service/searchService";
import { pageSizes } from "./content";
import type { FacetKey, ResultTab, SearchParams, SortKey } from "./types";

const tabs: ResultTab[] = ["products", "blog", "other"];
const sorts: SortKey[] = ["relevance", "rating", "price-asc", "price-desc", "name"];

/** The URL is the single source of truth for the results page: q, tab, sort, page, view, pmin, pmax and one key per facet. */
export function useSearchState() {
  const [sp, setSp] = useSearchParams();

  const params: SearchParams = useMemo(() => {
    const tab = sp.get("tab") as ResultTab;
    const sort = sp.get("sort") as SortKey;
    const view = Number(sp.get("view"));
    const filters: SearchParams["filters"] = {};
    for (const key of facetOrder) { const v = sp.getAll(key); if (v.length) filters[key] = v; }
    const pmin = sp.get("pmin"), pmax = sp.get("pmax");
    return {
      q: sp.get("q") ?? "",
      tab: tabs.includes(tab) ? tab : "products",
      sort: sorts.includes(sort) ? sort : "relevance",
      page: Math.max(1, Number(sp.get("page")) || 1),
      pageSize: (pageSizes as readonly number[]).includes(view) ? view : pageSizes[0],
      filters,
      priceMin: pmin ? Number(pmin) : undefined,
      priceMax: pmax ? Number(pmax) : undefined,
    };
  }, [sp]);

  /** Apply a change. Any change except `page` resets to page 1. */
  const update = useCallback((patch: Partial<SearchParams>, opts?: { replace?: boolean }) => {
    const next = { ...params, ...patch };
    if (!("page" in patch)) next.page = 1;
    const out = new URLSearchParams();
    if (next.q) out.set("q", next.q);
    if (next.tab !== "products") out.set("tab", next.tab);
    if (next.sort !== "relevance") out.set("sort", next.sort);
    if (next.page > 1) out.set("page", String(next.page));
    if (next.pageSize !== pageSizes[0]) out.set("view", String(next.pageSize));
    for (const key of facetOrder) for (const v of next.filters[key] ?? []) out.append(key, v);
    if (next.priceMin !== undefined) out.set("pmin", String(next.priceMin));
    if (next.priceMax !== undefined) out.set("pmax", String(next.priceMax));
    setSp(out, opts);
  }, [params, setSp]);

  return { params, update };
}

export const activeFilterCount = (p: SearchParams) =>
  (Object.values(p.filters) as string[][]).reduce((n, v) => n + (v?.length ?? 0), 0) + (p.priceMin !== undefined || p.priceMax !== undefined ? 1 : 0);

export const emptyFilters: Partial<Record<FacetKey, string[]>> = {};
