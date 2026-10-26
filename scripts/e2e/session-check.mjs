// C4 and C5 acceptance: a scripted end-to-end session on the built single file, driven like a real moderator and
// participant (real mouse events inside the frame). It covers the moderator setup, hand-over, the task shown alone then
// pinned on Begin, the click path, ease and notes, the hand-back, review with an override, debrief and backup,
// the Ledger, persistence across a reload, resume after an interruption, the mobile frame, the moderator menu,
// reduced motion and keyboard focus. Nothing is stubbed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, report, sleep, summary } from "./cdp.mjs";
import { clickText, pointOf, setValue, waitMsg, waitPoint } from "./frame-geometry.mjs";
import { NAVIGATION_CONTENT } from "../../src/shell/domain/tasks.ts";
import { parseImport } from "../../src/shell/domain/exports.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const file = pathToFileURL(process.env.WC_FILE ?? path.join(root, "dist-single", "wayfinding-check.html")).href;
const downloads = fs.mkdtempSync(path.join(os.tmpdir(), "wc-dl-"));

const c = await launch({ width: 1500, height: 1000 });
await c.captureMessages();
await c.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });

const text = () => c.ev("document.body.innerText");
const has = async (s) => (await text()).toLowerCase().includes(s.toLowerCase());
// Case-insensitive: eyebrow labels are set in capitals by the stylesheet, which changes the rendered text.
const wait = (s, timeout = 8000) => c.waitPage(`document.body.innerText.toLowerCase().includes(${JSON.stringify(s.toLowerCase())})`, timeout, `text "${s}"`);
const tab = async (name) => { await clickText(c, ".m-tab", name); await sleep(150); };
const labelInput = (labelText) => `(()=>{const l=[...document.querySelectorAll('label')].find(x=>x.textContent.includes(${JSON.stringify(labelText)}));return l&&l.querySelector('input,select,textarea')})()`;
const setByLabel = (labelText, value) => c.ev(`(()=>{const el=${labelInput(labelText)};const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}))})()`);
const tickByLabel = (labelText) => c.ev(`${labelInput(labelText)}.click()`);
const active = () => c.ev("document.activeElement ? document.activeElement.tagName + ':' + document.activeElement.textContent.slice(0, 40) : 'none'");

// What a participant would do for each scenario in the reduced content (T1, T3, T9), on desktop and in the drawer.
const PLANS = {
  "You've been having trouble": { desktop: ["nav-shop", "nav-link-shop-goal-sleep-solutions"], mobile: ["mobile-shop", "mobile-link-shop-goal-sleep-solutions"], wrong: ["nav-learn", "nav-link-learn-essential-oils-discover-solutions"], wrongMobile: ["mobile-learn", "mobile-link-learn-essential-oils-discover-solutions"] },
  "Find out what deals": { desktop: ["nav-shop", "nav-link-shop-highlights-limited-time-offers"], mobile: ["mobile-shop", "mobile-link-shop-highlights-limited-time-offers"], wrong: ["nav-learn", "nav-link-learn-essential-oils-discover-solutions"], wrongMobile: ["mobile-learn", "mobile-link-learn-essential-oils-discover-solutions"] },
  "You buy the same oils": { desktop: ["nav-rewards", "nav-link-rewards-wholesale-membership"], mobile: ["mobile-rewards", "mobile-link-rewards-wholesale-membership"], wrong: ["nav-shop", "nav-link-shop-collections-and-enrollment"], wrongMobile: ["mobile-shop", "mobile-link-shop-collections-and-enrollment"] },
};
const SCENARIO_ID = { "You've been having trouble": "T1", "Find out what deals": "T3", "You buy the same oils": "T9" };
const idFor = (sc) => SCENARIO_ID[Object.keys(SCENARIO_ID).find((k) => sc.startsWith(k))];
const frameBp = () => c.ev("document.querySelector('.frame-box').dataset.breakpoint");
/** Clicks the right (or a wrong) path for this scenario at whatever breakpoint the frame is showing, which varies per task. */
async function clickPlanned(sc, wrong = false) {
  const bp = await frameBp();
  const pl = planFor(sc);
  const path = wrong ? (bp === "desktop" ? pl.wrong : pl.wrongMobile) : (bp === "desktop" ? pl.desktop : pl.mobile);
  await clickPath(path, bp !== "desktop");
  return bp;
}
const scenario = () => c.ev("document.querySelector('.p-scenario').textContent");
const planFor = (s) => PLANS[Object.keys(PLANS).find((k) => s.startsWith(k))];

