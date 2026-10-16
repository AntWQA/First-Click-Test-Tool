# Red team 4: supply chain, build integrity, licensing and distribution

Role: Security Specialist (supply chain, licensing, confidentiality of the bundle, delivery).
Artefact: `dist-single/wayfinding-check-participant.html`, 3,341,208 bytes, SHA-256 `5d11bd0f50b66086fe85c240730e5950dc945f245f2b57d3ca6fdf0c232f45b0` (hash of the file as it stood on 16 Oct 2026, mtime 15:47). I analysed copies in the scratchpad; nothing in the project was modified.
Overall: no Critical finding. No secrets, tokens, absolute paths, source maps or e-mail addresses are inside the artefact. The material risks for a public release are (1) the answer key and moderator guidance shipped in readable JS, (2) unconfirmed redistribution rights for Pure, doTERRA brand assets, product photography and an entire third-party icon set, (3) the chosen delivery method, and (4) a build that cannot be shown to be the committed, locked source.

## 0. Method and limits

- Read README and docs/INSTRUMENTATION-DIFF.md, package.json, all three vite configs, `scripts/build-single.mjs`, the e2e harness, `.gitignore`, git history (3 commits, `git log -p`, `git grep` across all revisions).
- Decomposed the file: shell JS (221,707 chars), prototype document (a JSON string in `window.__PROTO_HTML__`, 3,042,889 chars), prototype JS (1,910,220 chars), prototype CSS (1,132,317 chars), shell CSS (22,415 chars), 8 base64 blobs (2 woff2, 6 png).
- `npm audit` worked (registry reachable). To avoid sending private package names to the public registry I audited a scratch copy of `Navigation Prototype/package-lock.json` with every `@doterra-it` entry removed. The project itself has no lockfile, so `npm audit` there is impossible.
- I made one other registry call: `npm view` of two `@doterra-it` package names against registry.npmjs.org (both 404). No other hosts contacted. No GitHub calls, so repo visibility is UNVERIFIED.
- Rebuild: I tried to build twice in a scratch copy; the permission system denied that command, so I did not attempt it another way. Reproducibility is therefore UNVERIFIED by rebuild. What I could verify: the prototype JS in the file is byte-identical to `dist-proto/assets/proto-vFjbTzNW.js`; the shell JS in the file equals `dist-participant/assets/participant-WJJADhMG.js` after the script's `</script` and `<!--` escaping; shell CSS identical. So the "fold" step is deterministic and there are no timestamps or absolute paths in the output.

## 1. Third-party inventory (code actually in the built file)

Installed versions read from `Navigation Prototype/node_modules` (the symlink target). "In file" is by evidence in the bundle (banner or marker string) unless marked inferred. "Notice kept" means the licence or copyright text is present in the file.

