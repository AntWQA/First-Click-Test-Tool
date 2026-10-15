import { useEffect, useState } from "react";
import { Box, Button, Container, Drawer, Flex, Header, List, MobileMenu, Nav, Popover, Scroller, utilClassNames } from "@doterra-it/design-system-ui-base";
import { HeaderSearchField, SearchBar } from "@doterra-it/design-system-ui-ecommerce";
import { useLocation } from "react-router-dom";
import navigation from "../data/navigation.json";
import type { Navigation } from "../types/navigation";
import { SearchProvider, useSearch, useSearchOptional } from "../search/SearchProvider";
import { Typeahead } from "../search/components/Typeahead";
import { useIsDesktop } from "../search/useIsDesktop";
import { HeaderBar } from "./HeaderBar";
import { MegaMenuPanel } from "./MegaMenuPanel";
import { MenuToggle } from "./MenuToggle";
import { useOpenNavSectionRequest } from "./SectionCrumbMenu"; // EXPERIMENT: section crumb
import { MobileNav } from "./MobileNav";
import { NavLinkItem } from "./NavLinkItem";
import { useViewportHeight } from "./useViewportHeight";

/** Pure's fixed header height below lg, and the top of Pure's MobileMenu panel. */
const MOBILE_HEADER_HEIGHT = 77;
/** Pure MobileMenu slides with a 0.3s transform; the content stays mounted until it has slid out. */
const MENU_SLIDE_MS = 300;

const nav = navigation as unknown as Navigation;

interface Props {
  /** Open the mobile drawer on first render (used by stories and tests). */
  initialDrawerOpen?: boolean;
}

/** Uses the app-level SearchProvider when there is one (so pages can open the overlay), and mounts its own otherwise (stories). */
export function SiteHeader(props: Props) {
  const shared = useSearchOptional();
  return shared ? <SiteHeaderInner {...props} /> : <SearchProvider><SiteHeaderInner {...props} /></SearchProvider>;
}

