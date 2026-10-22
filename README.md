# Wayfinding Check

A moderated first click test for the Storefront prototype. It builds to **one self-contained HTML file** that you open in a browser: no server, no hosting, no network. It embeds a duplicate of the navigation prototype (header, footer, mega menus, Rewards dropdown, mobile and tablet menu) carrying the post-card-sort IA the tree test holds (see `docs/INSTRUMENTATION-DIFF.md`) at desktop 1440, tablet 768 and mobile 402.

The file: `dist-single/wayfinding-check.html` (about 5.3 MB). Build it with `npm run build:single`.

Participants see the name **Wayfinding Check**, which keeps the method out of view. The tool now ships with the **combined test** (homepage, product page and navigation in one session of 50 minutes or less), from the "Combined test" plan in Figma. The earlier navigation-only test (12 tasks and 2 reserves, from the First Click Testing plan and the FigJam board) is kept: Content tab, *Load the navigation-only test*.

## The combined test

One session, one device, three blocks in a fixed order: **homepage** (C1 to C3), **product page** (C4 to C7), **navigation** (C8 to C11). Task allowances add to 34 minutes; with the welcome, debrief and buffer the plan is 44 core minutes, and the setup screen shows the estimate.

| Task | Block | Kind | What it reads |
|---|---|---|---|
| C1 First view | Homepage | observe | What the participant says the site sells and what is different (coded) |
| C2 Looking for proof | Homepage | click | First click for evidence of quality, scored by zone |
| C3 First product | Homepage | observe | Choosing a product; the first menu use is read here |
| C4 First view and icons | Product page | observe | Understanding the first view and the usage icons; arrival line differs by route |
| C5 What makes you sure | Product page | observe | Reviews, trust and doubt |
| C6 What would I pay | Product page | click | First click for the shipping information |
| C7 Two ways to buy, and choose | Product page | click | The account option and Add item to cart count as the intended route; the other buy choice is recorded on its own |
| C8 to C11 | Navigation | nav | Sleep, Cough, Savings, Income (the old T1, T2, T9, T10), scored as before on two levels |
| R1 best sellers, R2 no reviews yet | Reserves | observe | R1 is for mobile participants only; R2 uses the product with no reviews |

**Task kinds.** *nav* is scored on the link chosen (two levels). *click* is scored on the **first click**, by named zone of the page (the prototype tags each part of the homepage and product page with `data-zone`; the recorder reports the nearest one) or by a header route or the footer. *observe* is not scored: the first click is kept, and the participant's answers are coded by the moderator afterwards from short agreed lists (the Review screen). Observe tasks show only **Done** on screen, no "I found it" and no "I can't find it".

**Per participant.** The **device** is set from the number: odd desktop, even mobile, so twelve participants split six and six and every task runs on the session device (the moderator can override at setup). The **arrival route** cycles homepage, Google, shared link (four each across twelve, two on each device), and members from the WA and WC groups arrive by shared link, never Google. Arrival is a **sentence read before the scenario** (for example "You searched for lavender oil and chose this result"); no search results page or message is mocked up. A task can start on its own page: the product tasks open the product page.

**Order.** Homepage then product page tasks keep their plan order; the four navigation tasks follow, shuffled by the participant's number with Sleep and Cough never adjacent.

**Wording.** The opening cue of a scenario ("Before you scroll", "Before you scroll or click") shows in bold and the accent colour, on the participant's task card and in the moderator's review. A scenario is read before the page is on screen, so it names what it is about (dōTERRA Lavender essential oil, PB Restore) and never says "this" or "these"; a unit test enforces it. The after-task question is "Overall, how easy was it to know where to start?" for navigation tasks and "Overall, how easy was it to complete that task?" for the rest.

**What the participant gives.** After a task that asks it they rate **confidence from 1 to 7**; every task asks the ease question and an optional note. The moderator can log a **doubt**: where on the page it arose, and a short note.

**What you read.** The Ledger adds first click zone, coded answers, mean confidence and doubts per task, and marks observe tasks "Not scored". The CSV adds `arrival`, `first_zone`, `zones_clicked`, `confidence`, `coded_answers`, `doubt_zone` and `doubt`, and the Markdown export has a coded-answers section.

