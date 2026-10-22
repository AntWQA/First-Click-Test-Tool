// A browser that saved a copy of an earlier default (Content tab, Reset then Save) must pick up the current wording, and a
// researcher's own edit must survive. Plants the saved copy in local storage, loads the built file and reads the Content tab.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, report, sleep, summary } from "./cdp.mjs";
import { clickText } from "./frame-geometry.mjs";
import { validateContent } from "../../src/shell/domain/content.ts";
import { createSession, reduce } from "../../src/shell/domain/session.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const file = pathToFileURL(process.env.WC_FILE ?? path.join(root, "dist-single", "wayfinding-check.html")).href;
const old = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/combined-default-2026-10-22.json"), "utf8"));
const edited = structuredClone(old);
edited.tasks.find((t) => t.id === "C7").scenario = "There are two ways to buy on the page. Describe them.";

const c = await launch({ width: 1500, height: 1000 });
const contentText = async () => { await clickText(c, ".m-tab", "Content"); await sleep(300); return c.ev("document.querySelector('.m-code').value"); };
const load = async (saved) => {
  await c.goto(file);
  await c.ev(`localStorage.setItem('wc.v1.content', ${JSON.stringify(JSON.stringify(saved))})`);
  await c.send("Page.reload"); await sleep(900);
  await c.waitPage("document.querySelectorAll('.m-tab').length === 4", 20000);
  return contentText();
};
try {
  let text = await load({ ...old, version: 5 });
  report(!text.includes("buy this on the page") && text.includes("dōTERRA Lavender essential oil"), "a saved copy of the earlier default shows the current wording");
  report((await c.ev("localStorage.getItem('wc.v1.content')")) === null, "and the stale copy is removed from storage");
  text = await load(edited);
  report(text.includes("There are two ways to buy on the page. Describe them."), "an edited copy keeps the researcher's wording");
  // A session that began on the earlier default, with nothing run yet, shows the current wording when it is resumed.
  const oldContent = validateContent(old);
  let sess = createSession({ id: "stale1", now: Date.now() - 60_000, participantId: "P1", content: oldContent.content });
  sess = reduce(sess, { type: "start", at: Date.now() - 59_000 });
  await c.goto(file);
  await c.ev(`localStorage.removeItem('wc.v1.content'); localStorage.setItem('wc.v1.session.stale1', ${JSON.stringify(JSON.stringify(sess))})`);
  await c.send("Page.reload"); await sleep(900);
  await c.waitPage("document.querySelectorAll('.m-tab').length === 4", 20000);
  await clickText(c, "button", "Open", { startsWith: true });
  await c.waitPage("document.body.innerText.includes('Thanks for taking part')", 8000, "the participant welcome");
  await clickText(c, "button", "Show me the first scenario", { startsWith: true });
  await c.waitPage("!!document.querySelector('.p-task-card')", 8000, "the first scenario");
  const shown = await c.ev("document.querySelector('.p-task-card').innerText");
  report(/homepage of the dōTERRA website/.test(shown) && !/this website|this company/.test(shown), "a session begun on the earlier default shows the current scenario wording", shown.slice(0, 160).replace(/\s+/g, " "));
  report(c.consoleErrors.length === 0, "no console errors", c.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  report(false, "the check ran to completion", String(e.stack ?? e));
} finally {
  await c.close();
}
process.exit(summary() ? 0 : 1);
