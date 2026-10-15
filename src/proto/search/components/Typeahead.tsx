import { useState } from "react";
import { Alert, Box, Button, ButtonGroup, Divider, EmptyState, Flex, Grid, Icon, IconButton, Image, Link, Skeleton, Stack, Text } from "@doterra-it/design-system-ui-base";
import { Link as RouterLink } from "react-router-dom";
import { SECTION_LABEL_STYLE } from "../../components/sectionLabel";
import { browseCategories, popularBlog, popularOther, popularProducts, popularSearches } from "../content";
import { money, slugify } from "../format";
import { imageFor } from "../images";
import { suggest } from "../service/searchService";
import type { Product, ResultTab, SuggestResponse } from "../types";
import { useAsync } from "../useAsync";
import { useDebounced } from "../useDebounced";
import { ContentResultList } from "./ResultCards";
import { SpaLinks } from "./SpaLinks";

interface Props {
  query: string;
  recent: string[];
  onPick: (q: string) => void;
  onSubmit: (q: string) => void;
  onRemoveRecent: (q: string) => void;
  onClearRecent: () => void;
  onNavigate: () => void;
}

type BandTone = "light" | "primary-extra-light";

/** Section header band ("Mobile Nav Elements" in Figma): full-width tinted strip, small caps label. */
const Label = ({ children, tone = "light" }: { children: string; tone?: BandTone }) => (
  <Box backgroundColor={tone} padding="sm">
    <Text as="h3" size="textXs" weight="semiBold" color="text-base" style={SECTION_LABEL_STYLE}>{children}</Text>
  </Box>
);