**Known limits.**
- Add to bag does not exist in the prototype; the product page's Add item to cart only confirms.
- The Google and shared-link arrivals are text only.
- Product B (R2) has no reviews on purpose; other product copy, reviews and FAQs are invented stand-ins (see `docs/INSTRUMENTATION-DIFF.md`).
- Time allowances are estimates until a pilot.
- Saved content lives in the browser. A saved copy that is exactly an earlier default is replaced by the current default on load; anything you have edited is kept until you press *Reset to the combined test*. Add the fingerprint of the old default to `SUPERSEDED_DEFAULTS` in `src/shell/domain/storage.ts` whenever the default wording changes. A session keeps the content it started with, but a session begun on a superseded default takes the current participant-facing wording for tasks not yet started (tasks already run keep the words the participant read; targets are untouched).

## Running a session

Open the file in **Chrome or Edge** on a desktop machine. Make the window at least 1440 wide for a true-size desktop frame; if it is smaller the frame is scaled down to fit (the layout stays at the true breakpoint, and the moderator sees the size on the review screen). Do not use a private window: nothing would be saved.

1. **Sessions > New session.** Enter an ID only (P1, P2 and so on; never a name) and check the task list. The tool plans the **breakpoint for each task** (see below); change any on this screen if the test needs it. Press *Hand over to participant*.
2. **Participant** sees a welcome, then the first scenario **on its own, with no website**. On that first scenario only, a **two-step onboarding tour** appears a beat after the screen loads (as in the Tree Testing and Card Sort tools: a spotlight on the scenario, then on Begin; Skip or Esc closes it), and the time it is open is left out of the reading time. Pressing **Begin** slides the task to a banner at the top and the website appears below, ready to use. The task ends when they click a destination link or submit a search, or press *I found it* or *I can't find it*.
3. **Participant rates** "Overall, how easy was it to know where to start?" (1 to 7) and can add notes in their own words. The next scenario follows straight away: **the device stays with the participant until the last task**, with no hand-back and no moderator screen between tasks. Each task counts as soon as it is rated.
4. **Hand-back once, at the end:** after the last task the participant sees a thank-you and hands the device back. *Researcher: continue* opens the debrief. The participant can also stop themselves: on the screen between tasks, a text link **End session** (below the next-scenario button) asks "End the session?" and, if confirmed, shows the hand-back screen. Everything already rated is kept and the session is marked ended early. *End early* (Ctrl+Shift+M) is the moderator's route and is always available: tasks already rated are kept and count; the one in progress is recorded as interrupted and does not.
5. **Reserve tasks (optional), offered to the participant.** After the last main task the participant is asked whether they would like to try another ("No thanks, I'm finished" is as prominent as "Yes, show me another"). If they accept they get one reserve task, and are asked again after it. The moderator is not involved and the reserves are not chosen at setup. Nothing is offered after an early end or once the reserves have run out. Reserve tasks are labelled "One more scenario" rather than numbered.
6. **Debrief** at the end: notes, and a JSON backup downloads when you finish (untick to skip).
7. **Findings, whenever you like.** Nothing has to be recorded during the session. From the debrief screen or the **Ledger** (list at the foot, "Add or edit findings", grouped by participant), open any completed run to see everything captured automatically, the suggested tier and wrong-click code, and to override and record Observed, Interpretation, what they expected and where else they would have looked. This works the same days later or after importing a backup. The Ledger counts the tool's suggestion until you add findings for a run; your choice then replaces it, and the Reviewed column shows how many runs for each task have findings.

**Ctrl+Shift+M** on any participant screen, including while their focus is inside the website, opens a small moderator menu (end the session early), so a session can be stopped without handing the device back. The end buttons in the task banner stay disabled until the website has loaded, so a double-click on Begin cannot end a task by accident.

**Keyboard shortcuts** (the keyboard icon in the header, or **?**, lists them): **1 to 4** switch between Sessions, Ledger, Content and Preview (while the tabs are showing), **T** toggles light and dark, **Ctrl or ⌘+S** saves the Content tab, **Enter** presses the main button, **Esc** closes a dialog. The header is one fixed width on every screen, so it does not move when you change tab. In the Preview tab, choosing a breakpoint restarts the prototype at that size, so the recorder log begins with its own "Menu ready (width x height)".

