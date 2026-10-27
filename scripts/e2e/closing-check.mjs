// The participant edition's debrief: after the last scenario a screen of closing questions comes before the results page.
// Plants a session at the hand-back screen (as if the last scenario had just been rated), then drives the real screens.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, report, sleep, summary } from "./cdp.mjs";
import { clickText, setValue } from "./frame-geometry.mjs";
import { DEFAULT_CONTENT } from "../../src/shell/domain/tasks.ts";
import { createSession, reduce } from "../../src/shell/domain/session.ts";
import { parseImport } from "../../src/shell/domain/exports.ts";
import { leaf, open, ready } from "../../tests/helpers.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pfile = pathToFileURL(process.env.WC_PARTICIPANT_FILE ?? path.join(root, "dist-single", "wayfinding-check-participant.html")).href;
const mfile = pathToFileURL(process.env.WC_FILE ?? path.join(root, "dist-single", "wayfinding-check.html")).href;
import { SEND_TO } from "../../src/shell/edition.ts";
const downloads = fs.mkdtempSync(path.join(os.tmpdir(), "wc-cl-"));
const T0 = Date.now() - 120_000;

function atHandBack(id, pid, selfRun = true) {
  let s = createSession({ id, now: T0, participantId: pid, selfRun, content: DEFAULT_CONTENT });
  s = { ...s, order: ["C9"], plan: { C9: "desktop" } };
  s = reduce(s, { type: "start", at: T0 });
  s = reduce(s, { type: "present", at: T0, runId: "r" + id });
  s = reduce(s, { type: "begin", at: T0 + 1000, scale: 1 });
  for (const e of [ready(0), open("shop", 200), leaf("/shop/goal/sleep-solutions", "shop", "Shop by Goal", 1500)]) s = reduce(s, { type: "event", event: e });
  s = reduce(s, { type: "end", at: T0 + 9000, reason: "destination" });
  s = reduce(s, { type: "rate", at: T0 + 9500, ease: 5, notes: "" });
  return reduce(s, { type: "declineReserves", at: T0 + 9550 });
}

