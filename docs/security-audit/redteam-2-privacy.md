# Red team 2: data, privacy and disclosure review

Target: `dist-single/wayfinding-check-participant.html` (3,341,208 bytes, built 16 Oct 2026 15:47). Role: Security and Privacy Specialist. Context assumed: UK GDPR, members of the public (possibly minors or vulnerable people), consumer-grade attackers, file sent out by email or download.

Method: read README and source (`SelfRun.tsx`, `Participant.tsx`, `state.tsx`, `storage.ts`, `session.ts`, `exports.ts`, `tasks.ts`, `protocol.ts`, `theme.tsx`, proto recorder and search); scanned the built file with Python (emails, URLs, absolute paths, usernames, key and token patterns, figma ids, comments, PNG metadata); drove the built file in headless Chrome over CDP using the project's `launch()` helper (scripts in the scratchpad only: `run1.mjs`, `run2.mjs`, `run3.mjs`, `scan.py`, `png.py`). No requests were made to external hosts; the run recorded zero non-file network requests and zero console errors.

## 1. Data inventory (verified by real runs)

| # | Where | Key or field | Shape | Content | Personal data? | Notes |
|---|---|---|---|---|---|---|
| 1 | localStorage (origin `file://`) | `wc.v1.session.<id>` (one per session, never removed) | JSON, about 11 KB per short session | Whole session object (rows below) | Yes | Persists indefinitely. Not deleted by "Start a new session". No delete control in the participant edition. |
| 2 | localStorage | `wc.theme` | `"light"` or `"dark"` | Colour preference | No | Only if the button was used. |
| 3 | localStorage | `wc.v1.content` | custom task JSON | Only written by the moderator Content tab | No | Not written by the participant edition (verified: absent). |
| 4 | session | `participantId` | string, `[A-Za-z0-9_.-]{1,40}` | The code the participant types | Pseudonymous; becomes identifying with the sender's email. Nothing stops a real name being typed (for example `Jane.Smith`) | Also placed in the download file name. |
| 5 | session | `group` | `non-member`, `WC`, `WA` | Membership status (mandatory, no "prefer not to say") | Yes, commercial relationship; not Art. 9 special category | Needed to read results by group, but the researchers already issued the code. |
| 6 | session | `id`, `createdAt`, `updatedAt`, `presentedAt`, `beginAt`, `endAt`, `readingMs`, `durationMs` | epoch ms | Exact times of day, reading and task timings | Behavioural; low risk alone | `exportedAt` is an ISO UTC timestamp; the file name carries the local date. |
| 7 | session | `plan`, `order`, `cursor`, `phase`, `status`, `interruptions`, `retakeOf` | small JSON | Task order and breakpoint per task (derived from the code) | No | |
| 8 | session | `runs[].scale` | number 0 to 1 | Frame scale: 0.59 at a 1000 px window, 1 when the window is 1440 or wider | Coarse device and window-width signal | Verified. `windowResized` boolean also kept. |
| 9 | session | `runs[].ease` | integer 1 to 7 | Rating | No | |
| 10 | session | `runs[].participantNotes` | free text, max 2000 each | "What did you expect to find there?" box | Yes, arbitrary, may include health or third-party data | No warning shown. Verified: a note naming a medicine and a phone number stored verbatim. |
| 11 | session | `debriefNotes` | free text, max 4000 | Final "Anything you would like to add?" | As above | Saved only when Save or Copy is pressed (state otherwise only in memory). |
| 12 | session | `runs[].events[]` | `click`, `menu-open`, `menu-close`, `route`, `ready`, `search-submit` | Click kind, label, test id, href, section, column, x, y within the frame; menu open and close times; frame size (402x874, 768x1024 or 1440x1024) | Behavioural | No mouse trajectory, no keystrokes, no pointer type, no user agent. |
| 13 | session | `events[].query` and `route.path` | string, max 200 | The search query typed, verbatim, twice (`search-submit` and `route` `/search?q=...`) | Yes, arbitrary | Verified: "asthma for my daughter Emma Jones age 6 call 07700 900123 jane@example.com" captured in full. |
| 14 | session | `runs[].suggestion` | scoring result | Derived tier, code, sections opened | No | Recomputed on import anyway. |
| 15 | session | `runs[].moderator` | empty object in self-run | Findings fields, all blank | No | Dead weight in every export. |
| 16 | session | `content` (and again at bundle top level) | about 10 KB JSON each | Full task set: scenario, targets, watchFor, needBack, hypotheses, highRisk | Not personal; confidential research design | In every saved file twice (22.5 KB of a 33.6 KB file). |
| 17 | Results file and clipboard | `doterra_research_<code>_<yyyy-mm-dd>.json` | pretty-printed JSON, about 33 KB for one task | Rows 4 to 16 plus `exportVersion`, `app: "wayfinding-check"`, `exportedAt` | Yes | Clipboard text verified identical in content to the file (only `exportedAt` differs). |
| 18 | Memory only | React state, frame state, search typeahead, recent searches | n/a | Prototype's recent-search store | n/a | Prototype is sandboxed (`allow-scripts` only); its `localStorage` access throws `SecurityError` (verified), so recent searches are not persisted. |
| 19 | Not collected | cookies, IndexedDB, sessionStorage, user agent, locale, time zone, IP (client side), device id, network calls | n/a | n/a | n/a | Verified: `document.cookie` empty; no matching reads in the participant code; library UA reads belong to floating-ui and focus-trap and are not stored or exported. |

