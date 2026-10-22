import { Flex, Grid, Icon, List, Stack, Text, utilClassNames } from "@doterra-it/design-system-ui-base";
import type { GridColumns } from "@doterra-it/design-system-ui-base";
import { ContentCard } from "@doterra-it/design-system-ui-ecommerce";
import type { NavColumn, NavFeatured } from "../types/navigation";
import { AppLink } from "./AppLink";
import { FeaturedMedia } from "./FeaturedMedia";
import { NavLinkItem } from "./NavLinkItem";
import { SECTION_LABEL_STYLE, sectionLabel } from "./sectionLabel";

interface Props {
  columns: NavColumn[];
  featured?: NavFeatured;
  onNavigate: () => void;
}

/**
 * Content of a Nav.SubMenu: link columns plus an optional featured tile. Pure owns the panel, its Container
 * (so no second Container here, which double-inset the content), hover and focus behaviour.
 */
export function MegaMenuPanel({ columns, featured, onNavigate }: Props) {
  // With a featured tile, link columns default to 3 of 12 and the tile takes the remainder (minimum 3).
  // Without one, columns share the 12 evenly. An explicit `span` in navigation.json always wins.
  const defaultSpan = featured ? 3 : Math.max(1, Math.floor(12 / columns.length));
  const used = columns.reduce((n, c) => n + (c.span ?? defaultSpan), 0);
  const featuredSpan = Math.max(3, 12 - used);
  return (
    <Grid gap="xxl">
      {columns.map((col) => (
        <Grid.Column key={col.title} span={{ xs: 12, lg: (col.span ?? defaultSpan) as GridColumns }} as="section">
          <Text as="h3" size="textXs" weight="semiBold" color="text-subtle" style={SECTION_LABEL_STYLE} className={utilClassNames("mb-6")}>{sectionLabel(col.title)}</Text>
          <List type="plain" spacing="md">
            {col.links.map((l) => <NavLinkItem key={l.href} link={l} onNavigate={onNavigate} />)}
          </List>
        </Grid.Column>
      ))}
      {featured && (
        <Grid.Column span={{ xs: 12, lg: featuredSpan as GridColumns }} as="aside">
          <Text as="h3" size="textXs" weight="semiBold" color="text-subtle" style={SECTION_LABEL_STYLE} className={utilClassNames("mb-6")}>{sectionLabel("Featured")}</Text>
          <Stack spacing="md">
            <ContentCard href={featured.link.href} zoomOnHover shadow="none" borderWidth="none">
              <Flex direction="column" spacing="lg">
                <FeaturedMedia href={featured.link.href} />
                <Text size="textMd">{featured.title}</Text>
              </Flex>
            </ContentCard>
            <AppLink href={featured.link.href} onClick={onNavigate} data-testid="content-card-action-link">
              <span>{featured.link.label}<Icon name="arrow-right" size="sm" className="hp-link-arrow" /></span>
            </AppLink>
          </Stack>
        </Grid.Column>
      )}
    </Grid>
  );
}