function Suggestions({ items, onPick }: { items: SuggestResponse["suggestions"]; onPick: (q: string) => void }) {
  return (
    <Stack spacing="md" align="stretch" data-testid="typeahead-suggestions">
      <Label tone="primary-extra-light">SUGGESTED SEARCHES</Label>
      <Stack spacing={0} align="stretch">
        {items.map((s) => (
          <Stack key={s.text} spacing="sm" align="stretch">
            <Flex align="center" justify="space-between" spacing="sm">
              <Flex align="center" spacing="sm">
                <Icon name="search-md" size="md" />
                <Stack spacing={0} align="start">
                  <Link as="button" type="button" underline="hover" variant="inherit" size="textMd" onClick={() => onPick(s.value ?? s.text)}>{s.text}</Link>
                  {s.label && <Text size="textXs" color="text-subtle">{s.label}</Text>}
                </Stack>
              </Flex>
              <IconButton icon="arrow-up-left" size="sm" accessibilityLabel={`Use "${s.text}" in the search field`} onClick={() => onPick(s.value ?? s.text)} />
            </Flex>
            <Divider />
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

function Recent({ recent, onPick, onRemove, onClear }: { recent: string[]; onPick: (q: string) => void; onRemove: (q: string) => void; onClear: () => void }) {
  if (recent.length === 0) return null;
  return (
    <Stack spacing="md" align="stretch" data-testid="typeahead-recent">
      <Label tone="primary-extra-light">RECENT SEARCHES</Label>
      <Stack spacing="md" align="start">
        {recent.map((t) => (
          <Flex key={t} align="center" spacing="xs">
            <Button variant="tertiary" size="medium" icon="clock" onClick={() => onPick(t)}>{t}</Button>
            <IconButton icon="x-circle" size="sm" accessibilityLabel={`Remove ${t} from recent searches`} onClick={() => onRemove(t)} />
          </Flex>
        ))}
        <Button variant="link-primary" size="small" icon="arrow-right" onClick={onClear} data-testid="clear-recent">Clear all searches</Button>
      </Stack>
    </Stack>
  );
}

/** Compact bordered result card from the empty-focus design (not a Pure component, composed from Pure primitives). */
function CompactProductCard({ product }: { product: Product }) {
  return (
    <Box borderWidth="xs" borderStyle="solid" borderColor="base" radius="lg" data-testid={`search-result-product-${product.sku}`}>
      <Flex align="center" spacing={0}>
        <Image src={imageFor(product.image)} alt={product.name} width={96} radius="lg" />
        <Box padding="md">
          <Stack spacing="xs" align="start" justify="center">
            <Link as={RouterLink} to={`/shop/products/${slugify(product.name)}`} underline="hover" variant="inherit" size="textSm">{product.name}</Link>
            <Text size="textXs" color="text-subtle">Retail: <Text as="span" size="textXs" decoration="line-through">{money(product.retail)}</Text></Text>
            <Text weight="semiBold" size="textSm" color="text-base">Wholesale: {money(product.wholesale)}</Text>
          </Stack>
        </Box>
      </Flex>
    </Box>
  );
}

/** Popular products panel (empty focus, middle column): content tabs, compact result cards, best sellers link. */
function PopularProducts({ onNavigate }: { onNavigate: () => void }) {
  const [tab, setTab] = useState<ResultTab>("products");
  return (
    <Stack spacing="md" align="stretch" data-testid="typeahead-popular-products">
      <Label>POPULAR PRODUCTS</Label>
      <ButtonGroup aria-label="Popular content type" value={tab} onChange={(t) => setTab(t as ResultTab)} options={[{ value: "products", label: "Products" }, { value: "blog", label: "Blog" }, { value: "other", label: "Other" }]} />
      {tab === "products" && (
        <SpaLinks onNavigate={onNavigate}>
          <Stack spacing="sm" align="stretch">
            {popularProducts.map((p) => <CompactProductCard key={p.id} product={p} />)}
          </Stack>
        </SpaLinks>
      )}
      {tab === "blog" && <ContentResultList articles={popularBlog} testId="typeahead-popular-blog" onNavigate={onNavigate} />}
      {tab === "other" && <ContentResultList articles={popularOther} testId="typeahead-popular-other" onNavigate={onNavigate} />}
      <Button as={RouterLink} to="/shop" variant="secondary" size="medium" fullWidth onClick={onNavigate}>Shop Best Sellers</Button>
    </Stack>
  );
}

function Browse({ onPick, onNavigate }: { onPick: (q: string) => void; onNavigate: () => void }) {
  return (
    <Stack spacing="lg" align="stretch">
      <Stack spacing="md" align="stretch" data-testid="typeahead-popular">
        <Label tone="primary-extra-light">POPULAR THIS WEEK</Label>
        <Flex wrap spacing="md">
          {popularSearches.map((t) => <Button key={t} variant="tertiary" size="medium" icon="trend-up-01" onClick={() => onPick(t)}>{t}</Button>)}
        </Flex>
      </Stack>
      <Divider />
      <Stack spacing="md" align="stretch" data-testid="typeahead-browse">
        <Stack spacing="xs" align="stretch">
          <Text size="textXs" weight="semiBold" color="text-base" style={SECTION_LABEL_STYLE}>SHOP BY CATEGORY</Text>
          <Text as="h3" size="displayXs" weight="semiBold" color="text-base">Browse the catalogue</Text>
        </Stack>
        <Stack spacing={0} align="stretch">
          {browseCategories.map((c) => (
            <Stack key={c.href} spacing="sm" align="stretch">
              <Flex align="center" justify="space-between">
                <Link as={RouterLink} to={c.href} underline="hover" size="textMd" onClick={onNavigate}>{c.label}</Link>
                <Icon name="chevron-right" size="md" />
              </Flex>
              <Divider />
            </Stack>
          ))}
        </Stack>
        <Flex justify="start"><Button as={RouterLink} to="/shop" variant="link-primary" size="small" icon="arrow-right" onClick={onNavigate}>View All Products</Button></Flex>
      </Stack>
    </Stack>
  );
}

/**
 * Search overlay content (typeahead). Composed from Pure primitives because Pure's QuickSearch cannot render the
 * designed three column panel (suggested and recent searches, matching results with tabs, popular and browse).
 * Same content serves the desktop panel and the mobile and tablet overlay; Grid stacks the columns below lg.
 */
export function Typeahead({ query, recent, onPick, onSubmit, onRemoveRecent, onClearRecent, onNavigate }: Props) {
  const debounced = useDebounced(query.trim(), 200);
  const hasQuery = query.trim().length > 0;
  const { state, retry } = useAsync<SuggestResponse>(() => suggest(debounced), debounced, debounced.length > 0);
  const [tab, setTab] = useState<ResultTab>("products");

  const data = hasQuery ? state.data : null;
  const settling = hasQuery && (debounced !== query.trim() || state.status === "loading");
  const failed = hasQuery && debounced === query.trim() && state.status === "failed" ? state : null;
  const empty = !!data && !settling && !failed && data.counts.products + data.counts.blog + data.counts.other === 0;

  if (!hasQuery) {
    return (
      <Grid gap={{ xs: "md", lg: "xl" }} data-testid="typeahead-empty">
        <Grid.Column span={{ xs: 12, lg: 3 }}><Recent recent={recent} onPick={onPick} onRemove={onRemoveRecent} onClear={onClearRecent} />{recent.length === 0 && <Text color="text-subtle">No recent searches</Text>}</Grid.Column>
        <Grid.Column span={{ xs: 12, lg: 5 }}><PopularProducts onNavigate={onNavigate} /></Grid.Column>
        <Grid.Column span={{ xs: 12, lg: 4 }}><Browse onPick={onPick} onNavigate={onNavigate} /></Grid.Column>
      </Grid>
    );
  }

  const counts = data?.counts ?? { products: 0, blog: 0, other: 0 };
  const total = counts[tab];

  const middle = (
    <Stack spacing="md" align="stretch" data-testid="typeahead-results">
      <Label>MATCHING RESULTS</Label>
      {failed ? (
        <Alert level={failed.kind === "offline" ? "warning" : "error"} data-testid={`typeahead-${failed.kind}`}>
          <Flex align="center" justify="space-between" wrap spacing="sm">
            <Text>{failed.kind === "offline" ? "You appear to be offline." : "We could not load suggestions."}</Text>
            <Button variant="secondary" size="xsmall" onClick={retry}>Try again</Button>
          </Flex>
        </Alert>
      ) : empty ? (
        <EmptyState icon="search-md" title="No suggestions" description={`Nothing matches "${query.trim()}" yet. Press Enter to search the whole site.`} />
      ) : (
        <>
          <ButtonGroup aria-label="Result type" value={tab} onChange={(t) => setTab(t as ResultTab)} options={[{ value: "products", label: `Products (${counts.products})` }, { value: "blog", label: `Blog (${counts.blog})` }, { value: "other", label: `Other (${counts.other})` }]} />
          <Flex justify="end"><Button variant="link-primary" size="small" icon="arrow-right" onClick={() => onSubmit(query.trim())}>View all {counts.products + counts.blog + counts.other} results</Button></Flex>
          {settling ? (
            <Stack spacing="sm" align="stretch" aria-busy="true" data-testid="typeahead-loading">
              {[0, 1, 2].map((i) => <Skeleton key={i} height={96} radius="md" />)}
            </Stack>
          ) : (
            <SpaLinks onNavigate={onNavigate}>
              <Stack spacing="sm" align="stretch">
                {tab === "products" && data?.products.map((p) => <CompactProductCard key={p.id} product={p} />)}
                {tab === "blog" && data && <ContentResultList articles={data.articles.blog} testId="typeahead-blog-results" />}
                {tab === "other" && data && <ContentResultList articles={data.articles.other} testId="typeahead-other-results" />}
                {total === 0 && <Text color="text-subtle" data-testid="typeahead-tab-empty">Nothing in this tab. Try another one.</Text>}
              </Stack>
            </SpaLinks>
          )}
          <Button variant="secondary" fullWidth onClick={() => onSubmit(query.trim())} data-testid="typeahead-view-all">View all {counts.products + counts.blog + counts.other} results</Button>
        </>
      )}
    </Stack>
  );

  return (
    <Grid gap={{ xs: "md", lg: "xl" }} data-testid="typeahead-panel">
      <Grid.Column span={{ xs: 12, lg: 3 }}>
        <Stack spacing="xl" align="stretch">
          {data && data.suggestions.length > 0 && <Suggestions items={data.suggestions} onPick={onPick} />}
          <Recent recent={recent} onPick={onPick} onRemove={onRemoveRecent} onClear={onClearRecent} />
        </Stack>
      </Grid.Column>
      <Grid.Column span={{ xs: 12, lg: 5 }}>{middle}</Grid.Column>
      <Grid.Column span={{ xs: 12, lg: 4 }}><Browse onPick={onPick} onNavigate={onNavigate} /></Grid.Column>
    </Grid>
  );
}