### Tabs
- **Sessions**: every session, resume or view, delete, download all, import.
- **Ledger**: per task and breakpoint, with a Reviewed column and a list for adding findings (each participant once per task, even if their ID was run more than once: the newest session wins; titles and targets come from what each session actually ran, so editing Content never drops or merges results, and a row says when it mixes content versions), the Level 1 and Level 2 counts, verdict, median time to first interaction, mean ease, confident-wrong count, prompts, final column (for duplicated answers) and misread sections. Exports Markdown, CSV (one row per run) and JSON.
- **Content**: the 13 tasks of the combined test as JSON (11 core, 2 reserve), plus the debrief prompts and the one-device-per-participant switch. *Load the navigation-only test* and *Reset to the combined test* swap the whole set. In the navigation-only test T11 and T12 are the **footer tasks**: their answers (Contact doTERRA, Returns Policy) live only in the footer, and Help is recorded separately for both. They never come first in a session (the first task is where H6, menus opening unaided, is read), and for roster participants they are placed among the board's ten tasks without changing the board's order for those ten. They are tagged H7, a new hypothesis: support and policy content can be found from the footer. Validated before saving (every target link must exist in the navigation or footer; a zone is a lowercase name; observe tasks have no targets; code ids unique with 2 to 12 options; ids unique; no em dashes) and versioned. Each session keeps a copy of the version it started with, so editing never rescores old sessions.
- **Preview**: the prototype at each breakpoint with a live view of what the recorder reports. Use it to rehearse. Nothing is saved.

## Participant edition (self-run)

`npm run build:participant` builds a second file, `dist-single/wayfinding-check-participant.html`, for sending to a participant to do on their own. A public file needs three settings, and the build refuses to make one without them: `WC_SEND_TO` (where participants send the file and ask to see or delete their results), `WC_CONTROLLER` (who runs the study) and `WC_RETENTION` (how long results are kept), for example `WC_SEND_TO=research@example.com WC_CONTROLLER="Example Ltd" WC_RETENTION="12 months" npm run build:participant`. They appear in the privacy notice on the setup screen and on the finish page. Setup also asks the participant to confirm they are 18 or over. For local testing only, `WC_ALLOW_MISSING=1` builds without them and shows "[organization not set]" placeholders.

What the participant gets: one setup screen (what to expect, their code, whether they are a member), straight on to the scenarios with the onboarding tour on the first, and at the end a page where they add an optional note and **Save my results** (or **Copy instead**, for browsers that block downloads). They never see tabs, the shortcuts panel, the theme button, a hand-back screen or any moderator wording, and Ctrl+Shift+M does nothing. If they close the window part-way through, reopening the file carries on where they were; ending early (the End session link) goes to the same results page.

The setup screen carries a privacy notice, an "I am 18 or over" statement and the three build settings above; the participant edition cannot be built for the public without them.

The saved file is named `doterra_research_<code>_<date>.json` (for example `doterra_research_P7_2026-10-16.json`), so it is easy to spot in a downloads folder or an inbox.

What you do with it: open the file you received in the full tool, **Sessions > Import sessions (JSON)**. A **review** opens first, before anything joins your Ledger. It shows the file name and its SHA-256 fingerprint and each session in it, and notes anything that looks wrong, which then defaults to **Skip**: a code that already belongs to another session (including look-alikes such as `p3`), two sessions with the same code in one file, a session you have already added findings to, tasks this tool does not have, or scenario wording that differs from yours. A participant file is never believed about itself: its answer key is replaced by this tool's own tasks (the review says so), any findings, tier or reviewed marks in it are discarded, "practice" is ignored, and which of two files is newer is decided by when you imported them, not by the date a file claims. Files are limited to 100 sessions and a code of letters, numbers, dots, dashes and underscores; the import is all or nothing and refuses to fill the browser's storage. After importing, the session appears marked *(self-run)* with the file it came from, with the participant's code and group, and everything in the Ledger works as for a moderated session: add findings from the run list, export CSV (a `self_run` column tells the two kinds apart). The breakpoint for each scenario is planned from the code exactly as in the full tool, so give each participant their own code (P1, P2 and so on) to keep the rotation balanced.

Differences to keep in mind when you read self-run results: nobody is there to prompt, so *needed a prompt* is never coded; there is no think-aloud, so the participant's own notes and final note are all the "why" you have; and Level 1/2 and timings are measured the same way but without a moderator to catch a dead end. The tasks are the ones built into the file, so edit the Content tab and rebuild if they need to change. The file works from a download or an email attachment, not from the artefact viewer (which blocks the save).

