# Red team 3: the return path (hostile results files)

Role: Security Specialist, hostile member of the public who knows the tool. Scope: what a stranger can do with a hand-crafted `doterra_research_<code>_<date>.json` that the research team imports into the full moderator tool (`dist-single/wayfinding-check.html`).

All scripts and crafted files are in `scratchpad/rt3/` (not in the project). Project folder untouched. Domain tests ran with `node --experimental-strip-types`; UI tests drove headless Chrome (fresh profile each run) against the BUILT `dist-single/wayfinding-check.html` from `file://`, via the project's `scripts/e2e/cdp.mjs`. The built file contains the same `csvEscape` as the source (checked by grep).

Method note: other agents share the parent scratchpad, so my files live in `rt3/`.

## Summary of findings

| ID | Severity | Title | Status |
|---|---|---|---|
| R-1 | High | One hostile file silently replaces genuine participants' results or adds unlimited fake participants | VERIFIED |
| R-2 | High | Scoring inputs are taken from the file itself (task snapshot, moderator overrides, "reviewed", event-less runs) | VERIFIED |
| R-3 | High | A small file can fill browser storage with junk, persistently, freeze the Ledger and stop real work being saved | VERIFIED |
| R-4 | Medium | Same session id with a later `updatedAt` silently erases the researcher's findings | VERIFIED |
| R-5 | Medium | `ledger()` is quadratic: a 24 MB file freezes the Ledger tab for about 54 s | VERIFIED |
| R-6 | Medium | Markdown export carries attacker text (links, images, raw HTML, lone CR) into a document the team shares | VERIFIED as strings, rendering UNVERIFIED |
| R-7 | Low | `__proto__` as a section id crashes the Review screen (React error 31) | VERIFIED |
| R-8 | Low | Participant ids are not normalised: zero-width, trailing space, case and homoglyph ids count as different people; bidi controls spoof the list | VERIFIED |
| R-9 | Low | Unbounded numeric fields give nonsense Ledger values (`1.1e+307`, `Infinity`) | VERIFIED |
| R-10 | Low | Duplicate `runId`s inside a session send findings to the wrong run | VERIFIED |
| R-11 | Low | Participant edition opened on the researcher's machine resumes into the newest imported session | VERIFIED |
| R-12 | Info | `file://` storage is shared by every local HTML file in Chrome (README says per file location) | VERIFIED |
| R-13 | Info | Prototype-key participant codes (`constructor`, `__proto__`) make `createSession` throw | VERIFIED (domain), UI UNVERIFIED |
| R-14 | Info | CSV defuse is correct for the standard set; residual cases are speculative | UNVERIFIED (no spreadsheet available) |
| R-15 | Info | Download file names built from imported participant ids are safe in Chrome | VERIFIED |
| R-16 | Info | Opening an imported session in a participant phase shows participant screens and mutates it | VERIFIED |

---

## Code references (source, `src/shell`)

- `domain/exports.ts:110-153` `sanitiseSession`, `:84-107` `sanitiseRun`, `:71-82` `sanitiseModerator`, `:176-186` `mergeSessions`, `:23-28` `csvEscape`, `:195` `cell`, `:197-215` `ledgerMarkdown`.
- `domain/content.ts:35-73` `validateContent` (called with `checkLinks:false` at `exports.ts:113`).
- `domain/ledger.ts:80-92` `countedFor`, `:146-156` `ledger` (`ids.includes` at `:149`).
- `state.tsx:150-156` `importSessions`; `moderator/Home.tsx:12,23-34` import and 25 MB check.
- `moderator/Review.tsx:23-27,54`; `format.ts:16,40-51`; `moderator/Debrief.tsx:16-17`.
- `shared/protocol.ts:88-124` `parseProtoMessage`; `shared/navIndex.ts:26` `SECTION_LABELS`.

---

## R-1 (High): no authenticity, no collision handling, no cap on participants

**What the code does.** `sanitiseSession` validates shape only. The Ledger keys a participant by `s.participantId || s.id` (`ledger.ts:84`) and the newest `createdAt` wins per task (`:88`). `createdAt` is whatever the file says, clamped only to now + 1 day (`exports.ts:122,146`). Nothing compares an incoming participant code with existing ones. There is no limit on sessions per file. The import message is only "Imported: N new, U updated, K already up to date".

**Test harness.** 10 genuine participants P1 to P10, all wrong on every task (a "bad IA" result), 12 tasks each, built through the real reducer.

