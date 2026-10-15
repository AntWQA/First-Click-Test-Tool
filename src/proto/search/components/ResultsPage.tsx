import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Drawer, EmptyState, Flex, Grid, Pagination, Stack, Tabs, Text, utilClassNames } from "@doterra-it/design-system-ui-base";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { PageBreadcrumbs } from "../../components/PageBreadcrumbs";
import { SECTION_LABEL_STYLE } from "../../components/sectionLabel";
import { PageShell } from "../../pages/StubPage";
import { browseCategories, pageSizes, popularSearches, sortOptions } from "../content";
import { search } from "../service/searchService";
import { activeFilterCount, useSearchState } from "../state";
import { useAsync } from "../useAsync";
import { useSearch } from "../SearchProvider";
import type { ResultTab, SearchResponse, SortKey } from "../types";
import { FacetPanel } from "./FacetPanel";
import { SortMenu } from "./SortMenu";
import { BlogResults, OtherResults, ProductGrid, ResultsSkeleton } from "./ResultCards";

const T = "var(--time-transition-base)";
/** Collapsing sidebar: width, margin and opacity animate; visibility flips after the collapse so hidden facets cannot take focus. */
const sidebarStyle = (shown: boolean, reduceMotion: boolean) => ({
  flex: "0 0 auto",
  width: shown ? "25%" : 0,
  marginRight: shown ? "var(--spacing-7)" : 0,
  opacity: shown ? 1 : 0,
  overflow: "hidden",
  visibility: shown ? ("visible" as const) : ("hidden" as const),
  transition: reduceMotion ? "none" : `width ${T} ease, margin-right ${T} ease, opacity ${T} ease, visibility 0s linear ${shown ? "0s" : T}`,
});

const tabLabel: Record<ResultTab, string> = { products: "Products", blog: "Blog", other: "Other" };

function ZeroResults({ query, filtered, onClear, onSearch }: { query: string; filtered: boolean; onClear: () => void; onSearch: (q: string) => void }) {
  return (
    <EmptyState
      icon="search-md"
      title={filtered ? "No results match these filters" : `No results for "${query}"`}
      description={filtered ? "Try removing a filter or two to see more." : "Check the spelling, try a more general term, or browse the catalogue."}
    >
      <Stack spacing="lg" align="center" data-testid="zero-results">
        {filtered && <Button variant="primary" onClick={onClear} data-testid="zero-clear-filters">Clear all filters</Button>}
        <Stack spacing="sm" align="center">
          <Text size="textXs" weight="semiBold" color="text-subtle" style={SECTION_LABEL_STYLE}>POPULAR THIS WEEK</Text>
          <Flex wrap justify="center" spacing="sm">
            {popularSearches.map((t) => <Button key={t} variant="tertiary" size="medium" icon="trend-up-01" onClick={() => onSearch(t)}>{t}</Button>)}
          </Flex>
        </Stack>
        <Stack spacing="xs" align="center">
          {browseCategories.slice(0, 4).map((c) => <Button key={c.href} as={RouterLink} to={c.href} variant="link-primary" size="small">{c.label}</Button>)}
        </Stack>
      </Stack>
    </EmptyState>
  );
}

/**
 * Search results page. The URL holds all state (query, tab, sort, page, page size, filters), so every designed state
 * (direct URL entry, filters applied, page 2, blog and other tabs) is reachable by link.
 */
