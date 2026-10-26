// Acceptance for the researcher's side of the return path: files from participants are reviewed before they join the Ledger,
// and a hostile file cannot replace genuine results or supply its own answers. Drives the built moderator tool
// (dist-single/wayfinding-check.html) with real crafted files.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, report, sleep, summary } from "./cdp.mjs";
import { clickText } from "./frame-geometry.mjs";
import { DEFAULT_CONTENT } from "../../src/shell/domain/tasks.ts";
import { createSession, reduce } from "../../src/shell/domain/session.ts";
import { toJsonBundle } from "../../src/shell/domain/exports.ts";
import { leaf, open, ready } from "../../tests/helpers.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const file = pathToFileURL(process.env.WC_FILE ?? path.join(root, "dist-single", "wayfinding-check.html")).href;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wc-imp-"));
const T0 = Date.now() - 60_000;
let n = 0;

/** A participant-edition session with C8 (Sleep) done: a correct click when `right`, otherwise a wrong one. */
function selfRun(id, code, right) {
  let s = createSession({ id, now: T0, participantId: code, selfRun: true, content: DEFAULT_CONTENT });
  s = { ...s, order: ["C8"], plan: { C8: "desktop" } };
  s = reduce(s, { type: "start", at: T0 });
  s = reduce(s, { type: "present", at: T0, runId: "r" + ++n });
  s = reduce(s, { type: "begin", at: T0 + 1000, scale: 1 });
  const ev = right ? [ready(0), open("shop", 200), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 1500)] : [ready(0), open("learn", 200), leaf("/learn/essential-oils/discover-solutions", "learn", "Essential Oils", 1500)];
  for (const e of ev) s = reduce(s, { type: "event", event: e });
  s = reduce(s, { type: "end", at: T0 + 9000, reason: "destination" });
  s = reduce(s, { type: "rate", at: T0 + 9500, ease: 5, notes: "" });
  s = reduce(s, { type: "declineReserves", at: T0 + 9550 });
  return reduce(s, { type: "complete", at: T0 + 9600, notes: "" });
}
const write = (name, sessions, tweak) => {
  const bundle = JSON.parse(toJsonBundle(sessions, DEFAULT_CONTENT, "x"));
  if (tweak) tweak(bundle);
  const p = path.join(dir, name); fs.writeFileSync(p, JSON.stringify(bundle)); return p;
};
const clean = write("doterra_research_SR1_2026-10-16.json", [selfRun("ok1", "SR1", true)]);
const clash = write("doterra_research_SR1_clash.json", [selfRun("evil1", "sr1", false)], (b) => { b.sessions[0].createdAt = Date.now() + 80_000_000; });
const forged = write("doterra_research_SR2.json", [selfRun("forge", "SR2", false)], (b) => { b.sessions[0].content.tasks.find((t) => t.id === "C8").primary = [{ href: "/learn/essential-oils/discover-solutions" }]; b.sessions[0].runs[0].moderator = { menu: "U", observed: "forged", interpretation: "", expected: "", secondChance: "", overrideReason: "", reviewed: true, tier: "P", code: null, level1: true }; });
const weirdCode = write("doterra_research_weird.json", [selfRun("w1", "SR3", true)], (b) => { b.sessions[0].participantId = "SР3"; });
const flood = write("flood.json", [selfRun("f0", "F0", true)], (b) => { const one = b.sessions[0]; b.sessions = Array.from({ length: 101 }, (_, i) => ({ ...structuredClone(one), id: "f" + i, participantId: "F" + i })); });

const c = await launch({ width: 1500, height: 1000 });
const text = () => c.ev("document.body.innerText");
const has = async (s) => (await text()).toLowerCase().includes(s.toLowerCase());
const wait = (s, timeout = 8000) => c.waitPage(`document.body.innerText.toLowerCase().includes(${JSON.stringify(s.toLowerCase())})`, timeout, `text "${s}"`);
const rows = () => c.ev("document.querySelectorAll('.m-table tbody tr').length");
async function pick(p) {
  const doc = (await c.send("DOM.getDocument", { depth: 0 })).result.root.nodeId;
  const input = (await c.send("DOM.querySelector", { nodeId: doc, selector: "input[type=file]" })).result.nodeId;
  await c.send("DOM.setFileInputFiles", { files: [p], nodeId: input });
}
const dialog = () => c.ev("document.querySelector('dialog[open]')?.innerText ?? ''");

