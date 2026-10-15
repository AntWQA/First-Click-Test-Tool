import { Box, Button, Flex, Text, utilClassNames } from "@doterra-it/design-system-ui-base";
import { SearchResultsFilterV2 } from "@doterra-it/design-system-ui-ecommerce";
import { priceBands } from "../content";
import type { FacetGroup, SearchParams } from "../types";

interface Props {
  facets: FacetGroup[];
  params: SearchParams;
  onChange: (patch: Partial<SearchParams>) => void;
  /** Titles of sections to open on first render. */
  openByDefault?: string[];
}

/** Pure leaves 12px between a section header and its list; the first option carries extra top padding for more room (Figma review, 7 Oct 2026); pt-6 is spacing-6, 24px. */
const firstRowClass = (i: number) => (i === 0 ? utilClassNames("pt-6") : undefined);

const bandFor = (p: SearchParams) => priceBands.find((b) => b.min === p.priceMin && b.max === p.priceMax)?.label ?? "";

/**
 * Facet sidebar (desktop) and body of the filter drawer (mobile, tablet). One Pure SearchResultsFilterV2 section per
 * facet group, plus a price range section built from bands (Pure has no min and max input pattern, PS-10).
 */
export function FacetPanel({ facets, params, onChange, openByDefault = [] }: Props) {
  const hasFilters = Object.values(params.filters).some((v) => v && v.length) || params.priceMin !== undefined || params.priceMax !== undefined;
  return (
    <Flex direction="column" spacing="md" align="stretch">
      {hasFilters && (
        <Flex justify="space-between" align="center">
          <Text size="textSm" color="text-subtle">Filters applied</Text>
          <Button variant="link-primary" size="small" onClick={() => onChange({ filters: {}, priceMin: undefined, priceMax: undefined })} data-testid="clear-filters">Clear all</Button>
        </Flex>
      )}
      <SearchResultsFilterV2 title="Filter results">
        {facets.slice(0, 1).map((g) => (
          <SearchResultsFilterV2.Section key={g.key} title={g.title} defaultOpen={openByDefault.includes(g.title)} value={params.filters[g.key] ?? []} onChange={(next) => onChange({ filters: { ...params.filters, [g.key]: next as string[] } })}>
            {g.options.map((o, i) => <SearchResultsFilterV2.Option key={o.value} value={o.value} label={o.label} count={o.count} className={firstRowClass(i)} />)}
          </SearchResultsFilterV2.Section>
        ))}
        <SearchResultsFilterV2.Section
          title="Price range"
          selectionMode="single"
          name="price-range"
          value={bandFor(params) || []}
          onChange={(next) => {
            const band = priceBands.find((b) => b.label === next);
            onChange({ priceMin: band?.min, priceMax: band?.max });
          }}
        >
          {priceBands.map((b, i) => <SearchResultsFilterV2.Option key={b.label} value={b.label} label={b.label} className={firstRowClass(i)} />)}
        </SearchResultsFilterV2.Section>
        {facets.slice(1).map((g) => (
          <SearchResultsFilterV2.Section key={g.key} title={g.title} defaultOpen={openByDefault.includes(g.title)} value={params.filters[g.key] ?? []} onChange={(next) => onChange({ filters: { ...params.filters, [g.key]: next as string[] } })}>
            {g.options.map((o, i) => <SearchResultsFilterV2.Option key={o.value} value={o.value} label={o.label} count={o.count} className={firstRowClass(i)} />)}
          </SearchResultsFilterV2.Section>
        ))}
      </SearchResultsFilterV2>
      {facets.length === 0 && <Box><Text size="textSm" color="text-subtle">No filters for this search.</Text></Box>}
    </Flex>
  );
}