## Breakpoints per task

*Applies to the navigation-only test. The combined test runs every task on the participant's one device (see above).*

Each participant does all their tasks in one session, and the frame **switches breakpoint per task**.

- A task that lists one breakpoint in the Content tab (the four desktop-only tasks, T2, T4, T6, T8) always runs there.
- A task that lists several (T1, T3, T5, T7, T9, T10, T11 and T12 list desktop, tablet and mobile) is rotated across exactly the breakpoints it lists, by the participant's number, so across participants each is seen about equally at each and each person gets an even mix (every participant has two or three of these eight at each breakpoint). There is no tablet switch at setup: a task runs at tablet because its content lists tablet, so change which tasks need it in the Content tab.
- Nobody does the same task twice, and the plan is fixed with the order when the session starts. The moderator can override any task on the setup screen, but only to a breakpoint the task lists.
- Each run records its own breakpoint and its place in the session, and the Ledger tallies by each run's breakpoint, never pooling the three. A person can appear in more than one table (different tasks), never twice for the same task.

**What this costs you.** Because each person does a task at only one breakpoint, ten participants give about three or four per breakpoint for each of the eight tasks that run on all three, and ten for the four desktop-only tasks. Plan for roughly thirty participants if you want about ten in every cell, and read smaller cells as directional. People also meet the navigation on desktop before some of their mobile tasks (or the other way round), so a task met later has been preceded by more of the structure; the Ledger shows each task's mean position so you can see how much that matters.

## How results are scored

- **Level 1, section**: the first menu the participant held open for 0.3 s or more (Pure itself waits 150 ms before opening a menu on hover). If none stayed that long, the section of the final click. On mobile and tablet, the first section row opened. The raw first menu to open is kept and shown beside it, so a mouse sweeping past Shop on the way to Learn is visible but not scored as a choice.
- **Level 2, destination**: the link that ended the task, compared by href with the task's targets.
- **Click and observe tasks** (combined test): a click task takes the tier of the **first click** by zone or route (Primary, Acceptable, Incorrect; a choice we record on its own is S); no click at all is Incorrect with code 6. An observe task is always R (recorded only) and is read from the coded answers, confidence and notes.
- **Tier**: **P** Primary, **A** Acceptable, **X** Incorrect, **R** Recorded only (a search is behaviour, not a miss), **S** Recorded separately (a plausible answer whose page content is unconfirmed, such as Source to You). A footer link that matches a target counts as that target and is flagged.
- **Wrong-click code**: 1 wrong section, 2 right section wrong column, 3 right column wrong link, 4 search, 5 footer, utility or other, 6 no destination reached. "Needed a prompt" (code 7) is the moderator's *menu opened unaided / after a prompt* answer.
- **Verdict**: Pass at 80% or more, Watch at 60 to 79%, Fail below, on the **worse** of the two levels, with the counts beside the percentage. Search and S runs are reported but not in the denominators. These thresholds are proposals (decision D4).
- The moderator can override the tier, code and Level 1 on every run. The recorded suggestion is never overwritten, and the override and its reason are exported.

## What it does and does not tell you

- Samples are small, so results are directional, and the Ledger says so. Desktop, tablet and mobile are never pooled, and each cell holds about a third of the participants for a task that lists all three (see above), so plan the sample with that in mind.
- Tablet and mobile frames test how the **layout is understood**. A click in those frames is recorded as a tap, but touch ability, tap-target size and thumb reach are not tested.
- The prototype runs on a desktop machine with a mouse, whatever the breakpoint shown. Pure's desktop menus open on hover.
- Timing starts when the website is ready after Begin, not when the task is read. Reading time is recorded separately.
- A reload during a task cannot resume honestly, so that attempt is marked interrupted and the task is shown again as the next attempt; the debrief flags the interruption.
- There is no lock between the participant and the moderator screens: "Researcher: continue" on the last hand-back screen opens the debrief, which lists the tasks, and from there the findings screen shows each task's targets. Hand the device back before the participant presses it, as the screen asks.

## Your data