export function ResultsPage() {
  const { pathname } = useLocation();
  const { params, update } = useSearchState();
  const { open: searchOpen, setOpen: setSearchOpen, setQuery: setSearchQuery } = useSearch();
  const paramsRef = useRef(params);
  paramsRef.current = params;
  /** The query that was showing when the chip button opened the overlay; null when the overlay was opened any other way. */
  const newSearchFrom = useRef<string | null>(null);
  const key = JSON.stringify(params);
  const { state, retry } = useAsync<SearchResponse>(() => search(params), key, true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersShown, setFiltersShown] = useState(true);
  const reduceMotion = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  const data = state.data;
  const loading = state.status === "loading";
  const filterCount = activeFilterCount(params);
  const hasQuery = params.q.trim().length > 0;

  useEffect(() => { document.title = hasQuery ? `Search results for ${params.q}` : "All Products"; }, [hasQuery, params.q]);

  // Closing the overlay opened by the chip button, without running a new search, restores the All Products state (no query, no filters).
  useEffect(() => {
    if (searchOpen || newSearchFrom.current === null) return;
    const from = newSearchFrom.current;
    newSearchFrom.current = null;
    const t = window.setTimeout(() => {
      if (paramsRef.current.q === from) update({ q: "", filters: {}, priceMin: undefined, priceMax: undefined });
    }, 0);
    return () => window.clearTimeout(t);
  }, [searchOpen, update]);

  const noHits = !loading && !!data && data.total === 0 && filterCount === 0;
  const onlyProducts = useMemo(() => !!data && data.counts.blog === 0 && data.counts.other === 0, [data]);
  const total = data?.counts.products ?? 0;
  const shownFrom = data && data.total > 0 ? (params.page - 1) * params.pageSize + 1 : 0;
  const shownTo = data ? Math.min(params.page * params.pageSize, data.total) : 0;

  const runSearch = (q: string) => { update({ q, tab: "products", filters: {}, priceMin: undefined, priceMax: undefined }); window.scrollTo({ top: 0 }); };

  const header = !hasQuery ? (
    <Text as="h1" size="displayLg" weight="semiBold" data-testid="results-query">All Products</Text>
  ) : (
    <Stack spacing="sm" align="start">
      <Text size="textXs" weight="semiBold" color="text-subtle" style={SECTION_LABEL_STYLE}>SEARCH RESULTS FOR</Text>
      {/* Chip from Figma (2399:6610): gray-50 fill, 8px radius, 4px / 12px padding (py-2; the 32px close button sets the content height, so the chip is 40px against Figma 36 to 37), text 20px on mobile and 24px on desktop (displayXs below lg, displaySm from lg), tertiary xs icon-only close button */}
      <Box backgroundColor="base.gray.50" radius="md" className={utilClassNames("py-2", "px-4", "mb-6")}>
        <Flex align="center" spacing="sm">
          <Text as="h1" size={{ xs: "displayXs", lg: "displaySm" }} weight="semiBold" data-testid="results-query">{hasQuery ? data?.query ?? params.q : "Search"}</Text>
          {hasQuery && <Button variant="tertiary" size="xsmall" icon="x-close" iconOnly aria-label="Start a new search" onClick={() => { newSearchFrom.current = params.q; setSearchQuery(""); setSearchOpen(true); }} data-testid="clear-query">New search</Button>}
        </Flex>
      </Box>
      {data?.correctedFrom && (
        <Text data-testid="did-you-mean">Did you mean <strong>{data.query}</strong>? Showing close matches for "{data.query}" instead of "{data.correctedFrom}".</Text>
      )}
    </Stack>
  );

  const failed = state.status === "failed";

  return (
    <PageShell footerSpacer={false}>
      {/* The same view serves /shop (All Products, the Shop page) and /search */}
      <PageBreadcrumbs crumbs={[{ label: "Home", to: "/" }, pathname === "/shop" ? { label: "Shop", to: "/shop" } : { label: "Search", to: "/search" }]} />
      {header}

      {failed && (
        <Alert level={state.kind === "offline" ? "warning" : "error"} data-testid={`search-${state.kind}`}>
          <Flex align="center" justify="space-between" spacing="md" wrap>
            <Text>{state.kind === "offline" ? "You appear to be offline. Check your connection and try again." : "Something went wrong while searching. Please try again."}</Text>
            <Button variant="secondary" size="small" onClick={retry} data-testid="search-retry">Try again</Button>
          </Flex>
        </Alert>
      )}

      {!failed && !onlyProducts && (
        <Tabs id="search-result-tabs" variant="buttons" activeTab={params.tab} onChange={(t) => update({ tab: t as ResultTab, page: 1 })}>
          <Tabs.List>
            {(Object.keys(tabLabel) as ResultTab[]).map((t) => (
              <Tabs.Tab key={t} tabId={t} data-testid={`tab-${t}`}>{tabLabel[t]} ({data?.counts[t] ?? 0})</Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      )}

      {/* Count and filter and sort controls sit in one full-width row directly under the query pill, above the sidebar and results. */}
      {!failed && !noHits && (
        <Flex justify="space-between" align="center" wrap spacing="md">
          <Text size="displayXs" weight="normal" color="text-subtle" data-testid="results-count">{data ? `${data.counts[params.tab]} ${data.counts[params.tab] === 1 ? "Result" : "Results"}` : ""}</Text>
          {params.tab === "products" && (
            <Flex align="center" justify="end" spacing="sm">
              <div className={utilClassNames("lg:hidden")}>
                <Button variant="tertiary" size="medium" icon="sliders-04" iconPosition="right" onClick={() => setFiltersOpen(true)} data-testid="open-filters">Filters{filterCount ? ` (${filterCount})` : ""}</Button>
              </div>
              <div className={utilClassNames("hidden", "lg:display-block")}>
                <Button variant="tertiary" size="medium" icon="sliders-04" iconPosition="right" onClick={() => setFiltersShown((v) => !v)} aria-expanded={filtersShown} data-testid="toggle-filters">{filtersShown ? "Hide Filters" : "Show Filters"}</Button>
              </div>
              {/* Sort recipe at every width (trigger shows the selected option, popover lists option buttons). */}
              <SortMenu options={sortOptions} value={params.sort} onChange={(next) => update({ sort: next as SortKey })} />
            </Flex>
          )}
        </Flex>
      )}

      {!failed && (
        <Flex direction={{ xs: "column", lg: "row" }} spacing={{ xs: "md", lg: 0 }} align="start">
          {params.tab === "products" && !noHits && (
            // Inline-style transition (strict-mode exception, approved 7 Oct 2026, register PS-27 (proposed)): Pure has no width collapse or transition utilities.
            // Timing uses Pure's --time-transition-base token; reduced motion gets no transition. Hidden state is removed from the tab order and accessibility tree.
            <div className={utilClassNames("hidden", "lg:display-block")} style={sidebarStyle(filtersShown, reduceMotion)} aria-hidden={!filtersShown}>
              <div style={{ minWidth: "15rem" }}>
                <FacetPanel facets={data?.facets ?? []} params={params} onChange={update} openByDefault={["Wellness goal"]} />
              </div>
            </div>
          )}
          <Flex.Child flex={1} style={{ minWidth: 0 }}>
            <Stack spacing="lg" align="stretch">

              {loading && <ResultsSkeleton />}
              {!loading && data && data.total === 0 && <ZeroResults query={params.q} filtered={filterCount > 0 && params.tab === "products"} onClear={() => update({ filters: {}, priceMin: undefined, priceMax: undefined })} onSearch={runSearch} />}
              {!loading && data && data.total > 0 && params.tab === "products" && <ProductGrid products={data.products} />}
              {!loading && data && data.total > 0 && params.tab === "blog" && <BlogResults articles={data.articles} />}
              {!loading && data && data.total > 0 && params.tab === "other" && <OtherResults articles={data.articles} />}

              {!loading && data && data.total > 0 && data.totalPages > 1 && (
                <Flex justify="center" align="center" spacing="md" wrap>
                  <Pagination key={`${key}-${data.totalPages}`} initialPage={params.page} totalPages={data.totalPages} rangeSize={5} withControlLabels onChange={(p) => { update({ page: p }); window.scrollTo({ top: 0 }); }}>
                    <Pagination.Button label="Prev" buttonType="previous" />
                    <Pagination.List />
                    <Pagination.Button label="Next" buttonType="next" />
                  </Pagination>
                </Flex>
              )}
              {!loading && data && data.total > 0 && params.tab === "products" && (
                <Flex justify="center"><Pagination.Select value={params.pageSize} options={pageSizes.map((n) => ({ text: String(n), value: n }))} onSelectChange={(e) => update({ pageSize: Number((e.target as HTMLSelectElement).value) })} /></Flex>
              )}

              {!loading && data && data.total > 0 && (
                <Stack spacing="sm" align="start" data-testid="related-searches">
                  <Text size="textXs" weight="semiBold" color="text-subtle" style={SECTION_LABEL_STYLE}>RELATED SEARCHES</Text>
                  <Flex wrap spacing="sm">
                    {data.related.map((t) => <Button key={t} variant="tertiary" size="medium" icon="trend-up-01" onClick={() => runSearch(t)}>{t}</Button>)}
                  </Flex>
                </Stack>
              )}
            </Stack>
          </Flex.Child>
        </Flex>
      )}

      <Drawer position="bottom" size="full" state={[filtersOpen, setFiltersOpen]} withCloseButton aria-label="Filters">
        {/* Pure's Drawer panel does not scroll its own content (PC-42), so this wrapper is the scroll container. h-screen, not h-full: the drawer resolves to height:auto, so a percentage height would grow with the content. */}
        <Box className={utilClassNames("h-screen", "overflow-y-auto")}>
          <Drawer.Body>
            <Stack spacing="lg" align="stretch">
              <Drawer.Title>Filters</Drawer.Title>
              <FacetPanel facets={data?.facets ?? []} params={params} onChange={update} openByDefault={["Wellness goal"]} />
              <Button variant="primary" fullWidth onClick={() => setFiltersOpen(false)} data-testid="apply-filters">Show {total} {total === 1 ? "result" : "results"}</Button>
            </Stack>
          </Drawer.Body>
        </Box>
      </Drawer>
    </PageShell>
  );
}