const c = await launch({ width: 1300, height: 900 });
await c.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
const text = () => c.ev("document.body.innerText");
const has = async (t) => (await text()).toLowerCase().includes(t.toLowerCase());
const plant = async (file, session) => {
  await c.goto(file);
  await c.ev(`localStorage.setItem('wc.v1.session.${session.id}', ${JSON.stringify(JSON.stringify(session))})`);
  await c.send("Page.reload"); await sleep(1200);
};
try {
  // ---- the closing questions, answered
  await plant(pfile, atHandBack("cl1", "SR1"));
  await c.waitPage("document.body.innerText.includes('A few last questions')", 15000, "the closing questions");
  report(true, "after the last scenario the closing questions come before the results page");
  report((await c.ev("document.querySelectorAll('h1').length")) === 1 && (await c.ev("document.activeElement?.tagName")) === "H1", "one h1, with focus on it");
  report((await c.ev("document.querySelectorAll('.p-choice').length")) === 6 && (await c.ev("document.querySelectorAll('.p-order-card').length")) === 4 && (await c.ev("document.querySelectorAll('textarea').length")) === 0, "six multiple choice questions and one ranking of four cards, with no typing box until an option opens one (R2 was not run, so its question is asked)");
  report(await c.ev("[...document.querySelectorAll('input[type=radio]')].every((e) => e.labels && e.labels.length > 0)"), "every option has a visible label");
  report(await c.ev("[...document.querySelectorAll('button, .p-choice-row, textarea')].every((b) => b.getBoundingClientRect().height >= 40)"), "every control is at least 40px tall");
  const t = await text();
  report(!/\b(this|these)\b/i.test(t.split("A few last questions")[1].split("Continue")[0]), "the questions never say this or these");
  report(t.toLowerCase().includes("imagine the gallery on the dōterra metapwr advantage page") && t.toLowerCase().includes("every question is optional"), "each question names what it is about, and the screen says every one is optional");

  // the video question: Yes or No opens a box, Don't know does not
  report(!(await c.ev("!!document.querySelector('#cq-video-words')")), "no box shows before an option is chosen");
  await c.ev("document.querySelector('#cq-video-2').click()"); await sleep(150);
  report(!(await c.ev("!!document.querySelector('#cq-video-words')")), "choosing Don't know opens no box");
  await c.ev("document.querySelector('#cq-video-0').click()"); await sleep(150);
  report(await c.ev("document.querySelector('label[for=cq-video-words]')?.textContent.includes('How would it have changed')"), "choosing Yes opens a box that asks how it would have changed things");
  await c.ev("document.querySelector('#cq-video-1').click()"); await sleep(150);
  report(await c.ev("document.querySelector('label[for=cq-video-words]')?.textContent.includes('Why would it not')"), "choosing No opens a box that asks why not");
  await c.ev("document.querySelector('#cq-video-0').click()"); await sleep(150);
  await setValue(c, "#cq-video-words", "A video would help me trust the product.");
  // the other questions: Other opens a box, an ordinary option does not
  await c.ev("document.querySelector('#cq-changeHome-1').click()"); await sleep(150);
  report(!(await c.ev("!!document.querySelector('#cq-changeHome-words')")), "an ordinary option opens no box");
  await c.ev("document.querySelector('#cq-changeHome-2').click()"); await sleep(150);
  await c.ev("document.querySelector('#cq-changeProduct-6').click()"); await sleep(150);
  report(await c.ev("document.querySelector('label[for=cq-changeProduct-words]')?.textContent.includes('Please say what')"), "choosing Other opens a box that asks what");
  await setValue(c, "#cq-changeProduct-words", "Bigger photos.");
  // the ranking: nothing is recorded until a card moves; the arrow buttons move a card, and dragging by the handle does too
  report(await c.ev("document.querySelector('.p-order-status').textContent.includes('The order is right')"), "before any card is moved the order is not recorded, and the participant can say it is right");
  await c.ev("document.querySelector('#cq-rank-down-0').click()"); await sleep(200);
  report(await c.ev("[...document.querySelectorAll('.p-order-label')].map((e) => e.textContent)[1].startsWith('Customer reviews') && document.querySelector('.p-order-status').textContent.includes('saved')"), "the arrow button moves a card down a place, and the order is then saved");
  report(await c.ev("document.activeElement?.id") === "cq-rank-down-1", "and focus follows the card, so the keyboard user can keep going");
  await c.ev("document.querySelector('.p-order').scrollIntoView({ block: 'center' })"); await sleep(300);
  const pts = JSON.parse(await c.ev("JSON.stringify([...document.querySelectorAll('.p-order-grip')].map((b) => { const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }))"));
  await c.mouse("mouseMoved", pts[3][0], pts[3][1]);
  await c.mouse("mousePressed", pts[3][0], pts[3][1]);
  for (const y of [pts[3][1] - 30, pts[2][1], pts[1][1], pts[0][1] - 10]) { await c.mouse("mouseMoved", pts[3][0], y, { buttons: 1 }); await sleep(60); }
  await c.mouse("mouseReleased", pts[3][0], pts[0][1] - 10);
  await sleep(200);
  report(await c.ev("[...document.querySelectorAll('.p-order-label')].map((e) => e.textContent)[0].startsWith('A short video')"), "dragging a card by its handle moves it to the top");
  report(await c.ev("[...document.querySelectorAll('.p-order-label')].map((e) => e.textContent).length") === 4 && new Set(await c.ev("[...document.querySelectorAll('.p-order-label')].map((e) => e.textContent)")).size === 4, "and no card is lost or repeated");
  await clickText(c, "button", "Continue");
  await c.waitPage("document.body.innerText.includes('Thank you for finishing the scenarios')", 8000, "the results page");
  const r = await text();
  report(!r.includes("no more questions") && !r.includes("nothing more to do"), "the results page no longer says there is nothing more to do");
  report(r.includes("You finished 1 scenario."), "it still says how many scenarios were finished");

  // Copy beside the address
  if (SEND_TO) {
    report(await c.ev("!!document.querySelector('.p-finish-steps .p-copy')"), "a small Copy button sits beside the email address");
    report(await c.ev("document.querySelector('.p-finish-steps .p-copy svg') !== null && document.querySelector('.p-finish-steps .p-copy').getBoundingClientRect().height >= 24"), "it carries an icon and is a small button, still over the 24px minimum target");
    report(await c.ev("(()=>{const b=document.querySelector('.p-finish-steps .p-copy').getBoundingClientRect();const li=document.querySelector('.p-finish-steps li:last-child');const prev=document.querySelector('.p-finish-steps li:first-child').getBoundingClientRect();return b.height <= 30 && b.top - prev.bottom >= 2})()"), "it is no taller than 30px and does not touch the line above");
    await c.ev("document.querySelector('.p-finish-steps .p-copy').click()");
    await sleep(500);
    const after = await c.ev("document.querySelector('.p-finish-steps .p-copy').innerText + ' | ' + document.querySelector('.p-finish-steps [role=status]').innerText");
    report(/Copied/.test(after) || /Selected/.test(after), "pressing it copies the address, or where the browser refuses selects it and says how to copy", after);
  }

  await clickText(c, "button", "Save my results", { startsWith: true });
  await sleep(900);
  const files = fs.readdirSync(downloads).filter((f) => f.endsWith(".json"));
  const parsed = files.length ? parseImport(fs.readFileSync(path.join(downloads, files[0]), "utf8")) : { sessions: [], error: "none" };
  const closing = parsed.sessions[0]?.closing ?? {};
  report(closing.video === "Yes: A video would help me trust the product." && closing.changeHome === "Show prices sooner" && closing.changeProduct === "Other: Bigger photos." && Array.isArray(closing.rank) && closing.rank[0].startsWith("A short video") && closing.rank[1].startsWith("The CPTG"), "the saved results file holds the answers, with the ranking in order", JSON.stringify(closing).slice(0, 700));
  report(!("noReviews" in closing), "a question left blank is not recorded");

  await c.send("Page.reload"); await sleep(1200);
  await c.waitPage("document.body.innerText.includes('Thank you for finishing the scenarios')", 15000, "the results page after reload");
  report(!(await has("A few last questions")), "after a reload the closing questions are not asked again");

  // ---- skipping every question still goes on
  await plant(pfile, atHandBack("cl2", "SR2"));
  await c.ev("localStorage.removeItem('wc.v1.session.cl1')");
  await c.send("Page.reload"); await sleep(1200);
  await c.waitPage("document.body.innerText.includes('A few last questions')", 15000, "the closing questions again");
  await clickText(c, "button", "Continue");
  await c.waitPage("document.body.innerText.includes('Thank you for finishing the scenarios')", 8000, "the results page after skipping");
  report(true, "pressing Continue with nothing filled in goes straight on to the results page");

  // ---- the moderator's record shows what an imported participant answered
  let done = reduce(atHandBack("cl3", "SR3"), { type: "closing", at: T0 + 10_000, answers: { video: "Yes: A video would help.", changeProduct: "Make the price and the ways to buy clearer" } });
  done = reduce(done, { type: "complete", at: T0 + 11_000, notes: "" });
  await plant(mfile, done);
  await c.waitPage("document.querySelectorAll('.m-tab').length === 3", 20000);
  await clickText(c, "button", "View", { startsWith: true });
  await c.waitPage("!!document.querySelector('.m-closing')", 8000, "the closing answers on the record");
  const rec = await c.ev("document.querySelector('.m-closing').innerText");
  report(rec.includes("Yes: A video would help.") && rec.includes("Make the price and the ways to buy clearer") && !rec.includes("Show prices"), "the moderator's session record lists the participant's closing answers");

  // ---- the moderated tool puts the same questions to the participant, before its hand-back screen
  await plant(mfile, atHandBack("cl4", "P4", false));
  await c.waitPage("document.querySelectorAll('.m-tab').length === 3", 20000);
  await clickText(c, "button", "Open P4");
  await c.waitPage("document.body.innerText.includes('A few last questions')", 8000, "the closing questions in the moderated tool");
  report(!(await has("Researcher: continue")) && (await c.ev("document.querySelectorAll('.p-choice').length")) === 6 && (await c.ev("document.querySelectorAll('.p-order-card').length")) === 4, "the moderated tool shows the same closing questions, before the hand-back screen");
  report(!(await c.ev("!!document.querySelector('.m-header')")), "with no moderator controls on screen");
  await c.ev("document.querySelector('#cq-rewardsMeaning-0').click()"); await sleep(150);
  await clickText(c, "button", "Continue");
  await c.waitPage("document.body.innerText.toLowerCase().includes('that was the last one')", 8000, "the hand-back screen");
  report(await has("Researcher: continue"), "after them comes the hand-back screen, as before");
  await clickText(c, "button", "Researcher: continue");
  await c.waitPage("document.body.innerText.includes('Tasks complete')", 8000, "the debrief");
  const deb = await c.ev("document.body.innerText");
  report(deb.includes("Ways to save money as a member") && deb.includes("Closing questions, answered by the participant"), "the moderator's debrief lists the participant's answers");
  report(deb.includes("already answered the closing questions on screen") && !deb.includes("Rank four cards"), "and its own prompts are now follow-ups, not the same questions again");

  const outside = c.requests.filter((u) => !/^(file:|data:|blob:|about:)/.test(u));
  report(outside.length === 0, "no network requests were made", outside.slice(0, 3).join(", "));
  report(c.consoleErrors.length === 0, "no console errors or exceptions", c.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  report(false, "the closing check ran to completion", String(e.stack ?? e));
  try { console.log("  page text: " + (await text()).replace(/\s+/g, " ").slice(0, 400)); } catch { /* ignore */ }
} finally {
  await c.close();
}
process.exit(summary() ? 0 : 1);