function SiteHeaderInner({ initialDrawerOpen = false }: Props) {
  const { open: searchOpen, setOpen: setSearchOpen, query, setQuery, submit, recent } = useSearch();
  const isDesktop = useIsDesktop();
  const [drawerOpen, setDrawerOpen] = useState(initialDrawerOpen);
  const { pathname } = useLocation();
  const viewportHeight = useViewportHeight();
  const closeDrawer = () => setDrawerOpen(false);
  // The panel content is unmounted when closed, so its links are not focusable off screen (Pure's MobileMenu only sets aria-hidden).
  const [menuMounted, setMenuMounted] = useState(initialDrawerOpen);
  // EXPERIMENT: section crumb. A crumb asks for the menu on one primary item; cleared once the menu has closed.
  const [requestedSection, setRequestedSection] = useState<string | null>(null);
  useOpenNavSectionRequest((id) => { setRequestedSection(id); setDrawerOpen(true); });
  useEffect(() => {
    if (drawerOpen) { setMenuMounted(true); return undefined; }
    const t = window.setTimeout(() => { setMenuMounted(false); setRequestedSection(null); }, MENU_SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [drawerOpen]);
  // The menu is a below-lg pattern: close it when the viewport grows to desktop, and on Escape.
  useEffect(() => { if (isDesktop) setDrawerOpen(false); }, [isDesktop]);
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);
  const closeSearch = () => setSearchOpen(false);
  const typeahead = (
    <Typeahead
      query={query}
      recent={recent.recent}
      onPick={(q) => submit(q)}
      onSubmit={submit}
      onRemoveRecent={recent.remove}
      onClearRecent={recent.clear}
      onNavigate={closeSearch}
    />
  );

  return (
    <>
      <Header>
        <HeaderBar
          extras={(
            <Box className={utilClassNames("hidden", "lg:display-block")}>
              <HeaderSearchField
                withOverlay
                isExpanded={searchOpen && isDesktop}
                onExpandedChange={(expanded) => { if (isDesktop) setSearchOpen(expanded); }}
                onCancel={closeSearch}
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(query); if (e.key === "Escape") closeSearch(); }}
                data-testid="header-search-input"
              />
            </Box>
          )}
          onLogoClick={closeDrawer}
          onSearchClick={() => { closeDrawer(); setSearchOpen(true); }}
          below={searchOpen && isDesktop ? (
            // Desktop typeahead sits inside Pure's fixed Header so it stays under the field; Scroller keeps tall content reachable
            <Box backgroundColor="base" shadow="lg" data-testid="search-panel">
              <Box padding="xl"><Scroller scrollbars="y" height={620}>{typeahead}</Scroller></Box>
            </Box>
          ) : undefined}
          trailing={<MenuToggle isOpen={drawerOpen} onToggle={() => setDrawerOpen((o) => !o)} />}
          center={(
            <Flex justify="center" align="center">
              <Nav variant="button" className={utilClassNames("hidden", "lg:display-block")}>
                <Nav.Menu>
                  {nav.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    if (item.type === "dropdown") {
                      // Compact dropdown under the item (Figma Rewards, 3116:38136). Nav.SubMenu is always a full-width panel, so Pure Popover hosts the links.
                      return (
                        <Nav.Item key={item.id} id={item.id}>
                          <Popover placement="bottom-start" triggerInteraction="hover">
                            <Popover.Trigger as="span">
                              <Nav.Link id={item.id} active={active}>{item.label}</Nav.Link>
                            </Popover.Trigger>
                            <Popover.Content>
                              <Box padding="lg">
                                <List type="plain" spacing="md">
                                  {item.links.map((l) => <NavLinkItem key={l.href} link={l} onNavigate={() => undefined} />)}
                                </List>
                              </Box>
                            </Popover.Content>
                          </Popover>
                        </Nav.Item>
                      );
                    }
                    return (
                      <Nav.Item key={item.id} id={item.id}>
                        <Nav.Link id={item.id} active={active}>{item.label}</Nav.Link>
                        <Nav.SubMenu id={item.id} as="section" withCloseButton={false}>
                          <MegaMenuPanel columns={item.columns} featured={item.featured} onNavigate={() => undefined} />
                        </Nav.SubMenu>
                      </Nav.Item>
                    );
                  })}
                </Nav.Menu>
              </Nav>
            </Flex>
          )}
        />
      </Header>

      {/* Below lg the search opens as a full screen overlay with its own field, as in the mobile and tablet frames */}
      <Drawer position="top" size="full" state={[searchOpen && !isDesktop, (v) => setSearchOpen(typeof v === "function" ? v(searchOpen) : v)]} withCloseButton={false} withOverlay={false} aria-label="Search">
        {/* h-screen, not h-full: this top Drawer resolves to height:auto (clamped by max-height:100%), so a percentage height has no definite parent and the wrapper grows with its content instead of scrolling (PC-42) */}
        <Box className={utilClassNames("w-screen", "h-screen", "overflow-y-auto")} data-testid="search-overlay">
          <Container width="wide">
            <Box className={utilClassNames("py-4")}>
              <Flex align="center" spacing="md">
                <Flex.Child flex={1}>
                  <SearchBar id="overlay-search-input" label="Search" labelHidden placeholder="Search" value={query} onChange={(e) => setQuery(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(query); }} data-testid="overlay-search-input" />
                </Flex.Child>
                <Button variant="tertiary" size="small" onClick={closeSearch} data-testid="overlay-cancel">Cancel</Button>
              </Flex>
            </Box>
            <Box padding="md">{typeahead}</Box>
          </Container>
        </Box>
      </Drawer>

      {/* Below lg the menu opens under the page header, which stays where it is (Pure MobileMenu: fixed at 77px, under the header). Scroller makes long views such as Shop scroll inside the space below it. */}
      {/* shadow-element (an even shadow; Pure's lg to xxxl fall downward and barely show on the leading edge) marks the panel as sitting over the page. It is only applied while the panel is on screen or sliding out (menuMounted), because the shadow of a panel parked at -100% would show at the left edge. */}
      <MobileMenu isOpen={drawerOpen && !isDesktop} className={menuMounted ? utilClassNames("shadow-element") : undefined}>
        {menuMounted && (
          <Scroller scrollbars="y" height={Math.max(viewportHeight - MOBILE_HEADER_HEIGHT, 0)}>
            {/* The inner padding lg (24px) matches Figma's gap below the header */}
            <Box padding="lg"><MobileNav items={nav.items} onNavigate={closeDrawer} initialId={requestedSection} /></Box>
          </Scroller>
        )}
      </MobileMenu>
    </>
  );
}