**Attack A: 40 fake participants in one file** (`a2_integrity.mjs`).
Payload: 40 sessions `P100..P139`, perfect runs, `createdAt = now - 1000`.
Observed: `added=40 updated=0 kept=0`. Counted participants 10 to 50. T1 desktop went from 3/3 Fail (L2 0/3) to n=16, L2 13/16, verdict **Pass**; T2 desktop to n=50 L2 40/50 Pass. 14 of the 27 Ledger rows moved out of Fail (10 to Pass, 4 to Watch).

**Attack B: reuse codes P1..P10 with a future `createdAt`.**
Payload: 10 sessions with `participantId: "P1".."P10"`, new session ids, `createdAt = updatedAt = now + 86 400 000 - 5`, perfect events.
Observed: `added=10 updated=0 kept=0` (message "10 new, 0 updated, 0 already up to date"). Every row n unchanged but L2 went from 0/n to n/n, verdict Fail to Pass for all T1/T2/T3/T4/T11/T12 cells. The genuine sessions stay in the Sessions list (20 rows, two "P1") but contribute nothing to the Ledger. Nothing on screen says a code was reused.

**Attack H: delete a cell.** Same as B but each hostile run is moved to tablet. T1 desktop n=3 (genuine) became n=0, tablet n=10 Pass. A single file can empty a breakpoint cell.

**Attack C: far-future `createdAt`.** `9e15` clamps to now + 86 400 000 ms. Clamp works as designed but one day ahead is enough to beat every genuine session.

**UI proof** (`ui9_attack.mjs`, built file): genuine P3 (all wrong) imported, then hostile P3. Ledger before: `T1 ... 0/1 (0%) Fail`. After: `T1 ... 1/1 (100%) Pass, Reviewed 1 of 1`. Message after the hostile import: "Imported: 1 new, 0 updated, 0 already up to date." The Ledger lede still reads "1 counted participant". Regex search of the Ledger text for `imported|provenance|duplicate|clash|already exists|source` found nothing. The findings list shows "P3, 24 tasks, findings on 12" with both sessions merged under one heading and no indication which one feeds the Ledger.

**Real-world impact.** One email attachment of about 100 KB to 5 MB can reverse the study's conclusions, or hide a genuine participant, with no trace in the UI. Participants' codes are short and guessable (P1, P2...).

**Fix.**
1. Never trust file-declared `createdAt` for precedence. Order by a tool-assigned `importedAt`, and never auto-replace on a code collision. Show a blocking review step at import listing each incoming session (code, n tasks, selfRun, createdAt) and any collision with existing codes; require an explicit "repeat" / "replace" / "discard" choice.
2. Issue unguessable codes (for example `P7-K3QF9`) and keep an allow-list of issued codes in the moderator tool; reject unknown codes at import.
3. Normalise codes before comparing (trim, NFKC, strip zero-width and bidi controls, case-fold).
4. Cap sessions per import (for example 50) and per store.
5. Record provenance per session (source file name, SHA-256, import time, batch id) and show it in the Sessions list; add "delete this import batch".

---

## R-2 (High): the file supplies its own scoring rules and moderator verdicts

**Evidence.**
- `exports.ts:113` reads the embedded task snapshot with `checkLinks:false`, and `scoring.suggest` scores against it (`exports.ts:105`, `scoring.ts:96`). The tool's own task definitions are never consulted.
- `sanitiseModerator` (`exports.ts:71-82`) accepts `tier`, `code`, `level1`, `menu`, `reviewed`, `observed`, `interpretation`, `expected`, `secondChance`, `overrideReason` from the file. `effective()` (`session.ts:339`) prefers `moderator.tier` over the suggestion.
- A run with `status: "completed"` and no `end` is accepted (suggestion `null`).

**Attack D: altered snapshot.** Payload: genuine file whose `content.tasks[*].primary` is replaced with `[{"href":"/shop/essential-oils"},{"href":"/definitely/not/a/link"}]`. Events untouched (all wrong clicks). Observed: tiers `P,P,P,P,P,P,P,P,P,P,P,P`; the same events scored against the tool's own content give `X` x12. `version` stays 3, so the "scored against content versions" warning never appears. The file imports without any complaint.

