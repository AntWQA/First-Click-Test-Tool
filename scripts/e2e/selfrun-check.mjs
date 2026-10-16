// Acceptance for the participant edition (dist-single/wayfinding-check-participant.html): a participant sets themselves up,
// works through scenarios with no moderator anywhere, ends, and saves a results file that the moderator tool can import.
// Build first: npm run build:participant (add WC_SEND_TO=you@example.com to check an address, and set the same variable here).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, report, sleep, summary } from "./cdp.mjs";
import { clickText, waitMsg } from "./frame-geometry.mjs";
import { parseImport } from "../../src/shell/domain/exports.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const file = pathToFileURL(process.env.WC_FILE ?? path.join(root, "dist-single", "wayfinding-check-participant.html")).href;
// Set WC_SEND_TO to the address the file was built with; leave it unset to check the file built without one.
const SEND_TO = process.env.WC_SEND_TO ?? "";
const downloads = fs.mkdtempSync(path.join(os.tmpdir(), "wc-sr-"));

const c = await launch({ width: 1500, height: 1000 });
await c.captureMessages();
await c.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
const text = () => c.ev("document.body.innerText");
const has = async (s) => (await text()).toLowerCase().includes(s.toLowerCase());
const wait = (s, timeout = 8000) => c.waitPage(`document.body.innerText.toLowerCase().includes(${JSON.stringify(s.toLowerCase())})`, timeout, `text "${s}"`);
const setField = (sel, v) => c.ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(v)});el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}))})()`);
const basics = "document.querySelectorAll('h1').length === 1 && [...document.querySelectorAll('input, select, textarea')].every((e) => e.labels && e.labels.length > 0) && [...document.querySelectorAll('button, .p-textlink')].every((b) => b.getBoundingClientRect().height >= 40)";
async function skipTour() { try { await c.waitPage("!!document.querySelector('.tour-tip')", 4000, "the tour"); await clickText(c, ".tour-tip button", "Skip"); await sleep(150); } catch { /* not shown */ } }
async function doScenario(ease) {
  await c.clearMsgs();
  await c.ev("[...document.querySelectorAll('.p-task-card .btn')].find(b=>b.textContent.trim().startsWith('Begin')).click()");
  await waitMsg(c, (m) => m.type === "ready", 20000);
  await c.waitPage("[...document.querySelectorAll('.p-actions .btn')].every(b=>!b.disabled)", 8000, "the end buttons to unlock");
  await sleep(200);
  await c.ev("[...document.querySelectorAll('.p-actions .btn')].find(b=>b.textContent==='I can\\'t find it').click()");
  await wait("how easy was it to know where to start");
  await c.ev(`document.querySelector('input[name=ease][value="${ease}"]').click()`);
  await clickText(c, "button", "Done");
}

try {
  await c.goto(file);
  await wait("Thanks for taking part", 20000);
  report(true, "the participant edition opens straight on a welcome and setup screen");
  report(await c.ev("document.querySelectorAll('header button, header a, .m-tab').length === 0"), "the header carries only the brand: no tabs, no shortcuts button, no theme toggle");
  report(!(await has("Ledger")) && !(await has("Content")) && !(await has("Preview")) && !(await has("moderator")), "no moderator wording or screens are anywhere on it");
  report(await has("12 short scenarios"), "it says how many scenarios there are");
  report(await c.ev(basics), "setup: one h1, every field has a visible label, every control is at least 40px tall");

  await clickText(c, "button[type=submit]", "Start", { startsWith: true });
  await sleep(200);
  report(await has("Enter the code you were given"), "starting without a code is refused with a plain message");
  await setField("#pid", "P 7"); await clickText(c, "button[type=submit]", "Start", { startsWith: true });
  report(await has("letters and numbers only"), "a code with a space is refused");
  await setField("#pid", "SR1");
  report(!(await c.ev("[...document.querySelectorAll('#grp option')].some((o) => /prefer not/i.test(o.textContent))")), "the membership question has no Prefer not to say answer");
  await clickText(c, "button[type=submit]", "Start", { startsWith: true });
  report(await has("choose one of the answers about membership"), "starting without answering the membership question is refused");
  await setField("#grp", "WC");
  await clickText(c, "button[type=submit]", "Start", { startsWith: true });

  await c.waitPage("!!document.querySelector('.p-task-card')", 8000, "the first scenario");
  report(await has("You'll be viewing"), "starting goes straight to the first scenario, with the breakpoint label (no second welcome screen)");
  await c.waitPage("!!document.querySelector('.tour-tip')", 5000, "the onboarding tour");
  report(true, "the first scenario carries the two-step onboarding tour");
  report(!(await c.ev("!!document.querySelector('header button')")), "no header options on the scenario screens either");
  await clickText(c, ".tour-tip button", "Skip"); await sleep(200);
  await doScenario(3);
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
  await clickText(c, ".p-textlink", "End session"); await c.waitPage("!!document.querySelector('dialog[open]')");
  report((await c.ev("document.querySelector('dialog[open]').textContent")).includes("send your results"), "End session asks first, and says where it leads (sending the results, not a hand-back)");
  await clickText(c, "dialog button", "Yes, end the session");

  await wait("Thank you for your time");
  report(!(await has("Researcher: continue")) && !(await has("hand the device")), "ending early lands on the results page, not a hand-back screen");
  report(await has("You finished 2 scenarios"), "it says how many scenarios were finished");
  report(await c.ev(basics), "results page: one h1, every field has a visible label, every control is at least 40px tall");
  report(SEND_TO ? await has(SEND_TO) : await has("Send it to the researcher who gave you this tool"), "it tells the participant where to send the file", SEND_TO || "no address built in");
  report(await c.ev("document.querySelectorAll('header button').length === 0"), "the results page has no header options either");

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
  await clickText(c, ".p-textlink", "Start a new session");
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
