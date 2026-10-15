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
