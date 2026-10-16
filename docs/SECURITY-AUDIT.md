# Security audit: participant edition, public release

16 October 2026. File audited: `dist-single/wayfinding-check-participant.html` (3,341,208 bytes, SHA-256 `5d11bd0f50b66086fe85c240730e5950dc945f245f2b57d3ca6fdf0c232f45b0`), built from commit 0ed23f3 plus uncommitted theme changes.

Method: four independent reviewers (Security Specialist role) each took a different attack angle, were given the code and scope but none of the team's conclusions, and tried real attacks in headless Chrome and against the real code. Their full reports, with every payload and result, are in `docs/security-audit/` (`redteam-1-device.md`, `-2-privacy.md`, `-3-return-path.md`, `-4-supply-chain.md`). The team then re-checked the headline claims against the built file. Threat context assumed: UK GDPR, members of the public as participants, consumer-grade attackers plus a hostile participant. This is not legal advice.

## Decisions and status (16 October, after the team's response)

| # | Decision | Status |
|---|---|---|
| 1 Answer key in the file | Accepted: the audience is not advanced users and anyone cheating the tasks will show up in the data. | No change. |
| 2 Answers replayed on a shared browser | Accepted: participants are remote from each other, each on their own device. | No change. (The shared-profile case remains for anyone who reuses one browser; the README now says so.) |
| 3 Privacy notice, age statement, send-to | Required. | **Done.** Setup shows a notice (who runs the study, what is recorded, why, retention, how to ask for deletion, a warning about names and health details), an "I am 18 or over" tick, and "by pressing Start you agree". The build refuses a public participant file without `WC_SEND_TO`, `WC_CONTROLLER` and `WC_RETENTION`. Wording needs a DPO's review. |
| 3a Audience | **Primarily US** (stated 16 October). The audit assumed UK GDPR; for a US audience the questions a lawyer will ask change. | Wording of the notice checked for US readers: no UK spellings or UK-only references, adults only (18 or over; the age of majority is 19 in Alabama and Nebraska and 21 in Mississippi, which counsel may want reflected). Values supplied: send-to usability@doterra.com, controller doTERRA International, LLC, retention 12 months. **Open for counsel:** whether doTERRA must give a California-style notice at collection (categories, purposes, retention, and whether results are sold or shared; the notice does not currently say either way, because that is a promise only doTERRA can make); US state consumer-health-data laws (for example Washington's), which is why the notice and the note and search boxes warn people not to type health details; and any EU or UK participants, who would bring GDPR back into scope. Not legal advice. |
| 4 Redistribution rights | The client is the rights owner and the study is run for them. | Closed as an owner decision. Still worth a written note of approval from the client. |
| 5 Hostile results files | Needs attention. | **Done in the researcher's tool**, see below. Not done: an allow-list of issued codes. |

### What was changed for item 5 (hostile files)

Plain version: the Ledger used to believe whatever a results file said about itself. A stranger could send a file claiming to be P3, made tomorrow, with its own idea of the right answers, and it would silently replace the real P3 and score full marks. Now:

- Every import opens a **review** showing the file name, size and SHA-256 and each session in it. Anything that looks wrong starts on **Skip**: code already in use (case-insensitive), two sessions with one code in a file, a session whose findings would be overwritten, tasks this tool does not have, scenario wording that differs. Nothing changes until you press Import, and it is all or nothing.
- A participant file is **scored against this tool's own tasks** (the review says when its answers differed), and anything it says about the moderator's work (tier, code, findings, reviewed, practice) is discarded.
- **Newest** is decided by the time the tool imported a file, never the date inside it. Imported sessions record their source file and fingerprint, shown in the Sessions list.
- **Limits:** 100 sessions per file, 60 tasks per file, codes limited to what the participant edition can produce (look-alike and invisible characters are refused), completed runs must have been begun, ended and rated, numbers and times are clamped, duplicate run ids are dropped, and an import that would crowd out the browser's storage is refused.
- The Ledger now builds its index once (8,000 sessions take 6 ms; before, 11 s), the Markdown export escapes every character that could start a link, image, HTML or code span and every kind of line break, and a section named `__proto__` no longer crashes Review.
- Tested with crafted files in the real built tool (`scripts/e2e/import-check.mjs`) and with 13 new unit tests (`tests/importreview.test.ts`).

Open from the audit (not part of this round): hosted https delivery and headers, CSP script hashes, the lockfile and clean-clone build, licence notices, silent save failures in the participant edition, and an optional list of issued codes so unknown codes are flagged.

## Verdict

**Nobody found a way to make the file harm a participant's device.** Across 70+ attack attempts (sandbox escape, script injection through every input, message spoofing, network exfiltration, navigation, popups, downloads, permissions, resource exhaustion, tampered storage), no attacker script ran in the page or the frame, and a full 14-scenario run made zero outside requests. No secrets, tokens, email addresses, local paths or source maps are in the file or the git history.

**It is not ready to share with the general public yet.** The serious problems are not about the participant's device. They are: the file gives participants the answer key; it leaves one person's answers for the next person on a shared computer; it has no privacy notice; the redistribution rights for the design system and brand assets are unconfirmed; and strangers can send you files that quietly rewrite your study's conclusions.

Limits: Chrome on macOS only (Firefox, Safari, Edge, mobile untested); no mail gateway or client tested; legal and licence positions are questions for the owners, not conclusions.

## Findings, consolidated and ranked (public release)

### Critical
None.

### High (fix or decide before any public sharing)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 1 | **The participant file contains the answer key and research design**, and every results file carries it again. | Verified in the built file: 14 tasks with primary/acceptable targets, 16 `watchFor`, 17 `needBack`, hypotheses H1 to H7, `highRisk`, notes such as "the link was removed from there... is the test of that removal". About 22 KB of each 34 KB results file is this content. Also visible in the "Copy instead" box. | Participant build and export keep only id, title, scenario, breakpoints. Re-score at import against the tool's own content (matched by version or hash). Build fails if `watchFor`, `needBack`, `hypotheses`, `primary`, `highRisk` appear in the participant output. |
| 2 | **Finished sessions persist and are replayed to the next person on the same browser**, who can read the notes and save them as their own. Nothing can be deleted. | Verified: A ends with a note and does not save; B opens the file in the same profile and lands on A's results page and can download A's file. "Start a new session" does not delete. Chrome shares `file://` storage across every local HTML file, so a neighbouring file can read or rewrite it too. | Do not auto-open ended sessions. Delete after a successful save and on "Start a new session". Add "Remove my answers from this browser". Only resume sessions this edition created. Correct the README ("per file location" is wrong). |
| 3 | **No privacy notice, controller, lawful basis, retention, rights, contact, or age statement**; the return address is blank. | Verified: the only wording is "Nothing is sent anywhere... send it to us". No scenario screen, no consent or withdrawal text. Scenarios involve sleep, coughs and a toddler, so free text can become health data. | Add a short notice and an "I am 18 or over" tick on setup; name the controller; give the contact and a right to stop and delete; bake in `WC_SEND_TO`. Get a DPO to approve wording (suggested text is in the privacy report). |
| 4 | **Redistribution rights are unconfirmed** for what the file ships. | Pure design-system packages (ISC, author "WQA", no licence file, private registry), the doTERRA wordmark, six product pack-shots, trademarked product names with prices and SKUs, the unreleased navigation structure, Plus Jakarta Sans, and the full Pure icon set (1,172 icons; licence unverified). | Owners confirm in writing: Pure copyright and permission to ship compiled code; doTERRA approval for logo, products and photos; whether prices and SKUs are invented; whether the unreleased IA may be public; wording for the claims-adjacent scenarios. Trim the icon set to those used. |
| 5 | **A hostile results file can reverse your conclusions or fill your storage.** Relevant if anyone can submit a file. | Verified in the built moderator tool: reusing codes P1 to P10 with a late `createdAt` flipped every result from Fail to Pass, with only "10 new" as feedback; 40 fake participants moved 14 of 27 rows; altering the file's embedded task targets turned 12 wrong clicks into 12 correct; runs with no events and a forged `tier` showed "Pass, Reviewed 1 of 1"; a 4 MB file persisted 8,927 junk sessions and made later visits take 5.7 s and fail to save. | Order by a tool-assigned import time, never the file's. Blocking import review that flags duplicate codes and shows provenance. Re-score from the tool's own content and strip moderator fields from participant files. Issue unguessable codes and reject codes not on your list. Cap sessions, tasks and bytes; make import all-or-nothing; add "delete this import batch". |

### Medium

| # | Finding | Fix |
|---|---|---|
| 6 | **Emailing an `.html` attachment to the public is the weakest delivery route**: it has the shape mail gateways quarantine (3 MB inline script, base64, Blob download), trains people to open HTML attachments, can be copied with a changed send-to address, and cannot be verified. | Host the participant edition at an https address you control, send a link from an authenticated sender, publish the SHA-256. Header list in the supply-chain report. |
| 7 | **Return path by email is unencrypted and retained**; the file name reveals project, code and date. | Hosted upload or form with a notice, or a dedicated mailbox with auto-delete and an auto-reply notice. |
| 8 | **Free text and search queries are stored and exported verbatim** with no warning (verified: a typed query naming a child, phone number and email was captured, twice). | Caution text at every note box and in the search; drop the duplicate query in `route`; offer to remove notes. |
| 9 | **A re-imported session with the same id erases your findings** (note and reviewed flag lost, message says only "1 updated"). | Never replace a session that has findings without confirmation. |
| 10 | **The Ledger freezes on crafted files** (a 24 MB single-session file froze it for 54 s; 8,000 sessions took 11 s). | Use a Set and index counted runs once; memoise. |
| 11 | **The Markdown export carries attacker text** (task titles and section keys pass through with only `|` escaped, so links, image beacons and HTML survive). | Take titles from the tool's own tasks; escape Markdown and HTML and all line terminators. |
| 12 | **The shipped file cannot be tied to a commit or locked dependency set**: uncommitted code was in the bundle, no lockfile, `node_modules` is a symlink into another repo, no CI, no recorded hash. | Commit first; add a lockfile; build from a clean clone with `npm ci`; record hash and commit; tag the release. |
| 13 | **Dependency-confusion exposure**: no `.npmrc` mapping the private `@doterra-it` scope; the public registry returns 404 for those names (scope ownership unknown). | Reserve the scope, commit `.npmrc` (token via environment), declare `ws`. |

### Low and informational

- **CSP is weaker than the README says.** Verified from inside the frame: a prerender link and WebRTC can still reach out, and `'unsafe-inline'` gives no second defence. Both need script in the frame, which nobody could reach, so this is defence in depth. Fix: script hashes instead of `unsafe-inline`, Trusted Types, `allow=""` and `referrerpolicy` on the iframe, correct the README.
- **The frame is a trusted peer** (only matters if script ever runs in it): it could overwrite the clipboard on a real click, flood messages (5,000 froze the shell 1.4 s), or forge events in the participant's own file. Fix: rate-limit and drop over-cap messages before cloning.
- **Hosted behaviour:** needs https; set `frame-ancestors 'none'`, nosniff and the other headers at the host; a blank page appears under a stricter host CSP.
- **Save failures are silent for participants** (private window, blocked or full storage: progress is lost on reload with no warning). Show a banner and prompt a save.
- **Membership question** is mandatory and stored; group could be derived from the code at import. **Behavioural signals** (frame scale, per-click coordinates, epoch timestamps) go beyond what analysis needs.
- **Robustness:** `__proto__` as a section crashes Review for that run; participant codes are not normalised (look-alike characters count as separate people); unbounded numbers; duplicate run ids misdirect findings. CSV defusing works for the standard characters; quote every field for spreadsheets in other locales.
- **Housekeeping:** missing licence notices (Radix, floating-ui, Plus Jakarta Sans, Pure); known advisories on react-router 6.30.6 with low exposure here (MemoryRouter in a sandboxed frame, static hrefs); the embedded title still says "Storefront Navigation Prototype" and the stub home says search is not part of the build; six remote image URLs remain inside token strings (never fetched); repo commits carry the author email and a FigJam board key sits in a test file.

### Checked and found fine
No network at runtime (measured with a local canary server, not just logs); sandbox held against every escape tried; postMessage nonce and source checks held; no HTML sink except static SVG; no `eval`, `new Function`, WebSocket, `sendBeacon` or `javascript:` in the bundle; XSS payloads in the search box, notes and tampered storage render as text; downloads are safe-named; `WC_SEND_TO` injection is rejected or escaped across 22 hostile inputs; the 25 MB import limit holds; a bad import does not delete existing data; no cookies, analytics or remote assets; moderator screens are absent from the participant build; no live catalogue data (56 dummy products).

## Recommended order of work

1. **Code, before any public sharing** (items 1, 2, 3 and the save-failure banner): strip the answer key and content from the participant build and exports; delete data after saving, never replay finished sessions, add "Remove my answers"; add the notice, age tick and free-text cautions.
2. **Code, before importing any file from a stranger** (items 5, 9, 10, 11 and the robustness items): import review with provenance and collision warnings, tool-ordered, tool-scored, capped and all-or-nothing, findings protected, Ledger made linear, exports escaped.
3. **Build and release hygiene** (items 12, 13, CSP hashes, notices): commit, lockfile, clean build, recorded hash, tag.
4. **Decisions and confirmations that are not code** (items 4, 6, 7): licence and brand sign-off, hosting and headers, the return channel, DPO review, recruiting adults only, issued codes.

## Decisions needed from the team
- Hosted link or emailed file? (Recommended: hosted https link.)
- Who is the controller and what contact and send-to address goes on the file?
- Is the study open to anyone, or to invited people with issued codes? (Issued codes sharply reduce item 5.)
- Who confirms the licence, brand and unreleased-content questions in item 4?