Combination risk: code + group + sender email + search/notes text + date and time = an identifiable person's commercial status and, potentially, health or child information, held by whoever receives the email.

## 2. Findings

### P-1 High: the next person on the same browser can read and download the previous participant's results; nothing can be deleted

Evidence (VERIFIED, `run3.mjs`):
1. Participant A (code A1, group WA) finished, typed a run note ("note A: I take warfarin") and pressed End session. A did not save.
2. Same browser profile, same file, reload. The file opens on A's results page (SelfRun.tsx lines 29 to 34: it reopens the latest session whose phase is not "setup").
3. Participant B pressed "Save my results". The downloaded `doterra_research_A1_<date>.json` contained A's code, group "WA" and A's note.
4. In run 1, "Start a new session" left the stored session key in place (storage after click: same key, same size) and a further reload put the old results page back. Sessions accumulate (two keys after a second participant).
5. Source: `state.tsx` `closeSession` only clears the active id; `deleteSession` exists but no participant screen calls it. Grep of the built file finds no clear, delete or erase wording.

Impact: on a library, work, school or family computer, the next user sees and can export the previous person's membership status, free-text notes and typed searches, and can send them (or have them contaminate a new session). The participant cannot erase their own data except by clearing browser site data for `file://`, which ordinary users will not find.

Fix: (a) "Start a new session" and a visible "Delete my data from this browser" button on the results page, which calls `deleteSession` and removes `wc.v1.*`; (b) after a successful Save or Copy offer a "I have sent it, clear this device" action; (c) do not auto-reopen a finished or ended session on load (only an in-progress one, with an explicit "Carry on or start again" choice); (d) tell participants on shared computers to use a private window plus Save (and fix P-12 first); (e) optional auto-expiry (drop sessions older than N hours).

### P-2 High: no privacy notice, controller, purpose, lawful basis, retention, rights or contact point; the return address is blank in this build

Evidence (VERIFIED): the entire setup screen text is "Nothing is sent anywhere. At the end you save a file and send it to us." with a code field ("Please do not use your name") and a membership dropdown. Finish page: "send us your results file", "Send it to the researcher who gave you this tool." The built file has `window.__WC_SEND_TO__=""` (build used no `WC_SEND_TO`). A search of all screens for privacy, consent, GDPR, retain, delete, withdraw, erase, 18, adult, controller, lawful found nothing. Brand on screen is "Wayfinding Check" with a logo; the file name says `doterra_research`, so the controller is unclear to the participant (doTERRA, the agency, or both).

Impact: processing of identifiable data (code + email + membership + free text) without Art. 13 information; participants cannot exercise rights or know who "us" is; an unknown address invites mis-sending or replies to a phishing lookalike.

What a DPO would ask for before wide release: named controller (and processor if an agency runs it), purpose, lawful basis (usually legitimate interests with a short LIA, or consent if any sensitive free text is likely), what is collected, who sees it, where stored, retention period, right to withdraw and erase, contact (DPO or research mailbox), complaint route (ICO), statement that submission is voluntary and that sending the file is the act of sharing.