try {
  await c.goto(file);
  await c.waitPage("document.querySelectorAll('.m-tab').length === 3", 20000, "tabs");

  // 1. A clean participant file: reviewed first, with where it came from, then imported.
  await pick(clean);
  await c.waitPage("!!document.querySelector('dialog[open]')", 6000, "the import review");
  let d = await dialog();
  report(/doterra_research_SR1_2026-10-16\.json/.test(d) && /SHA-256 [0-9a-f]{64}/.test(d), "an import opens a review showing the file name and its SHA-256", d.slice(0, 120).replace(/\s+/g, " "));
  report(/Nothing looks wrong/.test(d) && /SR1/.test(d) && /self-run/.test(d), "a clean participant file shows nothing wrong");
  report((await c.ev("document.querySelectorAll('.m-tab[aria-current=page]').length")) === 1 && !(await c.ev("[...document.querySelectorAll('main .m-table tbody tr')].some((tr)=>tr.textContent.includes('SR1') && tr.textContent.includes('self-run') && tr.closest('dialog') === null)")), "nothing is in the Sessions list yet, so cancelling would leave the Ledger untouched");
  await clickText(c, "dialog button", "Import 1 session");
  await wait("Imported 1 session");
  report(await c.ev("[...document.querySelectorAll('main .m-table tbody tr')].some((tr)=>/SR1/.test(tr.textContent) && /self-run/.test(tr.textContent) && /from doterra_research_SR1_2026-10-16\\.json/.test(tr.textContent))"), "the imported session is listed as self-run, with the file it came from");

  // 2. A hostile file reusing the same code, dated far in the future: held back by default.
  await pick(clash);
  await c.waitPage("!!document.querySelector('dialog[open]')", 6000, "the second review");
  d = await dialog();
  report(/already belongs to a different session/.test(d) && /set to skip/.test(d), "a file reusing an existing code (in another case, with a forged future date) is flagged and held back");
  report(await c.ev("document.querySelector('dialog[open] select').value === 'skip' && [...document.querySelectorAll('dialog[open] .btn-primary')].some((b) => b.disabled)"), "it defaults to Skip, and Import is unavailable while everything is skipped");
  await clickText(c, "dialog button", "Cancel"); await sleep(250);
  report((await rows()) === 1, "cancelling changes nothing");

  // 3. A file with a forged answer key and forged findings: scored against this tool's own tasks, findings ignored.
  await pick(forged);
  await c.waitPage("!!document.querySelector('dialog[open]')", 6000, "the third review");
  d = await dialog();
  report(/Scored against your tasks/.test(d) && /C8/.test(d), "a forged answer key is replaced by this tool's, and the review says so");
  await clickText(c, "dialog button", "Import 1 session"); await wait("Imported 1 session");
  await clickText(c, ".m-tab", "Ledger"); await wait("Add or edit findings");
  const ledger = await c.ev("[...document.querySelectorAll('.m-ledger tbody tr')].map((tr) => tr.innerText.replace(/\\s+/g, ' ')).join(' | ')");
  report(/1\/2/.test(ledger) && /Learn 1/.test(ledger) && /0 of 2/.test(ledger), "the Ledger counts the forged-key session as a miss on the real key (1 of 2 correct, one misread of Learn), with no findings from the file", ledger.slice(0, 160));
  report(await c.ev("[...document.querySelectorAll('.m-findings tbody tr')].every((tr) => /None yet/.test(tr.textContent))"), "no findings arrive from a participant file");
  await clickText(c, ".m-tab", "Sessions");

  // 4. A code a participant could not have typed is refused outright.
  await pick(weirdCode); await sleep(500);
  report(await has("could not have typed") || await has("Nothing in that file could be read"), "a file whose code has look-alike characters is refused", (await text()).slice(0, 80));

  // 5. Too many sessions in one file.
  await pick(flood); await sleep(500);
  report(await has("no file may hold more than 100"), "a file with more than 100 sessions is refused");
  report((await rows()) === 2, "after all of that exactly the two accepted sessions are in the list");

  report(c.consoleErrors.length === 0, "no console errors", c.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  report(false, "the import check ran to completion", String(e.stack ?? e));
  try { await c.shot("/tmp/wc-import-fail.png"); console.log("  (screenshot at /tmp/wc-import-fail.png)"); console.log("  page text: " + (await text()).replace(/\s+/g, " ").slice(0, 400)); } catch { /* ignore */ }
} finally {
  await c.close();
}
process.exit(summary() ? 0 : 1);