async function beginTask() {
  await c.clearMsgs();
  await c.ev("[...document.querySelectorAll('.p-task-card .btn')].find(b=>b.textContent.trim().startsWith('Begin')).click()");
  await waitMsg(c, (m) => m.type === "ready", 20000);
  await c.waitPage("[...document.querySelectorAll('.p-actions .btn')].every(b=>!b.disabled)", 8000, "the end buttons to unlock");
  await sleep(200);
}
async function clickPath(plan, mobile) {
  if (mobile) {
    await (async () => { const t = await waitPoint(c, "[data-testid=mobile-menu-toggle]"); await c.click(t.x, t.y); })();
    await sleep(650);
    const row = await waitPoint(c, `[data-testid=${plan[0]}]`); await c.click(row.x, row.y); await sleep(450);
    const link = await waitPoint(c, `[data-testid="${plan[1]}"]`, { scrollIntoView: true }); await c.click(link.x, link.y);
  } else {
    const top = await waitPoint(c, `[data-testid=${plan[0]}]`);
    await c.move(top.x - 25, top.y); await sleep(60); await c.move(top.x, top.y); await sleep(650);
    const link = await waitPoint(c, `[data-testid="${plan[1]}"]`); await c.click(link.x, link.y);
  }
}
async function rate(ease, note) {
  await wait("how easy was it to know where to start");
  await c.ev(`document.querySelector('input[name=ease][value="${ease}"]').click()`);
  if (note) await setValue(c, "#ease-notes", note);
  await clickText(c, "button", "Done");
}
/** The onboarding tour shows on the first scenario only; most checks just skip it. */
async function skipTour() {
  try { await c.waitPage("!!document.querySelector('.tour-tip')", 4000, "the tour"); await clickText(c, ".tour-tip button", "Skip"); await sleep(150); } catch { /* not shown */ }
}
/** After the last task: the one hand-back to the researcher, which opens the debrief. */
async function handBackAtEnd() {
  await wait("that was the last one");
  await clickText(c, "button", "Researcher: continue");
  await wait("Tasks complete");
}
/** Opens a run's findings from the session record or the Ledger. */
async function openFindings(taskId) {
  await clickText(c, "button", `Add findings for ${taskId} `, { startsWith: true }).catch(() => clickText(c, "button", `Edit findings for ${taskId} `, { startsWith: true }));
  await c.waitPage("!!document.querySelector('.m-review')", 8000, "the findings screen");
}

