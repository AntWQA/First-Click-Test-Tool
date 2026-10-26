# Instrumentation diff: what changed in the prototype copy

`src/proto/` is a duplicate of `Navigation Prototype/src/` (14 Oct 2026). The original is not touched: `npm run check:original` proves it by hashing the original's source against a baseline taken before the first copy.

This is the complete difference, from `diff -rq "Navigation Prototype/src" "First Click Test Tool/src/proto"`:

| Change | File | Why |
|---|---|---|
| Changed | `main.tsx` | Uses a `MemoryRouter` (the document lives in an iframe `srcdoc`, so there is no URL to route on), mounts `RecorderBridge` beside `App`, installs the recorder, and remounts the whole app when the shell sends "reset". The `BrowserRouter`/`HashRouter` switch is gone. |
| Changed | `components/HeaderBar.tsx` | One class (`lg:hidden`) on the slot that holds the menu button. At desktop the button's cell still reserved the 69px Close button, which left a gap of about 90px at the right of the header (icons 117px from the right edge against the logo's 24px from the left). Fixed in this copy only; the original prototype has the same gap. |
| Added | `recorder/recorder.ts` | Reports what the participant does to the shell by `postMessage`: clicks, menu openings and closings, route changes, searches. Intercepts links nobody handled so the frame can never navigate away. |
| Added | `recorder/RecorderBridge.tsx` | Rendered inside the router. Reports routes and searches, starts the clock and the menu observer, reports "ready" after the first paint. |
| Added | `recorder/globals.d.ts` | Types the nonce the shell injects. |
| Left out | `components/SiteHeader.stories.tsx`, `components/SiteFooter.stories.tsx`, `search/Search.stories.tsx`, `search/components/SortMenu.stories.tsx` | Storybook only. The tool does not ship Storybook. |

Every other source file in the copy (all 40-odd components, pages and search code) is byte-identical to the original. No other component, style or test id was edited. The prototype still follows its own strict Pure rules.

## Data differences (15 Oct 2026): the copy carries the post-card-sort IA

The original `Navigation Prototype/src/data/` still holds the navigation as it stood on 9 Oct, before the card sort. The tree test was then revised (Arm R, 12 Oct) and the first click test must run on that structure, so `src/proto/data/navigation.json` and `footer.json` in this copy were changed to match it. `tests/content.test.ts` holds the tree test's structure and fails if the two drift apart.

| Change | Detail |
|---|---|
| Learn: Resources group dissolved | Essential Oil Safety and Certified Pure Testing Grade move to Learn > Essential Oils (now 7 links). Healthy Living stays once, in Blog & Resources. The doTERRA Difference link is gone. Learn has three columns. |
| Our Story: groups merged | About doTERRA and The doTERRA Difference become one 7-link group; Why doTERRA, Healing Hands Foundation and Source to You now live there (`/our-story/about/...`). Source to You has one home. |
| Shop | Limited Time Offers removed from Shop by Category (it stays in Highlights). "New Arrivals" in Highlights renamed New Products (`/shop/highlights/new-products`); New Products stays in Category too. |
| Footer | Links to the moved pages follow them to their new addresses, so one page never has two. The footer's Limited Time Offers link now points at the Highlights page, because the Category page no longer exists. |

Not changed: the Figma-derived structure of everything else, children (Single Oils and so on, which the tree test does not model), the search code, and `StubPage.tsx` (its redirect list still names the old group paths, which no longer matter). If the original prototype should carry the same IA, copy these two data files back; the rest is identical.