Suggested wording for the setup screen (short, before Start; link to the full notice):
"Who we are: [Controller name] runs this research. What we collect: your code, whether you are a doTERRA member, where you click, anything you search for and anything you type in the note boxes. Please do not type names, contact details or health information about yourself or anyone else. Why: to improve website navigation; we use [legitimate interests]. You choose whether to send us the file. Who sees it: the research team only. We keep it for [6 months] then delete it. You can ask us to delete it, or withdraw, at any time: [address]. More: [privacy notice link]. Nothing leaves your device until you send the file."
Add an "I am 18 or over" confirmation and bake in the send address (`WC_SEND_TO=...`) and the retention statement on the finish page.

### P-3 Medium: free text and search queries are stored and exported verbatim with no warning, in a test built on health and child scenarios

Evidence (VERIFIED): three free-text surfaces (per-task note, final note, the prototype's search box). Only warning anywhere is the hint under the code field. Scenarios: T1 sleep, T2 cough and breathing, T6 toddler safety, T11 order problem, T12 returns. Search query and notes were captured verbatim (rows 10, 11, 13); the query appears twice (`route` path and `search-submit`). Maximum lengths 2000, 4000 and 200 characters. No filtering or warning at the point of typing; in the search box the participant is in a realistic shopping UI and likely to behave naturally.

Impact: health data of an identifiable person (or a child) can reach an email inbox and the researchers' storage. Health data is Art. 9 special category data; incidental collection still needs a lawful basis and appropriate handling. Third parties (the toddler, "my daughter Emma") cannot be informed.

Fix: a one-line caution above each note box and a prompt under the search overlay that cannot be missed on the first scenario ("Imagine the situation; please don't type real names, health details or contact details"). Consider storing the search query only as a normalised or truncated string, or dropping `route.path` for `/search`. Add a "Remove my notes before saving" option. Treat the received files as potentially special category (restricted access, encrypted store, delete after import).

### P-4 Medium: the file hands the participant the answer key, moderator notes and research design (in the JS, in every export, and on screen in the copy fallback)

Evidence (VERIFIED): `tasks.ts` `DEFAULT_TASKS` is in the bundle at about byte offset 3,287,952 onward: for all 14 tasks `primary`, `acceptable`, `separate` targets, `watchFor`, `needBack`, `hypotheses` (H1 to H7), `highRisk`. Examples: T1 primary `/shop/goal/sleep-solutions`; T3 watchFor "the link was removed from there: a first click into Category is the test of that removal"; T2 needBack "Compare with T1: does symptom wording score lower than goal wording?"; T7 needBack "If this task fails, pause analysis and check the scenario and the prototype"; T10 note "Confirm the page content first"; T11 and T12 "Help: page content unconfirmed". The exported file contains `content` at top level and again in `sessions[0].content` (22.5 KB of 33.6 KB). In the "Copy instead" fallback the whole JSON (including `watchFor`) is shown to the participant in a textarea (verified). Hypothesis statements are not embedded, only ids and the high-risk flag.

Impact: a participant (or anyone with the file) can view source or open the saved JSON and read the correct link per task and what the team is testing. Research validity: a curious or competitive participant, or a participant who shares the file or the JSON with friends, biases results; results are also attributable to design intent. Commercially it reveals the post-card-sort IA decisions ("the Resources group is gone", Source to You now has one home).

Fix: ship the participant edition with tasks reduced to `id`, `title`, `scenario`, `breakpoints`, `reserve`; do not run scoring in the participant build; put targets and notes only in the researchers' importer (it already recomputes suggestions from raw events, so import should resolve `content.version` against its own table rather than trusting an embedded snapshot). Remove `moderator`, `planOverrides`, `suggestion` and the duplicate bundle-level `content` from the self-run export. Note that anything shipped in a client file can still be extracted; this raises the effort, not to zero.

### P-5 Medium: the return path (email) is the weakest link, and the file is not shaped to be safe on it

Evidence and reasoning: the participant must email a roughly 33 KB JSON (about 9 KB gzip) or paste its text into a message. Email is not end-to-end encrypted, is copied to Sent folders, backups and the researchers' mailbox, and is retained indefinitely by default. The file name `doterra_research_<code>_<date>.json` reveals project, code (possibly a name) and date to every mail system. The sender address plus the code is the identification link. `.json` attachments are blocked or stripped by some corporate and privacy filters (UNVERIFIED which). The tool arrives as a 3 MB `.html` attachment, which also trains the public to open HTML attachments from email and is often blocked or scanned. The send address is not set (P-2). The "Copy instead" path leaves the full JSON on the clipboard (Windows clipboard history, Apple Universal Clipboard).

Safer options, best first: (1) a controller-hosted upload page or Microsoft Forms or SharePoint request-files link with a privacy notice and a one-time link, TLS and retention rules (this means the file is no longer "nothing leaves the device", so say so); (2) client-side encryption of the payload to the researchers' public key (WebCrypto, key baked in at build) so inboxes only hold ciphertext; UNVERIFIED that `crypto.subtle` is available on every `file://` browser; (3) a dedicated research mailbox with auto-delete after import, an auto-reply carrying the privacy notice, and no human forwarding; (4) shrink the file (P-4), neutral file name `wc_<code>.json` or random token, and show the participant a "what you will send" preview (a read-only summary: code, group, notes, searches) before they save.

### P-6 Low: any other local page in the same browser can read the stored session (Chrome shares `file://` storage)

Evidence (VERIFIED, `run2.mjs`): after a session, a different file `file:///.../other/other.html` in the same profile ran `Object.keys(localStorage)` and received `["wc.v1.session.s_..."]`; origin reported as `file://`. Firefox treats each file as its own origin and Safari may block it (UNVERIFIED). Stored data has no expiry and no encryption.

Impact: local malware-lite scenarios, other downloaded HTML files, or browser extensions with file access can read it. Consumer-grade risk, so Low.

Fix: reduce what is stored (drop `content` snapshot and `moderator` block from the stored session, clear on completion after Save), add expiry, and prefer a hosted deployment with a real origin.

### P-7 Low: membership question is mandatory, has no "prefer not to say", and duplicates what recruitment already knows

Evidence (VERIFIED): `group` required; the e2e test asserts there is no "prefer not to say" option; the answer is stored and exported. The code is issued by the researchers, so the group could be held on their side keyed to the code.

Impact: proportionality: asking customers or advocates to state their commercial relationship, and tying it to an email address, is more than the navigation analysis needs if the recruitment sheet exists. WA status may be commercially sensitive (distributor relationship), and some Wellness Advocates may not want it disclosed to an agency.

Fix: derive group from the code at import and drop the question; or make it optional ("Prefer not to say") and say why it is asked.

### P-8 Low: no age statement; children and vulnerable people not considered

Evidence (VERIFIED): no age, no "ask a parent", no vulnerable-participant wording; scenarios mention a toddler and symptoms; notes invite "what you expected". Public distribution makes minors possible; WA and WC are adult statuses but non-members have no age gate.

Fix: "You must be 18 or over to take part" with a tick; recruit adults only; if minors are in scope the Age Appropriate Design Code and parental consent need a separate assessment. Add "You can stop any time" (the End session link exists, so surface it in the notice) and a signpost to what to do if the scenarios raise something upsetting. Keep the T2 and T6 wording neutral and role-play ("imagine").

### P-9 Low: behavioural and device signals beyond what the analysis needs

Evidence (VERIFIED): `scale` (reveals window width, for example 0.59 at 1000 px), `windowResized`, epoch timestamps with local-time-of-day, per-click x and y, `exportedAt`. No user agent, locale, time zone, IP, screen size or device pixel ratio in the file.

Impact: individually minor; with a code and an email they add a loose fingerprint and a timeline.

Fix: round timings to the second or keep only durations, drop absolute timestamps from the export, bucket `scale` (full, reduced), keep click coordinates only if the analysis uses them.

### P-10 Low: copy and save leave residue on the device

Evidence (VERIFIED): Save writes `doterra_research_<code>_<date>.json` into Downloads; Copy leaves the entire JSON on the clipboard; both are unrelated to the stored session in P-1. The finish page says "keep this window open until you have" sent it.

Fix: tell participants to delete the file after sending and to clear the clipboard (copy a blank selection); offer a "I have sent it" button that clears the stored session.

### P-11 Info: internal references that do reach the public in the file (nothing credential-like found)

Evidence (VERIFIED by scan):
- Embedded prototype document `<title>Storefront Navigation Prototype</title>` (offset 23,148) and the home stub heading "Storefront navigation prototype" with text "Search, account and bag are not part of this build" (offset about 2,113,037), which is also inaccurate because search works. "Storefront" is an internal project name.
- Six embedded PNGs carry PNG `tEXt` `Software: Figma`; no file key, node id, name or path (VERIFIED).
- Old IA paths still in `NON_PAGE_REDIRECTS` and nav data (`/our-story/difference`, `/learn/resources/*`); shows IA history. Navigation labels such as "Path to $500", "doTERRA Pro", "Healing Hands Foundation", and the whole post-card-sort IA are visible; that is the stimulus, but the file can be kept and forwarded forever.
- Prototype catalogue: 56 products with SKU, retail and wholesale price and status flags (14 Best Sellers, 6 "New Products": Lavender Peace, ZenGest Softgels, PB Restore, Verage Moisturiser, Laluz Diffuser, Sleep Collection). UNVERIFIED whether any of this is unreleased or non-public pricing; the owners should confirm.
- Unsplash image URLs in Pure avatar defaults appear as text only (blocked by the CSP and not fetched).
Not found: email addresses, usernames, local paths (`/Users/...`), tokens or keys (one regex hit, `AkIA3rtGO86tknhK`, is a fragment inside a base64 font blob and is a false positive), ticket or register ids, Figma urls or node keys (`480:1080`-style hits are CSS or font numbers), comments or `TODO`s, the design-system package name, the build machine or author. Moderator UI text is absent from the participant build (verified: no "Ledger", "Observed", "Sessions" list screens).
Fix: set the proto title and stub text to something neutral, strip PNG ancillary chunks, and decide whether a confidentiality line ("This prototype is confidential, please do not share it") and an expiry date belong on the setup screen.

### P-12 Info: silent loss when storage is blocked (private window)

Evidence: `saveProblem` and `persistent` are consumed only by `moderator/Shell.tsx`; the participant edition shows no "not saved" message. A participant on a private window who reloads loses the session without explanation. This is a privacy-positive failure mode but a data and trust problem; it also interacts with P-1 advice (recommending a private window on shared computers).
Fix: show a small notice on setup when storage is unavailable ("Reloading will lose your progress; do not close this window").

## 3. Checked and fine

- No network at runtime: CSP `default-src 'none'; form-action 'none'; base-uri 'none'`; zero non-file requests across full runs; prototype frame sandboxed with `allow-scripts` only, `window.open` stubbed; "Nothing is sent anywhere" is true.
- No cookies, no sessionStorage, no IndexedDB, no analytics, no remote fonts or images, no `sendBeacon`.
- No keystroke logging in the search box: only the submitted query is recorded.
- No user agent, locale, time zone, screen size or IP is captured or exported.
- No credentials, emails, paths or ticket and file ids in the built file; the moderator screens are not in the participant build.
- Code field restricted to `[A-Za-z0-9_.-]` (no `@`, so a full email address cannot be typed); sanitised import caps lengths and whitelists fields.
- CSV and JSON import defences exist for the researcher side (formula defusing, schema checks).
- Participants can stop at any time (End session) and "No thanks" is as prominent as "Yes" for reserve tasks.

## 4. Assumptions and limits

- UNVERIFIED: Safari, Firefox and mobile browser behaviour of `file://` storage and downloads; mail-client attachment blocking; whether the catalogue or IA is unreleased; whether WQA or doTERRA is the controller.
- Not legal advice. I assumed the researchers hold a code-to-person mapping from recruitment (so the data is pseudonymous, not anonymous).
- The 33 MB `downloads.html` in my scratch `dl` folder is a Chrome extension package (CRX header) that the headless browser's own component updater fetched into the download folder I had configured; it is browser behaviour, not the tool (the page's own request log stayed empty). My test browser therefore did make one background request of its own; I made none.