**Attack E: event-less Pass.** Payload: 12 completed runs, `events: []`, `end: null`, `moderator: {tier:"P", level1:true, reviewed:true, menu:"U", code:null}`. Observed: `suggestion = null`, `effective = {tier:"P", level1:true, level2:true}`, Ledger rows all `1/1 Pass`, `Reviewed 1 of 1`. In the UI, the findings list shows "findings on 12" and clicking Edit on such a run gives "That run is no longer available" (`Review.tsx:23`), so the researcher cannot inspect or correct it; the only remedy is deleting the whole session.

**Attack F: rename and add rows.** Payload: session with `content.tasks[0].title = "RENAMED BY ATTACKER"` and an extra task `T99 "Vendor X is great"` with one run, `createdAt` at the clamp ceiling. Observed: the T1 mobile row title becomes "RENAMED BY ATTACKER" (the title is taken from the newest counted session, `ledger.ts:98`), and a new row "T99 Vendor X is great (high risk)" appears in the Ledger and the Markdown export.

**Forged events** need no trick: events are free-form within the schema (any `at`, `section`, `href`), so a perfect run is indistinguishable from a real one. No per-run integrity exists, and none is possible without a secret the public cannot hold, so the defence has to be on trust boundaries (R-1) and on not accepting verdict fields.

**Real-world impact.** An attacker needs no skill with the UI: edit three JSON values. The "Reviewed" column can be inflated, which signals human validation that never happened.

