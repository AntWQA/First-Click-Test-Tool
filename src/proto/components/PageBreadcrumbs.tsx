import { Box, BreadcrumbTrail, List, ListItem, Popover, Text } from "@doterra-it/design-system-ui-base";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { AppLink } from "./AppLink";
import { SECTION_CRUMB_OPENS_NAV, SectionCrumb } from "./SectionCrumbMenu"; // EXPERIMENT: section crumb

export interface Crumb {
  label: string;
  /** Where the crumb links. The last crumb is the current page and is listed but never linked, whatever its `to`. */
  to?: string;
  /** EXPERIMENT: section crumb. Nav item id of a menu-only section; the crumb then opens that menu. */
  menuId?: string;
}

/** The trail never shows more than this many items. */
const MAX_ITEMS = 3;

/**
 * Breadcrumb trail capped at three items: first, last, and, when there are more, one middle item that collapses to
 * an ellipsis. The ellipsis opens a popover listing the crumbs it replaces, in order. The current page (last crumb)
 * is listed as text, not a link; a middle crumb with no `to` is listed as plain text too.
 */
export function PageBreadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const { pathname } = useLocation();

  const collapsed = crumbs.length > MAX_ITEMS;
  const first = crumbs[0];
  const last = crumbs[crumbs.length - 1];
  const middle = collapsed ? crumbs.slice(1, -1) : [];
  const shown = collapsed ? [] : crumbs;

  const link = (c: Crumb, isLast: boolean) => (SECTION_CRUMB_OPENS_NAV && c.menuId && !isLast // EXPERIMENT: section crumb
    ? <SectionCrumb key={c.menuId} id={c.menuId} label={c.label} />
    : c.to && !isLast
    ? <BreadcrumbTrail.Link key={c.to} as={RouterLink} to={c.to}>{c.label}</BreadcrumbTrail.Link>
    : <BreadcrumbTrail.Link key={c.label} as="span" aria-current={isLast ? "page" : undefined}>{c.label}</BreadcrumbTrail.Link>);

  return (
    <BreadcrumbTrail aria-label="Breadcrumb">
      {collapsed ? [
        link(first, false),
        // Uncontrolled (Pure turns its own click handling off when isOpen is passed). The page stays mounted between routes, so keying on the path closes the popover after a pick.
        <Popover key={`more-${pathname}`} placement="bottom-start">
          <Popover.Trigger as="button" aria-label={`Show ${middle.length} more breadcrumb items`}>
            <BreadcrumbTrail.Link as="span">…</BreadcrumbTrail.Link>
          </Popover.Trigger>
          <Popover.Content>
            <Box padding="lg">
              <List type="plain" spacing="md" aria-label="Breadcrumb items">
                {middle.map((c) => (
                  <ListItem key={c.to ?? c.label}>
                    {c.to ? <AppLink href={c.to}>{c.label}</AppLink> : <Text color="text-subtle">{c.label}</Text>}
                  </ListItem>
                ))}
              </List>
            </Box>
          </Popover.Content>
        </Popover>,
        link(last, true),
      ] : shown.map((c, i) => link(c, i === shown.length - 1))}
    </BreadcrumbTrail>
  );
}