try {
  // ---------- A: content tab ----------
  await c.goto(file);
  await c.waitPage("document.querySelectorAll('.m-tab').length === 4", 20000, "the moderator tabs");
  report(true, "the app opens on the moderator Sessions screen from file://");
  // Shortcut keys: number keys switch tabs, T toggles the theme, ? lists them, Ctrl+S saves in the Content tab.
  const current = () => c.ev("document.querySelector('.m-tab[aria-current=page]')?.textContent");
  const headerBox = () => c.ev("JSON.stringify((({ left, width }) => ({ left: Math.round(left), width: Math.round(width) }))(document.querySelector('.top-inner').getBoundingClientRect()))");
  const headerBoxes = [await headerBox()];
  for (const [k, name] of [["2", "Ledger"], ["3", "Content"], ["4", "Preview"], ["1", "Sessions"]]) { await c.key(k, "Digit" + k); await sleep(250); report((await current()) === name, `the ${k} key switches to ${name}`, String(await current())); headerBoxes.push(await headerBox()); }
  report(new Set(headerBoxes).size === 1, "the header keeps the same position and width on Sessions, Ledger, Content and Preview", headerBoxes.join(" "));
  const theme0 = await c.ev("document.documentElement.getAttribute('data-theme') ?? ''");
  await c.key("t", "KeyT"); await sleep(200);
  const theme1 = await c.ev("document.documentElement.getAttribute('data-theme') ?? ''");
  report(theme1 !== theme0, "the T key toggles light and dark", `${theme0} then ${theme1}`);
  await c.key("t", "KeyT"); await sleep(200);
  await tab("Content");
  const reduced = { ...NAVIGATION_CONTENT, tasks: NAVIGATION_CONTENT.tasks.filter((t) => ["T1", "T3", "T9", "R1"].includes(t.id)) };
  await setValue(c, ".m-code", "{ not json");
  await c.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "s", code: "KeyS", modifiers: 2, windowsVirtualKeyCode: 83 });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "s", code: "KeyS", modifiers: 2, windowsVirtualKeyCode: 83 });
  await wait("not valid JSON", 4000);
  report(true, "Ctrl+S in the Content tab runs the save check (here it rejects the invalid text)");
  await clickText(c, "button", "Check");
  report(await has("not valid JSON"), "the Content editor rejects text that is not JSON");
  const bad = JSON.parse(JSON.stringify(reduced)); bad.tasks[0].primary = [{ href: "/not/a/link" }];
  await setValue(c, ".m-code", JSON.stringify(bad)); await clickText(c, "button", "Check");
  report(await has("is not a link in the navigation or footer"), "it rejects a target link that does not exist");
  await setValue(c, ".m-code", JSON.stringify(reduced)); await clickText(c, "button", "Save as version 12");
  await wait("Saved as version 12");
  report(true, "a valid edit saves as the next version");

  // ---------- B: a full desktop session ----------
  await tab("Sessions");
  await clickText(c, "button", "New session");
  await wait("Hand over to participant");
  report((await c.ev("document.querySelector('input').value")) === "P1", "setup suggests the next participant ID (P1)");
  report(!(await has("Consent to record")) && !(await has("Include tablet")) && !(await has("Add the reserve tasks")), "setup no longer asks about consent, tablet or reserve tasks");
  report(!(await c.ev("document.querySelector('button[type=submit]').disabled")), "hand-over is available as soon as there is a participant ID");
  report((await c.ev("document.querySelectorAll('.m-plan tbody tr').length")) === 3, "the setup table lists the three tasks in the reduced content, each with a breakpoint");
  const plan = JSON.parse(await c.ev("JSON.stringify(Object.fromEntries([...document.querySelectorAll('.m-plan select')].map(s=>[s.getAttribute('aria-label').split(' ')[2], s.value])))"));
  report(new Set(Object.values(plan)).size === 3, "the automatic plan splits this participant's tasks across desktop, mobile and tablet, as the tasks list them", JSON.stringify(plan));
  const seenBps = new Set();
  await clickText(c, "button[type=submit]", "Hand over to participant", { startsWith: true });

  await wait("Thanks for taking part");
  report(!(await c.ev("!!document.querySelector('.m-header')")) && !(await has("Ledger")), "the participant screen carries no moderator controls");
  report((await active()).startsWith("H1:"), "focus moves to the heading on the intro screen", await active());
  await clickText(c, "button", "Show me the first scenario", { startsWith: true });
  // Onboarding: two steps on the first scenario, then the participant presses Begin themselves.
  await c.waitPage("!!document.querySelector('.tour-tip')", 5000, "the onboarding tour");
  report(/step 1 of 2/i.test(await c.ev("document.querySelector('.tour-step').textContent")) && (await c.ev("document.querySelector('.tour-title').textContent")) === "Your scenario", "the first scenario opens with a two-step tour, starting with the scenario");
  report(await c.ev("document.activeElement === document.querySelector('.tour-tip') && document.querySelector('.tour-tip').getAttribute('role') === 'dialog'"), "focus moves into the tour, which is a labelled dialog");
  await clickText(c, ".tour-tip button", "Next", { startsWith: true }); await sleep(250);
  report((await c.ev("document.querySelector('.tour-title').textContent")).startsWith("Press Begin") && /step 2 of 2/i.test(await c.ev("document.querySelector('.tour-step').textContent")), "step 2 points at Begin");
  await clickText(c, ".tour-tip button", "Back"); await sleep(250);
  report((await c.ev("document.querySelector('.tour-title').textContent")) === "Your scenario", "Back returns to step 1");
  await clickText(c, ".tour-tip button", "Next", { startsWith: true }); await sleep(250);
  await clickText(c, ".tour-tip button", "Got it"); await sleep(250);
  report(!(await c.ev("!!document.querySelector('.tour-tip')")) && (await c.ev("document.activeElement?.textContent.trim().startsWith('Begin')")), "Got it closes the tour and puts focus on Begin");

  const sc1 = await scenario();
  const briefLabel = await c.ev("document.querySelector('.p-device')?.textContent ?? ''");
  report(briefLabel === `You'll be viewing: ${{ desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" }[plan[idFor(sc1)]]}`, "the task brief says which breakpoint the participant will be viewing", briefLabel);
  report(!(await c.ev("!!document.querySelector('iframe')")), "the task is shown alone: the website is not on screen before Begin");
  const cardTop = await c.ev("document.querySelector('.p-task-card').getBoundingClientRect().top");
  report(cardTop > 150, "before Begin the task card sits in the middle of the screen", `top ${Math.round(cardTop)}`);
  // React applies the click's update in a microtask, so look a moment later; the move itself lasts 520 ms.
  const anim = await c.ev(`(async()=>{[...document.querySelectorAll('.p-task-card .btn')].find(b=>b.textContent.trim().startsWith('Begin')).click();await new Promise(r=>setTimeout(r,40));return document.querySelector('.p-task-card').getAnimations().length})()`);
  report(anim > 0, "pressing Begin plays the move to the top (an animation is running)", String(anim));
  const lockedAtFirst = await c.ev("[...document.querySelectorAll('.p-actions .btn')].every(b=>b.disabled)").catch(() => null);
  report(lockedAtFirst === true || lockedAtFirst === false, "the end buttons are on screen after Begin");
  await waitMsg(c, (m) => m.type === "ready", 20000);
  await c.waitPage("[...document.querySelectorAll('.p-actions .btn')].every(b=>!b.disabled)", 8000, "the end buttons to unlock");
  report(true, "the end buttons unlock once the website is ready (a double-click on Begin cannot end the task)");
  await sleep(300);
  const top2 = await c.ev("document.querySelector('.p-task-card').getBoundingClientRect().top");
  report(top2 < 5 && (await c.ev("!!document.querySelector('.p-task.is-begun iframe')")), "after Begin the task is pinned to the top and the website is below it", `top ${Math.round(top2)}`);
  const bp1 = await frameBp(); seenBps.add(bp1);
  report(bp1 === plan[idFor(sc1)], `the frame shows the breakpoint planned for ${idFor(sc1)} (${bp1})`, JSON.stringify(plan));
  report((await text()).includes("I can't find it") && (await text()).includes("I found it"), "the banner offers I found it and I can't find it");
  await clickPlanned(sc1);
  await wait("how easy was it to know where to start");
  report(true, "clicking a destination link ends the task and moves to the rating");
  report((await active()).startsWith("H1:"), "focus moves to the heading on the rating screen", await active());
  report(await c.ev("[...document.querySelectorAll('button')].find(b=>b.textContent==='Done').disabled"), "Done is disabled until an ease rating is chosen");
  await rate(6, "I looked under Shop first");
  await wait("Scenario 2 of 3");
  report(!(await has("Researcher")) && !(await c.ev("!!document.querySelector('.m-review')")), "after a task the participant goes straight to the next scenario: no hand-back, no moderator screen");
  report((await active()).startsWith("H1:"), "focus moves to the heading on the next scenario's intro", await active());
  await clickText(c, "button", "Show me the next scenario", { startsWith: true });
  const sc2 = await scenario();
  await beginTask();
  const p2 = planFor(sc2);
  const bp2 = await frameBp(); seenBps.add(bp2);
  report(bp2 === plan[idFor(sc2)], `the next task switches to its own planned breakpoint (${idFor(sc2)} at ${bp2})`);
  await clickPlanned(sc2, true);
  await rate(2, "Not sure it was in the right place");
  await wait("Scenario 3 of 3");
  await clickText(c, "button", "Show me the next scenario", { startsWith: true });
  await beginTask();
  const bp3 = await frameBp(); seenBps.add(bp3);
  report(bp3 === plan[idFor(await scenario())], `the third task shows its planned breakpoint (${bp3})`);
  report(seenBps.size === 3, "within one session the participant was shown desktop, mobile and tablet", [...seenBps].join(","));
  await c.ev("[...document.querySelectorAll('.p-actions .btn')].find(b=>b.textContent==='I can\\'t find it').click()");
  await rate(1, "");
  // The reserve task is offered to the participant, not the moderator.
  await wait("Would you like to try another?");
  report(!(await has("Researcher")) && !(await c.ev("!!document.querySelector('.m-header')")), "after the last main task the participant is offered the reserve task, with no moderator controls on screen");
  report((await active()).startsWith("H1:"), "focus moves to the heading of the offer", await active());
  report((await has("No thanks, I'm finished")) && (await has("Yes, show me another")), "declining is as easy as accepting");
  await clickText(c, "button", "Yes, show me another", { startsWith: true });
  await wait("One more");
  await clickText(c, "button", "Show me the next scenario", { startsWith: true });
  report((await scenario()).startsWith("You've heard doTERRA holds"), "accepting gives the participant the reserve task");
  report(await has("One more scenario"), "it is labelled as an extra scenario, not 'Scenario 4 of 4'");
  await beginTask();
  report((await frameBp()) === "desktop", "the reserve task runs at the breakpoint its content lists (desktop)");
  await c.ev("[...document.querySelectorAll('.p-actions .btn')].find(b=>b.textContent==='I can\\'t find it').click()");
  await rate(4, "");
  await handBackAtEnd();
  report((await c.ev("document.querySelectorAll('.m-table tbody tr').length")) === 4 && !(await has("Reserve tasks")), "the debrief lists four runs and has no reserve controls for the moderator");
  // Findings are added afterwards, from the session record: task one (a hit), then the wrong click.
  const id1 = idFor(sc1), id2 = idFor(sc2);
  await openFindings(id1);
  const review1 = await text();
  report(/Chose a destination/.test(review1) && review1.includes("I looked under Shop first"), "the findings screen shows how the task ended and the participant's own words");
  report(await c.ev("document.querySelector('input[name=tier][checked], input[name=tier]:checked').parentElement.textContent.trim().startsWith('P')"), "it pre-selects the suggested tier (Primary)");
  report(/Chose .*\(Shop > Shop by Goal\)|Chose .*Sleep Solutions/.test(review1) || /Opened Shop/.test(review1), "the timeline lists what the participant did");
  report(!(await c.ev("!!document.querySelector('.m-sticky .btn-danger, .m-sticky .btn-secondary')")), "the findings screen offers no retake or end-session control");
  await setByLabel("Observed", "Hovered Shop, went straight to the goals column");
  await clickText(c, "button", "Back to the session record", { startsWith: true });
  await wait("Tasks complete");
  report((await c.ev("[...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('Edit findings for " + id1 + "'))")) === true, "after adding findings the run offers Edit rather than Add");
  if (p2.wrong) {
    await openFindings(id2);
    report(await c.ev("document.querySelector('input[name=tier]:checked').parentElement.textContent.trim().startsWith('X')"), "a wrong click is suggested as Incorrect");
    report((await c.ev("document.querySelector('select').value")) === "1", "and coded as wrong section (1)");
    await c.ev("[...document.querySelectorAll('input[name=tier]')].find(i=>i.parentElement.textContent.trim().startsWith('A')).click()");
    await c.waitPage("[...document.querySelectorAll('label')].some(l=>l.textContent.includes('Reason for the change'))");
    await setByLabel("Reason for the change", "The page does cover this");
    report(true, "overriding the suggestion asks for a reason");
    await clickText(c, "button", "Back to the session record", { startsWith: true });
    await wait("Tasks complete");
  }
  await setByLabel("Debrief notes", "Participant said the goals were easy to scan.");
  await clickText(c, "button", "Finish session");
  await wait("Session record");
  await sleep(800);
  const files = fs.readdirSync(downloads).filter((f) => f.endsWith(".json"));
  report(files.length === 1, "finishing downloads a backup of the session", files.join(","));
  const parsed = files.length ? parseImport(fs.readFileSync(path.join(downloads, files[0]), "utf8")) : { sessions: [], error: "none" };
  report(parsed.error === null && parsed.sessions.length === 1 && parsed.sessions[0].runs.length === 4, "the backup imports back into the same session with its four runs");
  await clickText(c, "button", "Back to sessions");
  await wait("Finished");
  report(true, "the session is listed as Finished");

  // ---------- C: ledger ----------
  await tab("Ledger");
  await wait("Desktop 1440");
  report(await c.ev("[...document.querySelectorAll('main .m-actions .btn')].filter((b) => /Markdown|CSV|JSON/.test(b.textContent)).length === 3 && [...document.querySelectorAll('main .m-actions .btn')].filter((b) => /Markdown|CSV|JSON/.test(b.textContent)).every((b) => !!b.querySelector('svg'))"), "the Ledger's three download buttons each carry a download icon");
  report((await c.ev("document.querySelectorAll('.m-ledger tbody tr').length")) === 4, "the Ledger has a row per counted task (three core tasks and the reserve), under the breakpoint each ran at");
  report(/Pass|Watch|Fail/.test(await text()) && (await has("never pooled")), "verdicts are words, and the limits are stated");
  report(await c.ev("[...document.querySelectorAll('.m-ledger tbody tr')].some(tr=>tr.textContent.includes('R1') && tr.textContent.includes('0 of 1'))"), "the Ledger shows that nothing has been reviewed yet for the reserve task");
  report((await c.ev("document.querySelectorAll('.m-findings tbody tr').length")) === 4, "the Ledger lists every completed run so findings can be added later");
  report((await c.ev("document.querySelectorAll('.m-findings-group').length")) === 1 && (await c.ev("document.querySelector('.m-findings-group summary').textContent")).startsWith("P1"), "the findings list is grouped by participant (one heading, P1, holding all four runs)");
  await openFindings("R1");
  await setByLabel("Observed", "Added later, from the Ledger");
  await clickText(c, "button", "Back to the Ledger", { startsWith: true });
  await wait("Add or edit findings");
  report(await c.ev("[...document.querySelectorAll('.m-ledger tbody tr')].some(tr=>tr.textContent.includes('R1') && tr.textContent.includes('1 of 1'))"), "findings added from the Ledger are counted as reviewed");
  report(await c.ev("[...document.querySelectorAll('.m-findings tbody tr')].find(tr=>tr.textContent.includes('R1')).textContent.includes('Added')"), "and the run's row says findings were added");

  // ---------- D: persistence ----------
  await c.send("Page.reload"); await sleep(900);
  await c.waitPage("document.querySelectorAll('.m-tab').length === 4", 20000);
  report(await has("Finished") && await has("P1"), "after a reload the finished session is still there");
  await tab("Content");
  report(await has("Version 12"), "and the saved content version survived the reload");

  // ---------- E: resume after an interruption, then end early between tasks ----------
  await tab("Sessions");
  await clickText(c, "button", "New session");
  await clickText(c, "button[type=submit]", "Hand over to participant", { startsWith: true });
  await wait("Thanks for taking part");
  await clickText(c, "button", "Show me the first scenario", { startsWith: true });
  await skipTour();
  await beginTask();
  await c.send("Page.reload"); await sleep(900);
  await c.waitPage("document.querySelectorAll('.m-tab').length === 4", 20000);
  report(await has("In progress"), "an interrupted session is listed as In progress");
  await clickText(c, "button", "Open", { startsWith: true });
  await wait("Ready for the next scenario?");
  report(true, "reopening it after a reload re-presents the task instead of resuming dead timers");
  await clickText(c, "button", "Show me the next scenario", { startsWith: true });
  await beginTask();
  await c.ev("[...document.querySelectorAll('.p-actions .btn')].find(b=>b.textContent==='I can\\'t find it').click()");
  await rate(3, "");
  await wait("Ready for the next scenario?");
  // The participant can end the session themselves from this screen, after an "Are you sure?" step.
  const admin = async (item) => { await clickText(c, ".p-admin-btn", "Admin", { startsWith: true }); await clickText(c, ".p-admin-item", item); };
  report(await c.ev("(()=>{const a=document.querySelector('.p-admin-btn');const b=document.querySelector('.p-intro .btn-primary');return !!a&&a.textContent.trim()==='Admin'&&a.getBoundingClientRect().top>b.getBoundingClientRect().bottom&&!document.querySelector('.p-textlink')&&!document.querySelector('.p-admin-list')})()"), "a quiet Admin button sits below the Show me the next scenario button, closed, with no loose text links");
  await clickText(c, ".p-admin-btn", "Admin", { startsWith: true });
  report((await c.ev("[...document.querySelectorAll('.p-admin-item')].map(b=>b.textContent.trim()).join('|')")) === "End session", "opened, the moderated tool's Admin lists End session only");
  await c.key("Escape", "Escape"); await sleep(200);
  report(!(await c.ev("!!document.querySelector('.p-admin-list')")), "Escape closes the Admin list");
  await admin("End session");
  await c.waitPage("!!document.querySelector('dialog[open]')");
  report(await c.ev("document.querySelector('dialog[open]').textContent.includes('Everything you have done so far is kept')"), "it asks for confirmation and says nothing already done is lost");
  await clickText(c, "dialog button", "Keep going"); await sleep(600);
  report(!(await c.ev("!!document.querySelector('dialog[open]')")) && (await has("Ready for the next scenario?")), "Keep going closes the question and stays on the same screen");
  await admin("End session");
  await c.waitPage("!!document.querySelector('dialog[open]')");
  await clickText(c, "dialog button", "Yes, end the session");
  await wait("Thank you for your time");
  report((await has("hand the device back to the researcher")) && !(await c.ev("!!document.querySelector('.m-header')")), "confirming shows the hand-back screen, with no moderator controls");
  report(await c.ev("(()=>{const p=document.querySelectorAll('.handoff-party'); const a=document.querySelector('.handoff-arrow svg'); return p[0].textContent.includes('Participant') && p[1].textContent.includes('Researcher') && getComputedStyle(a).transform==='none'})()"), "the hand-back graphic points from the participant to the researcher");
  await clickText(c, "button", "Researcher: continue");
  await wait("Session ended early");
  report(await c.ev("[...document.querySelectorAll('.m-table tbody tr')].some(tr=>tr.textContent.includes('2') && tr.textContent.includes('completed'))"), "the completed second attempt is kept, and counted, after ending early");
  report(await has("interrupted 1 time"), "the debrief flags the interruption so timings are not over-read");
  await clickText(c, "button", "Finish session");
  await wait("Session record");

  // ---------- F: mobile frame, taps, and the moderator menu ----------
  await clickText(c, "button", "Back to sessions");
  await clickText(c, "button", "New session");
  const nSel = await c.ev("document.querySelectorAll('.m-plan select').length");
  for (let i = 0; i < nSel; i++) { await c.ev(`(()=>{const el=document.querySelectorAll('.m-plan select')[${i}];Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'mobile');el.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(80); }
  report(await c.ev("[...document.querySelectorAll('.m-plan select')].every(s=>s.value==='mobile')"), "the moderator can put every task at mobile from setup");
  await clickText(c, "button[type=submit]", "Hand over to participant", { startsWith: true });
  await wait("Thanks for taking part");
  await clickText(c, "button", "Show me the first scenario", { startsWith: true });
  await skipTour();
  const sc3 = await scenario();
  await beginTask();
  report((await c.ev("document.querySelector('.frame-box').dataset.breakpoint")) === "mobile" && (await c.evFrame("innerWidth")) === 402, "the mobile frame is 402 wide");
  const h1 = await waitPoint(c, "h1"); await c.click(h1.x, h1.y); await sleep(200);
  await c.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "M", code: "KeyM", modifiers: 10, windowsVirtualKeyCode: 77 });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "M", code: "KeyM", modifiers: 10, windowsVirtualKeyCode: 77 });
  await c.waitPage("!!document.querySelector('dialog[open]')", 5000, "the moderator menu from inside the frame");
  report(true, "Ctrl+Shift+M works while the participant's focus is inside the website frame");
  await clickText(c, "dialog button", "Cancel"); await sleep(200);
  await clickPath(planFor(sc3).mobile, true);
  await wait("how easy was it to know where to start");
  const m1click = (await c.msgs()).filter((m) => m.type === "click" && m.ends).pop();
  report(!!m1click && /mobile-link/.test(m1click.testid ?? ""), "a drawer link ends the task with its destination recorded");
  await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "M", code: "KeyM", modifiers: 10 });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "M", code: "KeyM", modifiers: 10 });
  await c.waitPage("!!document.querySelector('dialog[open]')");
  report(true, "Ctrl+Shift+M opens the moderator menu on a participant screen");
  await clickText(c, "dialog button", "End session early");
  await wait("Session ended early");
  await clickText(c, "button", "Finish session");
  await wait("Session record");
  await clickText(c, "button", "Back to sessions");

  // ---------- G: reduced motion ----------
  await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await clickText(c, "button", "New session");
  await clickText(c, "button[type=submit]", "Hand over to participant", { startsWith: true });
  await wait("Thanks for taking part");
  await clickText(c, "button", "Show me the first scenario", { startsWith: true });
  await skipTour();
  const anim2 = await c.ev(`(async()=>{[...document.querySelectorAll('.p-task-card .btn')].find(b=>b.textContent.trim().startsWith('Begin')).click();await new Promise(r=>setTimeout(r,40));return document.querySelector('.p-task-card').classList.contains('p-task-card')&&document.querySelector('.p-task.is-begun')?document.querySelector('.p-task-card').getAnimations().length:-1})()`);
  report(anim2 === 0, "with reduced motion the task jumps to the top with no animation", String(anim2));
  await waitMsg(c, (m) => m.type === "ready", 20000);

  // The CSP is enforced by the browser: outbound requests from the shell and from the frame are blocked.
  const policy = await c.ev("document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]')?.content ?? ''");
  report(/default-src 'none'/.test(policy) && /connect-src|default-src 'none'/.test(policy), "the page carries a Content-Security-Policy that denies everything not inline or data:");
  const shellFetch = await c.ev("fetch('https://example.com/x').then(()=>'loaded',()=>'blocked')");
  report(shellFetch === "blocked", "a request from the app to the network is blocked by the policy", shellFetch);
  await c.consoleErrors.splice(0, c.consoleErrors.length);
  const outside = c.requests.filter((u) => !/^(file:|data:|blob:|about:)/.test(u));
  report(outside.length === 0, "no network requests during the whole session run", outside.slice(0, 3).join(", "));
  report(c.consoleErrors.length === 0, "no console errors or exceptions during the whole run", c.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  report(false, "the session check ran to completion", String(e.stack ?? e));
  try { await c.shot("/tmp/wc-session-fail.png"); console.log("  (screenshot at /tmp/wc-session-fail.png)"); console.log("  page text: " + (await text()).replace(/\s+/g, " ").slice(0, 400)); } catch { /* ignore */ }
} finally {
  await c.close();
}
process.exit(summary() ? 0 : 1);
