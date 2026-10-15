import type { ReactNode } from "react";
import { Box, Container, Flex, Header, IconButton, Link, Logo, utilClassNames } from "@doterra-it/design-system-ui-base";
import { Link as RouterLink } from "react-router-dom";

interface Props {
  /** Called when the logo is activated (the open menu uses it to close the drawer). */
  onLogoClick?: () => void;
  /** Desktop navigation, centred between the logo and the utilities. Omit in the open menu. */
  center?: ReactNode;
  /** Controls placed before the icons (the desktop search field). */
  extras?: ReactNode;
  /** Last control: the menu toggle on the page, the Close button in the open menu. */
  trailing: ReactNode;
  /** Content shown under the bar inside the header (the desktop search panel). It overflows Pure's fixed 100px header, which keeps overflow visible. */
  below?: ReactNode;
  /** Opens search from the toolbar icon (shown below lg, where the search field is hidden). */
  onSearchClick?: () => void;
}

const inactive = "not available in this prototype";

/*
 * HeaderSearchField's expand-on-focus behaviour depends on two data attributes that are not props: the row it takes
 * over (data-header-search-field-overlay-root) and the siblings it covers (data-header-search-field-overlay-cover).
 * Pure's CSS keys off them; Container drops unknown attributes, so they sit on Flex, Flex.Child and IconButton.
 */

/**
 * The header bar, shared by the page header and the open mobile menu so both place the logo and controls
 * identically (Figma shows the same header in both states).
 *
 * Spacing, all from Pure tokens: Pure's Container leaves 12px at each side on mobile and Figma uses 16px, so
 * px-2 (spacing-2, 4px) tops it up; py-4 (spacing-4, 12px) centres the row (56px, set by Pure's menu toggle) in
 * Pure's fixed 77px header, which pins content to the top. Both reset at lg, where Pure's 100px header and 24px
 * container padding apply.
 */
export function HeaderBar({ onLogoClick, center, extras, trailing, onSearchClick, below }: Props) {
  return (
    // Pure's header forces every direct child to 100% height, so the bar and the panel share one wrapper: the bar keeps the full header height and the panel overflows below it at full viewport width (Figma).
    <Box>
    <Box className={utilClassNames("h-full")}>
    <Container width="wide">
      <Box className={utilClassNames("py-4", "px-2", "lg:py-0", "lg:px-0")}>
        <Flex justify="space-between" align="center" spacing={{ xs: "md", lg: 9 }}>
          <Link as={RouterLink} to="/" onClick={onLogoClick} aria-label="doTERRA - Back to home" data-testid="header-logo">
            <Logo width="94" height="24" className={utilClassNames("lg:hidden")} />
            <Logo width="115" height="32" className={utilClassNames("hidden", "lg:display-block")} />
          </Link>

          {/* Everything except the logo is the search field's overlay root, so the expanded field covers the nav and icons but the logo stays visible (as in Pure's demo) */}
          <Flex.Child flex={1} data-header-search-field-overlay-root>
            <Flex align="center" spacing={{ xs: "md", lg: 9 }}>
              <Flex.Child flex={1} data-header-search-field-overlay-cover>{center}</Flex.Child>

              <Flex.Child grow={0} shrink={0} basis="auto">
                <Flex align="center" spacing={{ xs: "sm", lg: 6 }}>
                  {extras}
                  <Header.Toolbar>
                    {/* Below lg the search field is hidden, so Figma and the Pure test header show a search icon instead */}
                    <Box className={utilClassNames("lg:hidden")}>
                      <IconButton icon="search-md" size={{ xs: "sm", lg: "md" }} aria-label="Search" tooltipText="Search" onClick={onSearchClick} data-testid="toolbar-search" />
                    </Box>
                    <IconButton icon="user-02" size={{ xs: "sm", lg: "md" }} aria-label={`Account (${inactive})`} tooltipText={`Account (${inactive})`} aria-disabled="true" data-testid="toolbar-account" data-header-search-field-overlay-cover />
                    <IconButton icon="shopping-bag-02" size={{ xs: "sm", lg: "md" }} aria-label={`Shopping bag (${inactive})`} tooltipText={`Shopping bag (${inactive})`} aria-disabled="true" data-testid="toolbar-bag" data-header-search-field-overlay-cover />
                  </Header.Toolbar>
                  {/* Header.Toolbar carries order 3 in Pure, so the last control needs a higher order to sit after the icons */}
                  {/* lg:hidden: the menu button's cell reserves the 69px Close button even where the toggle is hidden, which left a gap at the right edge of the desktop header */}
                  <Flex.Child grow={0} shrink={0} order={4} className={utilClassNames("lg:hidden")}>{trailing}</Flex.Child>
                </Flex>
              </Flex.Child>
            </Flex>
          </Flex.Child>
        </Flex>
      </Box>
    </Container>
    </Box>
    {below}
    </Box>
  );
}