**Fix.**
1. Participant-results files get a different `kind` from backups. For participant results: ignore the embedded `content` (re-score against the tool's own content when `content.version` and a canonical hash match a known published version; otherwise quarantine), force `practice:false`, `selfRun:true`, and reset every `moderator` field to its default. Only a "restore my backup" path may keep moderator fields.
2. Reject completed runs without `end` and at least one `ready` event.
3. Check internal consistency (`readingMs`, `durationMs`, `beginAt`, `endAt`, event `at` monotonic and within duration).

---

## R-3 (High): storage poisoning and persistent slow-down

**Evidence.** No limit on sessions per file, tasks per content, or total storage. `importSessions` (`state.tsx:150-156`) saves every imported session; each session embeds a full content copy. localStorage holds about 5.18 M characters in Chrome.

**Test 1: 9000 minimal sessions, 4.0 MB file** (`files/runless_9000.json`, `ui6.mjs`).
Observed: import succeeded; header "Not saved" and the red banner "Browser storage is full..."; 8927 sessions persisted. After reload: 8927 rows in Sessions; clicking Ledger took **5.7 s** (page frozen). Every visit repeats it.

**Test 2: 4000 mini sessions, 5.7 MB** (`ui5_poison.mjs`). 3471 persisted. After reload, "New session" shows "Not saved" and the storage-full banner, so the researcher's real work cannot be saved. Ledger visit 3.8 s. There is no bulk delete: each session needs Delete then Confirm, so clearing 3471 rows by hand is impractical. Recovery is "clear site data", which also destroys any genuine data not yet backed up.

**Partial import.** Once the quota is hit mid-import, later sessions (including genuine participants' from the same batch) exist only in memory and vanish on reload; the only signal is the banner.

**Real-world impact.** A 4 MB email attachment can make the tool unusable until browser data is cleared, and can cause silent loss of genuine imports. Hostile sessions can set `updatedAt` to now + 1 day so they sit at the top of the list.

**Fix.** Caps (sessions per file about 50, total stored sessions about 500, tasks per content at most 50, bytes per session about 1 MB). Store each distinct content snapshot once by hash. Make import transactional with a pre-check of quota. Add "Delete all sessions from this import" and a "Clear everything" action with export first. Sort the Sessions list so the researcher's own work cannot be buried.

---

## R-4 (Medium): same session id replaces the researcher's findings

`mergeSessions` (`exports.ts:176-186`): `s.updatedAt > have.updatedAt` replaces the whole stored session, including all moderator findings.

**Attack G** (`a2_integrity.mjs`): a participant's own file carries its session id. Researcher imports it and writes a note and a tier override. The participant (or anyone holding the file) re-sends it with `updatedAt = now + 1000`. Observed: `updated=1`; researcher note "RESEARCHER NOTE" before, `""` after, `reviewed` true to false. The message "1 updated" does not say findings were lost.
It also happens innocently: a participant re-sends a corrected file.

**Fix.** Never replace a session that has `reviewed` runs or `debriefNotes` changes without confirmation; merge participant-owned fields only; snapshot before replacing.

---

## R-5 (Medium): quadratic Ledger

`ledger.ts:149` uses `ids.includes` inside a double loop, and `tallyTask` calls `countedFor` for every id x 3 breakpoints, each walking every session and rebuilding `countedRuns` (`:80-92`). Cost is about ids x 3 x sessions.

Timings (`a4b_resource.mjs`, `ui4_heavy.mjs`):

| Input | `ledger()` |
|---|---|
| 1 session, 50 000 tasks (4.7 MB) | 1.2 s |
| 1 session, 100 000 tasks (9.5 MB) | 4.6 s |
| 1 session, 250 000 tasks (23.9 MB) | 28 s node, **54 s in Chrome UI** |
| 4000 sessions with unique tasks (5.7 MB) | 2.6 s node, 3.4 s UI |
| 8000 sessions with unique tasks (11.4 MB) | 19.7 s node, 11 s UI |

`ledgerMarkdown` repeats the same cost. The 24 MB single-session file is not persisted (quota) so a reload clears it; the persistent variants are in R-3. `parseImport` itself stays fast (0.7 s for 24 MB).

**Fix.** `Set` for ids; index counted runs by task once per call (one pass over all runs); `useMemo` in `Ledger.tsx`; cap tasks per content.

---

## R-6 (Medium): Markdown export carries attacker text

Attacker-controlled strings that reach `ledgerMarkdown`: task `title` (80 chars, from the newest counted session) and the keys of `routeSplit` / `misreads`, which are event `column` and `section` strings (200 chars each). They pass through `cell()` (`exports.ts:195`) which only escapes `|` and `\r?\n`.

Observed output (`a3_output.mjs`, verbatim table rows):
- `| T1 ![t](https://attacker.example/beacon.png?p=1) (high risk) | ... | ![c](https://attacker.example/c.png) 1 | ![s](https://attacker.example/s.png) 1 |`
- `| T1 [Click to see full results](https://attacker.example/phish) (high risk) | ... | [a](javascript:alert(1)) 1 | <https://attacker.example/auto> 1 |`
- `| T1 <img src=x onerror=alert(1)> (high risk) | ... | <script>alert(1)</script> 1 | <a href=//evil>x</a> 1 |`
- Lone CR survives: `"| T1 T\r\\| fake \\| row \\| (high risk) | ..."`; U+2028 and U+0085 also survive. A parser that treats a lone CR as a line break lets text after it start a new block (heading, list).
- `\n# Injected heading` is flattened to a space (good). `a|b` becomes `a\|b` and `x\|y` becomes `x\\|y`; in cmark-gfm and markdown-it the second still stays inside the cell by my reading of their cell splitters, so I did not claim a table break.

I could not render these in a real viewer (no Markdown renderer available offline), so rendering behaviour is UNVERIFIED. Likely outcomes by viewer: tracking beacon via image on preview panes that load remote images; a convincing phishing link inside a trusted results table; raw HTML in viewers that do not sanitise.

**Fix.** Do not take titles from the file at all (use the tool's own task titles). Escape all of `\ ` * _ [ ] ( ) < > ! # & |` and every line terminator (`[\r\n\u0085  ]`) in `cell()`, or emit untrusted text only inside code spans with backticks neutralised.

---

## R-7 (Low): `__proto__` crashes the Review screen

`format.ts:16` `sectionLabel` reads `SECTION_LABELS[id]` from a plain object (`navIndex.ts:26`, built with `Object.fromEntries`), so `"__proto__"` returns `Object.prototype`. `Review.tsx:54` renders `{sectionLabel(sug.levelOneSection)}` as a child.

Payload: run events `[{ready},{click, kind:"nav-leaf", href:"/nope", section:"__proto__", column:"constructor", ends:true}]`. Observed (built file): opening that run's findings shows the Boundary page "Something went wrong on this screen"; console `Minified React error #31 ... object with keys {}`. Reproduced from both the Ledger list and the session record. Reload recovers (state is not persisted), but the run can never be opened for findings. `constructor` as a section returns the `Object` function (React warning only, `function Object() { [native code] }` shows in the Ledger misreads text). Ledger and CSV are unaffected (template strings and `bump` skips `__proto__`).

**Fix.** `Object.hasOwn(SECTION_LABELS, id)` or a `Map`; wrap displayed values in `String()`.

---

## R-8 (Low): ids not normalised; bidi in the list

`text(raw.participantId, 40)` keeps any character. Observed (`a5_misc.mjs`): `P3`, `P3` + U+200B, `P3 `, `p3`, Cyrillic `Р3` imported together count as **5 distinct participants** (n=5 on the first row). The Sessions list shows them as near-identical rows. `‮P​9` (RLO + ZWSP) renders in the list and reorders the `(self-run)` label in the same cell. NUL and lone surrogates import fine and do not crash storage round trips.

**Fix.** Same normalisation as R-1; reject controls and bidi characters in ids; use `unicode-bidi: isolate` for displayed ids and notes.

---

## R-9 (Low): unbounded numbers

`finite()` accepts any finite number for `position`, `attempt`, `scale`, `readingMs`, `durationMs`, `presentedAt`, `at`, `x`, `y`. Observed in the built file: Ledger column "Position (mean)" shows `1.1111111111111111e+307`; the median or mean of two 1e308 values can overflow to `Infinity` (shown as "Infinity s"). Negative `scale` and negative durations import. CSV carries them (negatives get an apostrophe prefix).

**Fix.** Clamp: position 0 to order length; durations 0 to 24 h; scale (0, 1]; `at` 0 to 24 h; x, y 0 to 10 000.

---

## R-10 (Low): duplicate `runId`s

IDs only have to match `/^[A-Za-z0-9_.-]{1,80}$/`; uniqueness is not checked. Two runs with the same id in one session: `reviewRun` finds the first, so findings for the second land on the first (observed: reviewing index 1 marked index 0 reviewed). React also emits duplicate-key warnings in the findings list.

**Fix.** Reject or re-key duplicates on import.

---

## R-11 (Low): participant edition resumes into imported data

`SelfRun.tsx` boots with the most recently updated stored session (`openSession(latest)`). Combined with R-12, opening the participant edition on the researcher's machine after imports (verified in `ui8_origin.mjs`) lands on "All done / Thank you for finishing" for an imported participant with a "Save my results" button. Because a hostile file can set `updatedAt` to now + 1 day, it is always the newest.

**Fix.** The participant edition should only resume sessions it created (store a marker key) and never share storage keys with the moderator edition.

---

## R-12 (Info): `file://` storage is shared

`location.origin` is `file://`; localStorage written by `dist-single/wayfinding-check.html` was visible to a copy of the tool at another path and to the participant edition at a third path (13 keys seen from all three). README line 77 says "per file location": that is not true in Chrome. Blast radius: any local HTML file the researcher opens in Chrome (for example a downloaded page) can read and tamper with all research data in storage; hosted on its own https origin the storage would be isolated from other local files but shared with anything else on that origin. There is no HTML sink in the tool, so imported files themselves cannot exploit this.

---

## R-13 (Info): prototype-key participant codes

`order.ts:79` `rosterOrders(seed)[participantId]` returns `Object.prototype` members for `constructor`, `__proto__`, `toString`; `roster.every` then throws `TypeError: roster.every is not a function` inside `createSession` / the Setup `reduce`. The participant-edition code regex (`^[A-Za-z0-9_.-]{1,40}$`) allows `constructor`. Only the person typing the code is affected. Import (`sanitiseSession`) does not call `orderFor`, so imported ids of this kind work. UI manifestation not run.

**Fix.** `Object.hasOwn(roster, id)` or a `Map`.

---

## R-14 (Info): CSV (`csvEscape`)

Checked 24 leading-character payloads through the real pipeline and a full 40-column row (`a3_output.mjs`). Cells beginning `=`, `+`, `-`, `@`, TAB or CR get a leading apostrophe in every attacker-controlled column (participant_id, final_href, sections_opened, level1_section, participant_notes, observed, interpretation, expected, second_chance, override_reason...). After escaping, no cell starts with a dangerous character. LF-first cells are quoted and not formulas.
Residual, all UNVERIFIED (no Excel, Numbers or Sheets here): (a) a semicolon-list-separator Excel locale splits unquoted cells on `;`, so `override_reason` (the last column, 1000 chars) could contain `x;=HYPERLINK(...)`: observed as `"x;=HYPERLINK(...)"` quoted only because it contains a comma and quotes, an unquoted variant would not be; (b) cells starting with space, NBSP, fullwidth `＝`, bidi or zero-width characters are untouched (these are not formulas in Excel as far as I know). Suggested hardening: always quote every field and also prefix when the first non-space or non-control character is a trigger.

---

## R-15 (Info): download file names

`Debrief.tsx:16-17` builds `wayfinding-${session.participantId}-${stamp()}.json|csv`. Opened 13 hostile ids in Chrome (`ui3_names.mjs`): `a/b/c` to `wayfinding-a_b_c-...`, `../../evil` to `wayfinding-.._.._evil-...`, `x"; filename="y.exe` to `wayfinding-x_; filename=_y.exe-...`, CR LF to `__`, RLO and NUL to `_`. Extension is always `.json` or `.csv`. Nothing escaped the download folder. (`..\..\evil` produced no file in my run; I did not chase why.) Other browsers were not tested. Allow-list `[A-Za-z0-9_.-]` before building names for defence in depth.

---

## R-16 (Info): imported sessions in participant phases

A file can set `phase` to `intro`, `task`, `rating`, `offer` or `handBack`. The Sessions list shows "In progress" with an Open button; opening shows participant screens ("SCENARIO 13 OF 12", "Please hand the device back") inside the moderator tool, and `openSession` runs `resume`, which marks an active run interrupted and rewrites `updatedAt` (persisted). 20 variants (empty `order`, huge `cursor`, missing reserve tasks) did not crash; reload was clean in all. Minor confusion and accidental mutation only.

---

## Area-by-area notes

1. **Import validation.** About 45 malformed inputs through `parseImport`, then through `ledger`, `ledgerMarkdown`, `runsToCsv`, `toJsonBundle` and a storage round trip: no uncaught exception, no round-trip loss (`a1_validation.mjs`). Covers missing fields, wrong types, 1e308, negative, strings for numbers, 1 MB ids and notes (clipped to 40, 2000), `__proto__` and `constructor` as session id, plan keys, planOverrides keys, moderator keys, event keys, 100k tasks, 100k runs (clipped to 200), 1M events (clipped to 600), 1M nested `[` (rejected as invalid JSON), 100k nested objects (ignored, session rejected). A bad import never clears existing data (error returns before any state change; merge only adds or replaces by id). Size limit: 26 214 399 bytes accepted, 26 214 402 rejected (`ui4_heavy.mjs`); the message says "25 MB ... (limit 25 MB)".
2. **Integrity.** See R-1 to R-4. `practice:true` cannot suppress a genuine session (practice sessions are skipped before keying, verified). `selfRun` has no effect on counts but is shown as a "(self-run)" tag and is attacker-controlled. No provenance or collision warning anywhere.
3. **Rendering.** All imported text is rendered as React text. The only `dangerouslySetInnerHTML` (`brand.tsx:24`) takes static SVG strings. Imported `<script>`/`<img onerror>`/`<b onmouseover>` in titles, scenarios, notes, labels, debrief notes: DOM scan after import, on the Ledger and in Review found 0 injected elements and no script execution (`ui1_import.mjs`).
4. **Delivery vehicle.** `JSON.parse` only; no `eval`, `new Function`, `fetch`, `XMLHttpRequest`, `window.open`, dynamic import, or `location` assignment in `src/shell` or `src/shared` (grep). CSP `default-src 'none'; script-src 'unsafe-inline'; img-src data:; frame-src about:` is present in the built file. Event objects go through `parseProtoMessage`: unknown fields dropped, bad kinds and non-numeric coordinates rejected, `__proto__` / `constructor` keys produce no pollution (`Object.keys(Object.prototype)` empty after the run). `moderator-key` events are accepted into imported runs but are inert there. `route.path` can contain `javascript:` text but is only shown as text.
5. **Resource exhaustion.** See R-3 and R-5. Worst-case memory is modest (5 sessions x 200 runs x 600 events, 47 MB, parse 0.27 s, +89 MB heap); quota errors surface as the red banner, not a crash.

## Assumptions and limits

- Tested on Chrome (headless, macOS). Excel, Numbers, Google Sheets, and Markdown renderers were not available; those results are string-level.
- The attacker does not know any genuine session id (ids are `s_<time><4 random>`); R-1 does not need it.
- The attacker knows participant codes follow `P<number>`.
- The dist-single build matches the source (built file shows the same `csvEscape`; UI findings were observed on the built file).
- I did not test the participant edition's own handling of hostile local storage beyond R-11 and R-13; that is outside the return path.

## Files

Scripts: `rt3/a1_validation.mjs`, `a2_integrity.mjs`, `a3_output.mjs`, `a4_resource.mjs`, `a4b_resource.mjs`, `a4c.mjs`, `a4d.mjs`, `a5_misc.mjs`, `ui1_import.mjs` to `ui9b.mjs`, generators `mkfiles*.mjs`. Crafted files: `rt3/files/*.json` (not for distribution; some are tens of MB).
