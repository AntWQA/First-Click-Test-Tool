// Acceptance for the participant edition (dist-single/wayfinding-check-participant.html): a participant sets themselves up,
// works through scenarios with no moderator anywhere, ends, and saves a results file that the moderator tool can import.
// Build first: npm run build:participant.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, report, sleep, summary } from "./cdp.mjs";
import { clickText, waitMsg } from "./frame-geometry.mjs";
import { parseImport } from "../../src/shell/domain/exports.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const file = pathToFileURL(process.env.WC_FILE ?? path.join(root, "dist-single", "wayfinding-check-participant.html")).href;
// The values the file carries are fixed in src/shell/edition.ts.
import { NOTICE, SEND_TO } from "../../src/shell/edition.ts";
const CONTROLLER = NOTICE.controller, RETENTION = NOTICE.retention;
const downloads = fs.mkdtempSync(path.join(os.tmpdir(), "wc-sr-"));

const c = await launch({ width: 1500, height: 1000 });
await c.captureMessages();
await c.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
const text = () => c.ev("document.body.innerText");
const has = async (s) => (await text()).toLowerCase().includes(s.toLowerCase());
const wait = (s, timeout = 8000) => c.waitPage(`document.body.innerText.toLowerCase().includes(${JSON.stringify(s.toLowerCase())})`, timeout, `text "${s}"`);
const setField = (sel, v) => c.ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(v)});el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}))})()`);
const basics = "document.querySelectorAll('h1').length === 1 && [...document.querySelectorAll('input, select, textarea')].every((e) => e.labels && e.labels.length > 0) && [...document.querySelectorAll('button:not(.p-copy), .p-textlink, .p-admin-btn')].every((b) => b.getBoundingClientRect().height >= 40)";
const admin = async (item) => { await clickText(c, ".p-admin-btn", "Admin", { startsWith: true }); await clickText(c, ".p-admin-item", item); };
async function skipTour() { try { await c.waitPage("!!document.querySelector('.tour-tip')", 4000, "the tour"); await clickText(c, ".tour-tip button", "Skip"); await sleep(150); } catch { /* not shown */ } }
const recaps = [];
async function doScenario(ease) {
  await c.clearMsgs();
  await c.ev("[...document.querySelectorAll('.p-task-card .btn')].find(b=>b.textContent.trim().startsWith('Begin')).click()");
  await waitMsg(c, (m) => m.type === "ready", 20000);
  await c.waitPage("[...document.querySelectorAll('.p-actions .btn')].every(b=>!b.disabled)", 8000, "the end buttons to unlock");
  await sleep(200);
  await c.ev("[...document.querySelectorAll('.p-actions .btn')].find(b=>b.textContent==='I can\\'t find it'||b.textContent.trim()==='Done').click()");
  await wait("overall, how easy was it");
  recaps.push(await c.ev("document.querySelector('[data-testid=questions-again]')?.innerText ?? ''"));
  await c.ev(`document.querySelector('input[name=ease][value="${ease}"]').click()`);
  await c.ev(`document.querySelector('input[name=confidence][value="5"]')?.click()`);
  await clickText(c, "button", "Done");
}

try {
  await c.goto(file);
  await wait("Thanks for taking part", 20000);
  report(true, "the participant edition opens straight on a welcome and setup screen");
  const headerOnlyTheme = "document.querySelectorAll('header button').length === 1 && /mode/i.test(document.querySelector('header button').getAttribute('aria-label') ?? '') && document.querySelectorAll('header a, .m-tab').length === 0";
  report(await c.ev(headerOnlyTheme), "the header carries the brand and one light/dark button: no tabs, no shortcuts button");
  report(!(await has("Ledger")) && !(await has("Content")) && !(await has("Preview")) && !(await has("moderator")), "no moderator wording or screens are anywhere on it");
  report(await has("12 short scenarios"), "it says how many scenarios there are");
  report(await has("We are testing the website, not you."), "the intro says the website is being tested, not the participant");
  report(await c.ev(basics), "setup: one h1, every field has a visible label, every control is at least 40px tall");

  // The light/dark button makes a choice that is remembered across a reload.
  const themeAttr = () => c.ev("document.documentElement.getAttribute('data-theme')");
  const t0 = await themeAttr();
  await c.ev("document.querySelector('header button').click()"); await sleep(250);
  const t1 = await themeAttr();
  report(!!t0 && !!t1 && t0 !== t1, "the header button switches between light and dark", `${t0} then ${t1}`);
  await c.send("Page.reload"); await sleep(900); await wait("Thanks for taking part", 20000);
  report((await themeAttr()) === t1, "the participant's choice is remembered after a reload");
  // Without the button, it also follows the host's explicit light or dark choice, else the computer's setting, live.
  const bg = () => c.ev("getComputedStyle(document.body).backgroundColor");
  const lum = (rgb) => { const m = rgb.match(/\d+/g).map(Number); return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255; };
  await c.ev("document.documentElement.setAttribute('data-theme', 'dark')"); await sleep(250);
  const dark = lum(await bg());
  await c.ev("document.documentElement.setAttribute('data-theme', 'light')"); await sleep(250);
  const light = lum(await bg());
  report(dark < 0.3 && light > 0.7, "it follows the host's explicit dark or light choice as it changes", `dark ${dark.toFixed(2)}, light ${light.toFixed(2)}`);
  await c.ev("document.documentElement.removeAttribute('data-theme')");
  await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] }); await sleep(350);
  const sysDark = lum(await bg());
  await c.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] }); await sleep(350);
  const sysLight = lum(await bg());
  report(sysDark < 0.3 && sysLight > 0.7, "with no host choice it follows the computer's light or dark setting, live", `dark ${sysDark.toFixed(2)}, light ${sysLight.toFixed(2)}`);
  await clickText(c, "button[type=submit]", "Start", { startsWith: true });
  await sleep(200);
  report(await has("Enter the code you were given"), "starting without a code is refused with a plain message");
  await setField("#pid", "P 7"); await clickText(c, "button[type=submit]", "Start", { startsWith: true });
  report(await has("letters and numbers only"), "a code with a space is refused");
  await setField("#pid", "SR1");
  report(await has("How your results are used") && (await has(CONTROLLER)) && (await has(RETENTION)) && !(await has("not set]")), "setup shows a privacy notice naming who runs the study and how long results are kept", `${CONTROLLER} / ${RETENTION}`);
  report((await has(SEND_TO)) && (await has("do not put your name")), "the notice says where to send or ask for deletion, and warns against names and health details");
  report(await c.ev("document.querySelector('#adult')?.type === 'checkbox' && !document.querySelector('#adult').checked"), "there is an unticked age statement, I am 18 or over");
  // On a short laptop screen the setup card is taller than the window: its top must still be reachable, and so must Start.
  await c.resize(1100, 640);
  const topOk = await c.ev("(()=>{const e=document.querySelector('.p-setup .p-eyebrow').getBoundingClientRect(); const h=document.querySelector('header').getBoundingClientRect(); return e.top >= h.bottom - 1})()");
  await c.ev("document.querySelector('.p-setup button[type=submit]').scrollIntoView()"); await sleep(200);
  const startOk = await c.ev("(()=>{const b=document.querySelector('.p-setup button[type=submit]').getBoundingClientRect(); return b.bottom <= innerHeight + 1 && b.top >= 0})()");
  await c.ev("document.querySelector('.p-screen').scrollTop = 0; document.querySelector('.p-setup').scrollIntoView({block:'start'})");
  report(topOk && startOk, "on a short screen the top of the setup card is visible and Start can be scrolled to", `top ${topOk}, start ${startOk}`);
  await c.resize(1500, 1000);
  report(!(await c.ev("[...document.querySelectorAll('#grp option')].some((o) => /prefer not/i.test(o.textContent))")), "the membership question has no Prefer not to say answer");
  await clickText(c, "button[type=submit]", "Start", { startsWith: true });
  report(await has("choose one of the answers about membership"), "starting without answering the membership question is refused");
  await setField("#grp", "WC");
  await clickText(c, "button[type=submit]", "Start", { startsWith: true });
  report(await has("confirm that you are 18 or over"), "starting without the age statement is refused");
  await c.ev("document.querySelector('#adult').click()");
  await clickText(c, "button[type=submit]", "Start", { startsWith: true });

  await c.waitPage("!!document.querySelector('.p-task-card')", 8000, "the first scenario");
  report(await has("You'll be viewing"), "starting goes straight to the first scenario, with the breakpoint label (no second welcome screen)");
  await c.waitPage("!!document.querySelector('.tour-tip')", 5000, "the onboarding tour");
  report(true, "the first scenario carries the two-step onboarding tour");
  report(await c.ev(headerOnlyTheme), "the scenario screens have the same single light/dark button and nothing else");
  await clickText(c, ".tour-tip button", "Skip"); await sleep(200);
  await doScenario(3);
  report(/questions again/i.test(recaps[0] ?? "") && /What does dōTERRA sell\?/.test(recaps[0]) && /Who are its products for\?/.test(recaps[0]) && /What makes dōTERRA different/.test(recaps[0]), "after the first scenario the notes screen repeats its three questions above the notes box", (recaps[0] ?? "").replace(/\s+/g, " "));
  await wait("Ready for the next scenario?");
  report((await has("Scenario 2 of 12")) && !(await has("Researcher: continue")), "after a scenario the next one is offered at once, with no hand-back");

  // Closing the window part-way through must not lose anything.
  await c.send("Page.reload"); await sleep(900);
  await wait("Ready for the next scenario?", 20000);
  report(await has("Scenario 2 of 12"), "reloading part-way through carries on at the same place");

  // Ctrl+Shift+M is the moderator's end-early menu; it does not exist here.
  await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "M", code: "KeyM", modifiers: 10 });
  await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "M", code: "KeyM", modifiers: 10 });
  await sleep(300);
  report(!(await c.ev("!!document.querySelector('dialog[open]')")), "Ctrl+Shift+M opens nothing");

  await clickText(c, "button", "Show me the next scenario", { startsWith: true });
  await doScenario(5);
  await wait("Ready for the next scenario?");
  await clickText(c, ".p-admin-btn", "Admin", { startsWith: true });
  report((await c.ev("[...document.querySelectorAll('.p-admin-item')].map(b=>b.textContent.trim()).join('|')")) === "End session|Clear my progress in this test and start again", "the participant's Admin list holds End session and Clear my progress, and nothing else");
  await c.key("Escape", "Escape"); await sleep(200);
  await admin("End session"); await c.waitPage("!!document.querySelector('dialog[open]')");
  report((await c.ev("document.querySelector('dialog[open]').textContent")).includes("send your results"), "End session asks first, and says where it leads (sending the results, not a hand-back)");
  await clickText(c, "dialog button", "Yes, end the session");

  await wait("Thank you for your time");
  report(!(await has("Researcher: continue")) && !(await has("hand the device")), "ending early lands on the results page, not a hand-back screen");
  report(await has("You finished 2 scenarios"), "it says how many scenarios were finished");
  report(await c.ev(basics), "results page: one h1, every field has a visible label, every control is at least 40px tall");
  report(await has(SEND_TO), "it tells the participant where to send the file", SEND_TO);
  report(await c.ev(headerOnlyTheme), "the results page has the same single light/dark button and nothing else");

  await setField("#fin-notes", "The Learn menu was not what I expected.");
  await clickText(c, "button", "Save my results", { startsWith: true });
  await wait("Saved as doterra_research_SR1_");
  await sleep(700);
  const files = fs.readdirSync(downloads).filter((f) => f.endsWith(".json"));
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  report(files.length === 1 && files[0] === `doterra_research_SR1_${today}.json`, "Save my results downloads one file named doterra_research_<code>_<date>.json", files.join(","));
  const parsed = files.length ? parseImport(fs.readFileSync(path.join(downloads, files[0]), "utf8")) : { sessions: [], error: "none" };
  const s = parsed.sessions[0];
  report(parsed.error === null && parsed.sessions.length === 1, "the moderator tool's import accepts the file");
  report(!!s && s.participantId === "SR1" && s.group === "WC" && s.selfRun === true && s.status === "ended-early" && s.phase === "ended", "it holds the participant's code and group, marked self-run, ended early and closed", s && JSON.stringify({ id: s.participantId, g: s.group, self: s.selfRun, st: s.status, ph: s.phase }));
  report(!!s && s.runs.filter((r) => r.status === "completed").length === 2 && s.debriefNotes === "The Learn menu was not what I expected.", "it holds both finished scenarios and the participant's note");

  await clickText(c, "button", "Copy instead");
  await sleep(500);
  report((await has("Copied")) || (await c.ev("!!document.querySelector('#fin-copy')")), "Copy instead either copies or, where the browser refuses, shows the text to copy by hand");

  await c.send("Page.reload"); await sleep(900);
  await wait("Thank you for your time", 20000);
  report((await has("Save my results")) && (await c.ev("document.querySelector('#fin-notes').readOnly")), "after a reload the results page is still there, to save again, with the note locked");
  await admin("Start a new session");
  await wait("Thanks for taking part");
  report(await has("Your code"), "Start a new session returns to setup");

  const outside = c.requests.filter((u) => !/^(file:|data:|blob:|about:)/.test(u));
  report(outside.length === 0, "no network requests were made", outside.slice(0, 3).join(", "));
  report(c.consoleErrors.length === 0, "no console errors or exceptions", c.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  report(false, "the participant edition check ran to completion", String(e.stack ?? e));
  try { await c.shot("/tmp/wc-selfrun-fail.png"); console.log("  (screenshot at /tmp/wc-selfrun-fail.png)"); console.log("  page text: " + (await text()).replace(/\s+/g, " ").slice(0, 400)); } catch { /* ignore */ }
} finally {
  await c.close();
}
process.exit(summary() ? 0 : 1);