Build-level differences (in the tool's configs, not in the copied source):

- `vite.proto.config.ts` replaces the original's live catalogue plugin with a stub that always returns the empty fallback, and has no path to any live data folder. The deliverable can never carry real dōTERRA catalogue data.
- Fonts and images are inlined, and the 18 unused Raleway `@font-face` blocks are pruned by `scripts/build-single.mjs` (the elevated theme the prototype uses sets Plus Jakarta Sans).
- Pure's avatar placeholder photo URLs in the stylesheet are neutralised, so nothing can reach the network.

## Homepage body (19 Oct 2026)

The start page is the homepage design from `Prod (CF-h)/` (a compiled build, no source), replacing the placeholder text. Only the body is used; the design's own header and footer are not imported. The prototype's header and footer wrap it as before.

| Change | File | Why |
|---|---|---|
| Added | `pages/HomePage.tsx` | The homepage body: promo banner, hero, three value cards, best sellers carousel, category carousel, quality duplex with accordion, three campaign spotlights, FAQ accordion, newsletter and contact cards. Rebuilt from the rendered DOM of the Prod file. At 1440, 768 and 402 every section sits at the same offset and height as the Prod file. |
| Added | `pages/home/blocks.tsx`, `pages/home/home.css` | Hero, BasicSection, CtaCard and Duplex are **not exported by the installed Pure 2.6.0**; they exist in the newer Pure build the design was made with. Local copies emit the same markup, with the stylesheet rules copied from that build under an `hp-` prefix. Replace them with the library components on the next Pure upgrade. Copied source gets no upstream fixes. |
| Added | `pages/home/images.ts`, `pages/home/images/*.webp` | 13 images resized and saved as WebP (about 390 KB; the design's duplicates kept once) so the single file stays under its 4 MB budget (3.83 MB). |
| Changed | `pages/StubPage.tsx`, `App.tsx` | The placeholder `HomePage` is removed; `App` imports the new one. |
| Changed | `main.tsx`, `package.json` | Imports `@doterra-it/design-system-ui-carousel/styles` (the carousel was a transitive dependency of Ecommerce, now declared). |
| Changed | `scripts/e2e/recorder-check.mjs` | The reset check looked for the old placeholder heading; it now looks for the new h1. |

Behaviour: every link is a plain anchor as in the design. A click is recorded as `other` and never ends a task. The three in-page jumps (Shop best sellers, How we test, All offers/Get details) scroll to their section; all other anchors do nothing. Pure's `Image` logs a React `fetchPriority` warning in dev (library issue, no effect on the build).

**Test validity:** the homepage now offers content that overlaps some tasks (Offers & campaigns vs the deals task, the quality/testing section vs the lab testing task, the Contact Us card vs the order problem task). Body clicks are recorded as wrong clicks (code 5), so read those tasks with that in mind.

## How the recorder works

- **Clicks** are captured on `window` in the capture phase, before the app's own handlers, so nothing in the page can stop propagation and hide one. The element is classified (leaf link, footer, featured tile, logo, utility, menu toggle, back, search, other) from its `data-testid` and its position in the page. **Section and column come from a lookup by href** in `navigation.json` and `footer.json`, the same files the prototype renders. Every header href is unique (a test proves it), so this does not depend on DOM structure.
- **Hover menus** (Shop, Learn, Our Story) are read from Pure's own open state, the class `dtds-nav__sub-menu--is-open` on the panel. The Rewards popover is read from its dialog. Pure applies its own 150 ms hover intent first, so what is recorded is what the participant actually saw open.
- **Mobile and tablet** drawer: a section row activated is the section choice.
- **Search**: a press on a search control is recorded on pointer-down as well as click, because Pure's expand-on-focus moves the input between press and release and the browser then fires no click at all. (Found by the end-to-end test.)
- **Plain links** (the footer, the featured tile) would load a real page in the frame. Router links call `preventDefault` themselves, so any link still unhandled after the app's turn is routed inside the memory router instead.
- **Messages** carry a per-load nonce. The frame is sandboxed with `allow-scripts` only, so its origin is opaque and cannot be checked; the shell verifies the source window and the nonce, and rebuilds each message from known fields.
- **Reset** between tasks remounts the app (router, search state, open menus) rather than reloading the 3 MB document.

## Verified

`scripts/e2e/recorder-check.mjs` drives the built file with real mouse events. With `WC_FUZZ=full` it clicks every link at the breakpoint where it is reachable and checks the recorded message: 57 desktop, 58 mobile and 66 tablet header links and 47 footer links, 25 of 25 checks passing on 14 Oct 2026.


## Product page

The homepage best seller cards, search results and every recommendation open a product page at `/shop/products/:slug`
(`src/pages/pdp/`). It is the signed-out retail state from the Figma Product Detail Page page: Pure `Gallery`, `Rating`,
`QuantityField`, `UsageIcons`, `Accordion`, `Modal`, `ReviewCard` and the carousel, plus a few `pdp-` rules for what Pure
2.6.0 has no component for (badges, purchase card, shipping line, CPTG mark). Add item to cart only confirms; there is no bag.

- **One definition of a product card.** `src/search/productView.ts` gives every surface the same name, image and size, and the
  catalogue record gives the price, so a homepage card, a search result, a recommendation and the page always agree.
  The five homepage best sellers use the shots from the homepage design.
- **The image bank rule.** A product is served anywhere (search, suggestions, recommendations, homepage, product page) only when we hold an image that really shows it: the homepage shots for the five best sellers, the live catalogue's own photo where that is loaded, or one of the few dummy photos that genuinely show a product (EO Mega+, VMG+, PB Restore). The dummy catalogue reuses a few placeholder photos across dozens of unrelated products, so those products are not served (8 are in the placeholder catalogue). `inImageBank` in `src/search/productView.ts` is the single filter, applied in `searchService.ts`.
- **Prototype copy.** MetaPWR Advantage (the test product, first best seller on the homepage) takes its details and images from its page on the doTERRA US storefront (item 60222772) inside the updated PDP design (`updated PDP/pdp.html`, the version without the member overlay); only the Can be used labels, the rating and the badges come from the design; other products get copy generated from their catalogue fields; the
  reviews and FAQ are invented stand-ins (the design's are Lorem ipsum). Replace them with the PDP team's copy before reading results as evidence about copy.
- **Prices are the US site's.** MetaPWR Advantage is $112.67 retail and $84.50 with an account (25% off); the recommended products carry their US catalogue prices (VMG+ $119.33, EO Mega+ $62.00, PB Restore $63.33, MetaPWR Starter System $260.00). **Account price** is the catalogue wholesale price (25% off retail). The delivery table is from the "How shipping will work" overlay.
- The button wording sits in one constant (`ADD_LABEL` in `ProductPage.tsx`): the design says "Add item to cart", the homepage team says "Add to bag".


## Zones, start page and the combined test (22 Oct 2026)

| Change | File | Why |
|---|---|---|
| Changed | `recorder/recorder.ts`, `shared/protocol.ts` | A click message carries an optional `zone`: the name from the nearest `data-zone` element. Fallbacks for Pure parts that do not forward the attribute: the product accordions by test id, the hero by class, and derived zones for the header (`nav-<section>`), footer, search. |
| Changed | `main.tsx`, `recorder/globals.d.ts`, `shell/Frame.tsx` | The shell can start the prototype on a given path (`__WC_START__`, the first entry of the memory router), so product tasks open the product page. |
| Changed | `pages/HomePage.tsx`, `pages/pdp/ProductPage.tsx` | `data-zone` on each band and the usage icons (a wrapper, because Pure's Section, Stack, Grid and Accordion.Item drop the attribute). The product page has a no-reviews state for `pb-restore` (Product B). |
| Changed | `pages/pdp/content.ts` | Product B copy. |

These add information to what is recorded and change what is rendered only for Product B; nothing else in the pages moved. The recorder-check, pdp-check and frame-check e2e scripts cover them.