| Package | Version | Licence (package.json) | In file | Notice kept | Known advisories for this version |
|---|---|---|---|---|---|
| react | 18.3.1 | MIT | Yes (banner), shell and prototype | Yes | None |
| react-dom | 18.3.1 | MIT | Yes (banner), both | Yes | None |
| scheduler | 0.23.2 | MIT | Yes (banner), both | Yes | None |
| react-router-dom | 6.30.6 | MIT | Yes (prototype only, banner) | Yes | GHSA-wrjc-x8rr-h8h6 (open redirect via backslash in Link/useNavigate), fixed only in 7.18+ |
| react-router | 6.30.6 | MIT | Yes (banner) | Yes | GHSA-wrjc-x8rr-h8h6; GHSA-337j-9hxr-rhxg (deserializeErrors, SSR hydration only) |
| @remix-run/router | 1.23.4 | MIT | Yes (banner) | Yes | None listed on its own |
| @floating-ui/react (+core, dom, utils, react-dom) | 0.27.20 / 1.8.0 / 1.8.0 / 0.2.12 / 2.1.9 | MIT | Yes (strings, inferred from Pure) | No | None |
| tabbable | 6.5.0 | MIT | Yes (banner) | Yes | None |
| classnames | 2.5.1 | MIT | Yes (banner) | Yes | None |
| normalize.css | 8.0.1 | MIT | Yes (CSS banner) | Yes | None |
| @radix-ui/* (accordion, popover, tabs, tooltip, roving-focus, collapsible and helpers) | Vendored inside Pure `dist/node_modules` with no package.json, so version UNKNOWN; checkbox, radio-group, switch, toggle-group resolve to top-level 1.3.12, 1.4.8, 1.3.8, 1.1.20 | MIT | Yes (markers `data-radix-popper`, `RovingFocus`) | No | UNVERIFIED for vendored copies |
| @doterra-it/design-system-ui-base | 2.6.0 | ISC (author "WQA", no LICENSE file) | Yes (all components used, plus whole icon set) | No | n/a |
| @doterra-it/design-system-ui-ecommerce | 2.6.0 | ISC (author "WQA", no LICENSE file) | Yes (inferred; `ProductCardSimple` is imported by the search code) | No | n/a |
| @doterra-it/design-system-primitives | 2.6.0 | ISC | Inferred | No | n/a |
| @doterra-it/design-tokens | 3.2.0 | ISC, no author | Yes (token CSS and JS object) | No | n/a |
| Plus Jakarta Sans (2 woff2, from Pure `dist/fonts`) | not stated | SIL OFL 1.1 (known upstream licence, not stated in the package) | Yes, base64 in CSS | No | n/a |
| Full Pure icon set, 1,172 SVG components | not stated | UNVERIFIED (naming and style are consistent with Untitled UI icons) | Yes, all 1,172 (`viewBox:"0 0 24 24"` x1,172) | No | n/a |

Present in `node_modules` but NOT in the file (tree-shaken, verified by marker search): lottie-web, lottie-react, moment, embla-carousel*, style-inject, tslib, dropzone, just-extend, react-remove-scroll*, aria-hidden, detect-node-es, get-nonce, loose-envify, js-tokens.

Build-time only (not shipped): vite 5.4.21, rollup 4.64.0, esbuild 0.21.5 (vite's copy) and 0.25.12, @vitejs/plugin-react 4.7.0, typescript 5.9.3, @babel/core 7.29.7, postcss 8.5.29, ws 8.22.0 (used by the e2e harness, undeclared). Install scripts exist only in esbuild and fsevents (lockfile `hasInstallScript`); none of the Pure packages has one.

`npm audit` (scratch lockfile, 16 Oct 2026): 4 findings. react-router and react-router-dom (moderate), vite (high), esbuild (moderate). The vite and esbuild advisories concern the dev server and Windows path handling and never reach the artefact. The react-router advisories need an attacker-controlled link target or SSR hydration; the app uses `MemoryRouter` inside a sandboxed iframe, hrefs come from static JSON, the recorder intercepts unhandled links and `window.open` is stubbed (proto.js), so practical exposure is low.

Version resolution: the lockfile pins `@doterra-it/*` with SHA-1 integrity only (5 of 342 entries; the rest are SHA-512).

## 2. Findings

### S-1 (High) Answer key, hypotheses and moderator guidance are shipped in the participant file
Evidence: `shell.js` contains the full default task content (`P1=[{id:"T1",...primary:[{href:"/shop/goal/sleep-solutions"}],...watchFor:"...",needBack:[...],highRisk,hypotheses:["H1","H6"]...`), 16 `watchFor`, 17 `needBack`, 17 hypothesis strings. Examples: "Shop by Category (the link was removed from there: a first click into Category is the test of that removal)"; "Healthy Living now has one home". The build check for the participant edition only searches 7 UI phrases, not the data.
Impact: any participant can open DevTools or View Source and read the correct destination for every task, which tasks the team considers high risk, the hypotheses, and what the client changed in the IA after the card sort. That invalidates results and discloses internal research design and unreleased IA rationale to the public and to competitors.
Status: VERIFIED.
Fix: in the participant build, strip task content to id, title, scenario and breakpoints (scoring is recomputed from raw events on import, per the README); add a build check that fails if `watchFor`, `needBack`, `hypotheses`, `primary` or `highRisk` appear in the participant output. Re-confirm that nothing in the participant flow needs targets.

### S-2 (High) Redistribution rights for Pure, doTERRA brand assets and product photography are unconfirmed
Evidence: Pure packages declare `"license":"ISC"`, `"author":"WQA"`, no LICENSE file, no copyright holder, published to a private GitLab registry (`gitlab.com/doterra-it/...`, project 75382571). No confidentiality text found in their README or package.json (searched for confidential, proprietary, all rights reserved, copyright, do not distribute). In the file: the doTERRA wordmark (Pure `Logo`, `HeaderBar.tsx:46`), full design tokens and component CSS (1.1 MB), 6 PNG product pack-shots carrying doTERRA marks (Abode, PB Restore, EO Mega+, VMG+ etc., PNG tEXt "Software: Figma"), a dummy catalogue with doTERRA registered product names (On Guard, Deep Blue, DigestZen, MetaPWR, Verage, HD Clean, Petal, Laluz) with retail and wholesale prices and SKU-style ids (`shell`/`proto` data, 56 products, 22 articles), the unreleased "Storefront" navigation IA, and the Plus Jakarta Sans fonts. The Navigation Prototype repo (public) already holds the source and dummy data but not Pure's compiled code.
Impact: a 3 MB file for the general public is an irreversible, copyable publication of the design system's compiled code and the client's marks and unreleased IA. "ISC" is permissive on its face, but who holds the copyright (WQA or doTERRA), whether the author field is an npm default, and whether the client approves public release are unknown.
Status: VERIFIED that no licence or confidentiality terms are in the packages; the legal position is UNVERIFIED (not a lawyer).
Questions to ask: (a) Design-system owner: who owns Pure, is the ISC declaration intentional, may compiled Pure code and tokens be sent outside doTERRA and WQA, and is a notice required? (b) doTERRA brand/legal: written approval to show the wordmark, product names and pack-shots to the public in a research tool, and is a "not the doTERRA website" statement needed? (c) Are the dummy retail and wholesale prices and SKU ids invented, or real? (d) Is the client happy for the unreleased IA to be public, and is an NDA or consent text needed for participants? (e) The study text (cough, sleep, breathing scenarios next to doTERRA products) is a claims-adjacent context; confirm with the client's regulatory team.

### S-3 (Medium) The whole icon library (1,172 SVG components) of unverified licence is embedded
Evidence: Pure's `Icon.js` uses a variable dynamic `import()` (1,172 cases); `inlineDynamicImports:true` in `vite.proto.config.ts` pulls every icon into `proto.js` (1,172 occurrences of `viewBox:"0 0 24 24"`; 1,080 kebab-case names in the enum). Only a handful are used.
Impact: the complete set is extractable from a public file; many commercial icon sets forbid redistribution as a pack. Also about 0.3 MB of dead weight.
Status: VERIFIED that it is shipped; licence of the set UNVERIFIED.
Fix: ask the design-system owner for the icon source and licence; import only the icons used (static imports or a Vite alias), then rebuild.

### S-4 (Medium) The shipped file cannot be tied to a commit or a locked dependency set
Evidence: `git status`: 3 modified tracked files (`SelfRun.tsx`, `theme.tsx`, `scripts/e2e/selfrun-check.mjs`); the file contains the uncommitted `useFollowedTheme` code (`attributeFilter:["data-theme"]` found once in shell.js). HEAD is 0ed23f3, so the artefact is not buildable from any commit. No `package-lock.json` in this project; `package.json` uses caret ranges; `node_modules` is a symlink to `../Navigation Prototype/node_modules` (a different repo whose devDependencies include Storybook, 342 locked packages). `dist-*` are gitignored, so no release file, tag or hash is stored. No CI, no CODEOWNERS, commits unsigned (`%G?` = N on all three).
Impact: if the developer machine, the sibling folder, the GitHub account or the GitLab token is compromised, nothing detects a changed file; nobody can later prove which file went to the public.
Status: VERIFIED.
Fix: commit before building; add a lockfile (copy the sibling's, drop devDependencies you do not use); build in a clean clone with `npm ci`; record SHA-256, commit id and lockfile hash in a release note; tag; ideally build in CI with a protected branch, 2FA and signed commits.

### S-5 (Medium) Dependency-confusion exposure and undeclared dependencies in this project
Evidence: this project has no `.npmrc` and no mapping for the `@doterra-it` scope (only the sibling has one, using `${GITLAB_TOKEN}`, no literal token). The README tells developers to remove the symlink and run `npm install` here. `registry.npmjs.org` returns 404 for `@doterra-it/design-system-ui-base` and `@doterra-it/design-tokens` (VERIFIED), so today the install would fail rather than pull a hostile copy. Whether the npm scope `@doterra-it` is reserved on npmjs.org is UNVERIFIED. `e2e/cdp.mjs` also does `require("ws")`, which is not in package.json and resolves only through the symlink.
Impact: if the scope is unclaimed, anyone could register it and publish `@doterra-it/design-system-ui-base@2.99.0`, matching `^2.6.0`, into a fresh install on any developer or CI machine.
Fix: reserve the `@doterra-it` scope on npmjs.org; commit a project `.npmrc` with `@doterra-it:registry=...` (token via env); commit a lockfile; declare `ws` as a devDependency.

### S-6 (Medium) Delivery as an e-mailed .html attachment is the weakest link for a public study
Evidence and reasoning:
- The file contains the pattern that HTML-smuggling detections look for: a 3.3 MB single-file app with large inline script and base64, plus `URL.createObjectURL(new Blob(...))`, an `<a download>` created and `.click()`ed (shell.js, "Save my results"). Secure e-mail gateways (Microsoft Defender for Office 365 Safe Attachments, Proofpoint, Mimecast and similar) commonly quarantine or strip HTML attachments. I could not test any gateway (UNVERIFIED).
- E-mail MIME-encodes the file to roughly 4.5 MB.
- Mobile and webmail preview paths (iOS Mail Quick Look, Gmail and Outlook web preview, Android viewers) do not run scripts or block `localStorage` and downloads; the README states desktop Chrome or Edge only (UNVERIFIED across clients).
- Sending HTML attachments to the public teaches recipients to open HTML attachments, which is what phishing relies on; the file imitates a doTERRA site, asks "Are you a doTERRA member?" and asks people to e-mail something back. Anyone can copy the file (the source is readable), change `__WC_SEND_TO__`, and send a lookalike; recipients cannot tell the difference.
- The moderator edition (answer key, ledger) sits beside it in `dist-single/` with the same `<title>`, so attaching the wrong file is easy.
Status: reasoning VERIFIED against the file; gateway and client behaviour UNVERIFIED.

### S-7 (Low) Build safeguards are string checks on markup and CSS; the CSP is not tamper protection
Evidence: `build-single.mjs` checks size, `<link>`, `src=` attributes, remote media tags, `@import`, CSS `url()`, Raleway, and 8 UI phrases. It never inspects the JS. Remote URLs survive in JS: 4 `images.unsplash.com` and 2 `plus.unsplash.com` avatar URLs in the Pure token object (README says only the stylesheet references are neutralised), `reactjs.org/docs/error-decoder.html`, and github.com in the tabbable banner. The printed "hosts mentioned" line is informational and never fails the build. Marker search found no `eval`, `new Function`, `atob`, `document.write`, WebSocket, sendBeacon, XHR, `import()`, workers, WebRTC or `javascript:` strings (the one `Function(` is React's `MSApp.execUnsafeLocalFunction`; the `fetch(` is Vite's modulepreload polyfill). CSP: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; frame-src about:; base-uri 'none'; form-action 'none'`.
Gaps: (1) delivered by `<meta>`, so removable by anyone who edits the file, and ignored by non-browser viewers; (2) cannot stop top-level navigation (`location=`), `window.open` outside the frame, WebRTC or DNS prefetch; (3) `'unsafe-inline'` means injected inline script would run; (4) no allowlist or diff of the bundle between builds; (5) a hostile dependency could hide behaviour in string concatenation.
Status: VERIFIED. Meaningful against accidental network access; not against a malicious build.

### S-8 (Low) Licence notices missing for several bundled components
Evidence: banners are kept for React, scheduler, react-router family, tabbable, classnames, normalize.css. Not present: @radix-ui and @floating-ui (MIT requires the copyright and permission notice with copies), Plus Jakarta Sans (OFL 1.1 requires licence text and copyright with bundled copies), Pure (ISC).
Fix: generate a THIRD-PARTY-NOTICES block (rollup licence plugin or a script) and include it in the file, for example as a visible "Licences" link or an HTML comment; add the OFL text for the font.

### S-9 (Low) Advisories on shipped react-router 6.30.6; unauditable vendored code
Details in section 1. Exposure low. The vendored Radix and floating copies inside Pure `dist/node_modules` have no version metadata, so vulnerabilities cannot be matched (UNVERIFIED). Fix: ask the Pure team to publish with real dependencies, plan the react-router 7 move, and rerun `npm audit` before release.

### S-10 (Low) Repo and process hygiene
Evidence: author e-mail in all commits; FigJam board key in `tests/golden/orders.json`; private package names and "GitLab token" in `package.json` and README; Figma node ids in source comments (none reached the artefact, comments are stripped). This project has no `.npmrc` at all, so none can leak. Repo is described as private (UNVERIFIED, no GitHub call made). The sibling tool repos are public, so a visibility change is plausible.
Fix: confirm private; if it may become public, remove the FigJam key and review README first.

### S-11 (Info) WC_SEND_TO handling is safe; validation is loose
I replayed the build logic with 22 hostile inputs (`</script>`, quotes, backticks, `${}`, `<!--`, U+2028, U+2029, newline, CRLF, NUL, zero-width space, right-to-left override, backslashes, `javascript:`). The regex `^[^\s<>"']+@[^\s<>"']+$` rejects every breakout; accepted values round-trip through `JSON.stringify` into a single `<script>` and are rendered by React as text (`SelfRun.tsx:149`), never as an href. Looseness: no length limit, accepts NUL, zero-width and bidi controls (an address could display misleadingly), and an unset variable silently builds a file with `""`. The file under test has no address baked in ("the researcher who gave you this tool"). A baked address will be public and scraped.

### S-12 (Info) No secrets or personal data in the artefact or history
Searched the file (base64 stripped), the working tree and `git log -p --all` for tokens (glpat, `_authToken`, GITLAB, npm_, AKIA, ghp_, sk-), e-mail addresses, `/Users/`, `anthonyfaconti`, `wearewqa`, `figma.com`, FigJam key, source maps, localhost and TODO strings. None in the artefact. The sibling `.npmrc` contains the `${GITLAB_TOKEN}` placeholder, not a value. `.git/config` has no credentials.

## 3. Build integrity detail (item 4)

- Environment variables: only `WC_SEND_TO` is read by the build. No `import.meta.env` object use (only the `define`d `VITE_ROUTER`), no `process.env` in browser code, no `.env` files present. Vite exposes only `VITE_*`.
- Poisoned cache: `cacheDir` is `.vite-cache` in the project; it did not exist when I looked. `dist-*` are emptied by Vite (`emptyOutDir`) except `dist-single`, which is overwritten; the `parts()` helper refuses to proceed unless each dist has exactly one JS and one CSS file.
- Install scripts: none in the shipped dependency closure; esbuild's postinstall is the only meaningful one and it is a dev-time binary fetch.
- Code that runs at build: the vite configs, plugin-react (babel) and whatever sits in the symlinked node_modules. A compromised package anywhere in the sibling's 342 packages is outside this project's control.
- e2e scripts: spawn headless Chrome from `CHROME_PATH` or the macOS default with `--remote-debugging-port` on 127.0.0.1 (random port), a throwaway profile, `--disable-site-isolation-trials`. `frame-check` and `session-check` deliberately `fetch('https://example.com/x')` to prove blocking. Nothing surprising; any local process could attach to the debugging port during a run.
- Reproducibility: output has no timestamps and no absolute paths; fold step verified deterministic; end-to-end rebuild UNVERIFIED; reproducibility also depends on the sibling's node_modules state and Node version (v24.14.0 here).
- Verifying a received file: nothing in the file can prove itself. The only reliable options are a hosted copy on a domain the participant already trusts, or a SHA-256 published on a separate page.

## 4. Recommended distribution for a public study

1. Host the participant edition on https on a dedicated origin you control (for example `research.<agency-or-client-domain>`), not on a shared domain, because localStorage is per origin and holds the session. Use a normal static host with TLS and HSTS.
2. Send participants a link in a message from an authenticated sender domain (SPF, DKIM, DMARC aligned), not an attachment.
3. Response headers on the HTML: `Content-Security-Policy` identical to the meta policy plus `frame-ancestors 'none'`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: no-referrer`; `X-Frame-Options: DENY`; `Cross-Origin-Opener-Policy: same-origin`; `Cross-Origin-Resource-Policy: same-origin`; `Permissions-Policy` denying camera, microphone, geolocation, payment, usb; `Strict-Transport-Security: max-age=31536000`; `X-Robots-Tag: noindex, nofollow`; `Cache-Control: no-cache` (or a versioned file name). Serve only the participant edition; never place the moderator file on the host.
4. Offer the same file as an optional download with its SHA-256 shown on the page, for people who prefer to run it offline.
5. If an attachment is unavoidable (small, known panel), tell the panel in advance, send from a known address, and expect quarantines.
6. What to tell participants: use Chrome or Edge on a laptop or desktop; open the link or file only from our message; the tool never asks for a password, payment or contact details and does not use the internet after loading; do not enter your name; at the end, save the results file and return it by the route in the message; if the screen asks you to "enable content", log in or install anything, close it and contact us.
7. Add a visible "not the doTERRA website" line and a short privacy and licence notice to the file, once the brand questions in S-2 are answered.

## 5. Hostile insider, compromised machine or account (item 6)

Anyone who can write to any of these can place code in a file thousands run, with no review step and no detection: the working folder; `Navigation Prototype/node_modules` (shared with a Storybook dev environment); the personal GitHub account `AntWQA` (2FA status unknown, no branch protection or CI evident); the GitLab personal access token in the shell environment (visible to every install script and process); a Pure maintainer account (a new 2.6.x inside `^2.6.0` is accepted wherever there is no lockfile; SHA-1 integrity only in the sibling lock). Mitigations: S-4 and S-5 fixes, two-person review of the release build, a CI build from a clean clone with `npm ci`, scoped read-only registry tokens, 2FA on GitHub, GitLab and npm, and publishing the hash of what was released.

## 6. Checked and fine

React, react-dom, scheduler licences and notices; react-router family notices; no install scripts in shipped closure; `.npmrc` has no literal token; no secrets, tokens, paths, e-mail addresses or source maps in the artefact; WC_SEND_TO injection; real catalogue excluded (the `virtual:live-catalogue` stub; 56 dummy products only; no real data string found); CSP present and first in `<head>`; the sandboxed frame uses `allow-scripts` only; no `eval`, no dynamic code, no network API use in either bundle; Raleway removed; PNG metadata is only "Figma".

## 7. Assumptions

Repo visibility as stated (private). The file I analysed is the one the owners intend to ship. Participant e-mail return of the JSON file is intended. No legal advice is given; the licence questions need the client and the design-system owner.