**Clearing saved data.** *Sessions > Clear this test's saved data* (moderated tool) and *Clear my progress in this test and start again* (participant edition, on the setup, between-scenario and results screens) delete only what this tool saved: its sessions and any task edits from the Content tab. They never touch other browser data (history, cookies, passwords, other sites or other tools), each is behind a confirmation that says so, and the tool then reloads on the built-in tasks. The moderated dialog offers a backup download first. Use it when an old session or saved copy of the tasks is showing out-of-date wording.

- Sessions are stored in **this browser's local storage** as you go (after every step; high-frequency events are saved within 0.4 s). There is no server and no account.
- A **Saved** time shows at the top of every moderator screen. If the browser refuses to save (private window, blocked site data, storage full) a red banner says so, and you should download a backup.
- **Back up after every session** (it downloads at Finish unless you untick it). The JSON imports on any machine to continue or to combine results; imports are sanitised and suggestions are recomputed from the raw events.
- Local storage is per browser, and Chrome shares it between every local HTML file opened from `file://`, whatever its folder. A different browser starts empty; import a backup to bring sessions across. A hosted address gets its own storage.
- Participants are IDs only. Notes are free text, so do not record names. CSV cells that start with `=`, `+`, `-` or `@` are defused for spreadsheets, and the CSV carries a byte-order mark so Excel reads accents correctly.
- The page carries a Content-Security-Policy that allows nothing but inline code and data, so the browser blocks the ordinary ways of reaching the network (fetch, XHR, images, fonts, forms, frames, navigation), from the app and from the prototype frame. It is a meta tag, so it does not cover prerender link hints or WebRTC, and it allows inline script; nothing a participant, a URL or a file can supply was found to run script in the page or the frame (see `docs/SECURITY-AUDIT.md`).

## Building from source

```bash
npm run typecheck          # tsc, plus a stricter pass on the domain code
npm test                   # 153 domain tests (node --test, no extra dependencies)
npm run build:single       # builds the prototype copy and the shell, folds them into one HTML file
npm run check:original     # proves the original Navigation Prototype source is unchanged
npm run e2e                # see below
```

Installing dependencies needs the `@doterra-it` GitLab token (as for the prototype); **running the built file needs nothing**. In this checkout `node_modules` is a symlink to the Navigation Prototype's, so building works only while that folder is present; run `npm install` here (after removing the symlink) for an independent copy. `build:single` fails rather than ship a file that would reach for the network, include a `<link>` or remote script, keep a Raleway font, reference the live catalogue, or exceed 6 MB.

The end-to-end checks drive headless Chrome with real mouse events against the built file (`WC_FUZZ=full` sweeps every link):

```bash
node scripts/e2e/frame-check.mjs      # file:// load, sandbox, three breakpoints, no network, fonts
node scripts/e2e/recorder-check.mjs   # recorder messages and link coverage sweep
node scripts/e2e/pdp-check.mjs        # the product page, its cards and its zones
node scripts/e2e/session-check.mjs    # a full moderated session, resume, mobile, reduced motion
node scripts/e2e/a11y-check.mjs       # accessible names, headings, focus, contrast
```

(The test browser turns site isolation off so the debugger can read the sandboxed frame. The shipped file has no back door.)

## Structure

- `src/proto/`: the duplicated prototype. See `docs/INSTRUMENTATION-DIFF.md` for the exact differences from the original.
- `src/shared/`: the message protocol and the href lookup, shared by the frame and the shell.
- `src/shell/domain/`: pure logic with tests: tasks, content validation, seeded orders, scoring, session reducer, Ledger, exports and import, storage.
- `src/shell/`: the app. `participant/` and `moderator/` are the two surfaces, chosen by the session's phase (never by the address, so the participant cannot reach a moderator screen with the back button).
- `scripts/`: the build, the original-unchanged check and the end-to-end checks.
- `tests/`: domain tests, including a golden file of the task orders read from the FigJam board.

## Decisions still open from the plan

- **D1 scale**: moderated only for now.
- **D2 instrumentation**: built in (this tool).
- **D3 search**: clicks are allowed and recorded.
- **D4 thresholds**: 80 and 60 percent are proposals; the high-risk list is T1, T2, T9, T10.
- **D5 recruitment**: customers including member groups (WA, WC), none from the card sort or tree test. Hosting is not needed.
- **D6 touch**: dropped. Click is read as tap; touch ability is out of scope.
