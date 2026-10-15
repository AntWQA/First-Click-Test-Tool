import { Box, Divider, Flex, Grid, Link, Skeleton, Stack, Tag, Text, utilClassNames } from "@doterra-it/design-system-ui-base";
import type { ColorKeyTags } from "@doterra-it/design-system-ui-base";
import { ProductCardSimple } from "@doterra-it/design-system-ui-ecommerce";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { money, slugify } from "../format";
import { imageFor } from "../images";
import { SpaLinks } from "./SpaLinks";
import type { Article, Product } from "../types";

/**
 * Grid product tile. Pure's elevated PLP card (ProductCardSimple) shows one price, so retail goes in the meta line
 * and wholesale in the price slot (PS-05: the design strikes retail through, which Pure cannot do). Out of stock has
 * no slot either, so a Pure Tag sits under the card.
 */
export function ProductTile({ product }: { product: Product }) {
  const navigate = useNavigate();
  return (
    <Stack spacing="xs" align="stretch">
      <ProductCardSimple
        variant="card"
        productImage={imageFor(product.image)}
        productTitle={product.name}
        productMeta={`Retail ${money(product.retail)}`}
        price={product.wholesale}
        currencyCode="USD"
        locale="en-US"
        onClick={() => navigate(`/shop/products/${slugify(product.name)}`)}
      />
      {!product.inStock && <Flex><Tag color="red-light" size="sm" data-testid="badge-out-of-stock">Out of stock</Tag></Flex>}
    </Stack>
  );
}

export function ProductGrid({ products, columns = { xs: 6, md: 4, lg: 3 } }: { products: Product[]; columns?: { xs: number; md: number; lg: number } }) {
  return (
    <Grid gap={{ xs: "md", md: "lg" }} data-testid="product-grid">
      {products.map((p) => <Grid.Column key={p.id} span={columns as never}><ProductTile product={p} /></Grid.Column>)}
    </Grid>
  );
}

/** Tag colours from the Figma content result (3320:22367): Article blue-lighter, Recipe green-white. Page, Support and Legal are not in the design, so they keep the purple-lighter used before. */
/**
 * Tags whose background was color/background/base (the "-white" colours) use the extra light background instead, logged in non-pure-components.md.
 * red-light already is error extra light. Pure Tag has no green light colour, so the Recipe tag keeps green-white and its
 * background custom property is pointed at the success extra light token for that one tag (inline style, one more strict-mode exception, approved 8 Oct 2026).
 */
const EXTRA_LIGHT_TAG_STYLE = { "--color-background-base": "var(--color-background-success-extra-light)" } as CSSProperties;

const contentTagColor = (type: string): ColorKeyTags => (type === "Article" ? "blue-lighter" : type === "Recipe" ? "green-white" : "purple-lighter");

/**
 * Text-only content result (Figma "Content result" 3320:22436): type tag, semibold title, excerpt, 8px between them,
 * 16px above and below, and a divider after each row (Divider md; code has light and dark only, so the default light is used for the Figma "Default" colour). Used for articles, recipes and
 * every other non-product result, on the results page and in the typeahead.
 */
export function ContentResultList({ articles, testId, onNavigate }: { articles: Article[]; testId: string; onNavigate?: () => void }) {
  return (
    <SpaLinks onNavigate={onNavigate}>
      <Stack spacing={0} align="stretch" data-testid={testId}>
        {articles.map((a) => (
          <Stack key={a.id} spacing={0} align="stretch">
            <Stack spacing={3} align="start" className={utilClassNames("py-5")}>
              {a.type === "Recipe"
                ? <Box as="span" style={EXTRA_LIGHT_TAG_STYLE}><Tag color="green-white" size="sm" variant="subtle">{a.type}</Tag></Box>
                : <Tag color={contentTagColor(a.type)} size="sm" variant="subtle">{a.type}</Tag>}
              <Link href={a.href} underline="hover" variant="primary"><Text as="span" size="textSm" weight="semiBold">{a.title}</Text></Link>
              <Text size="textSm" color="text-subtle">{a.excerpt}</Text>
            </Stack>
            <Divider thickness="md" />
          </Stack>
        ))}
      </Stack>
    </SpaLinks>
  );
}

export function BlogResults({ articles }: { articles: Article[] }) {
  return <ContentResultList articles={articles} testId="blog-results" />;
}

/** "Other" results (pages, support, legal) use the same text-only list as articles and recipes. */
export function OtherResults({ articles }: { articles: Article[] }) {
  return <ContentResultList articles={articles} testId="other-results" />;
}

export function ResultsSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <Grid gap={{ xs: "md", md: "lg" }} aria-busy="true" data-testid="results-loading">
      {Array.from({ length: cards }).map((_, i) => (
        <Grid.Column key={i} span={{ xs: 6, md: 4, lg: 3 }}>
          <Stack spacing="sm" align="stretch">
            <Skeleton height={200} radius="md" />
            <Skeleton height="textMd" />
            <Skeleton height="textSm" width={120} />
          </Stack>
        </Grid.Column>
      ))}
    </Grid>
  );
}
