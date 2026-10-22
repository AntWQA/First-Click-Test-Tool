// Accessibility spot-checks on the built file: accessible names, labels, one h1 per screen, focus order and visibility,
// dialog labelling, and colour contrast computed from the real stylesheet tokens. It is a floor, not an audit: it does
// not replace a screen reader pass. The prototype inside the frame is out of scope (separate audit).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, report, sleep, summary } from "./cdp.mjs";
import { clickText, openPreview } from "./frame-geometry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const file = pathToFileURL(process.env.WC_FILE ?? path.join(root, "dist-single", "wayfinding-check.html")).href;

// ---- contrast, from the tokens in styles.css, in both themes
const css = fs.readFileSync(path.join(root, "src/shell/styles.css"), "utf8");
const block = (sel) => { const i = css.indexOf(sel + " {"); return css.slice(i, css.indexOf("\n}", i)); };
const parse = (b) => Object.fromEntries([...b.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const light = parse(block(":root"));
const dark = { ...light, ...parse(block(':root[data-theme="dark"]')) };
const rgb = (v) => { if (v.startsWith("#")) return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)); const m = v.match(/rgba?\(([^)]+)\)/); return m[1].split(",").slice(0, 3).map(Number); };
const blend = (fg, bg) => { const m = fg.match(/rgba\(([^)]+)\)/); const [r, g, b, a] = m[1].split(",").map(Number); const base = rgb(bg); return "#" + [r, g, b].map((v, i) => Math.round(v * a + base[i] * (1 - a)).toString(16).padStart(2, "0")).join(""); };
const solid = (v, over) => (v.startsWith("rgba") ? blend(v, over) : v);
const lum = (hex) => { const [r, g, b] = rgb(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
for (const [theme, T] of [["light", light], ["dark", dark]]) {
  const card = T["paper-raised"], page = T.paper;
  const tint = (name) => solid(T[name], card);
  const pairs = [
    ["body text on cards", T.ink, card, 4.5], ["body text on the page", T.ink, page, 4.5],
    ["muted text on cards", T.muted, card, 4.5], ["muted text on the page", T.muted, page, 4.5],
    ["button text on the accent (primary)", T["accent-ink"], T.accent, 4.5], ["text on the danger button", T["danger-ink"], T["fail-text"], 4.5],
    ["pass text on its tint", T["success-text"], tint("success-bg"), 4.5], ["watch text on its tint", T["warn-text"], tint("warn-bg"), 4.5], ["fail text on its tint", T["fail-text"], tint("fail-bg"), 4.5],
    ["accent text (eyebrows, pills) on cards", theme === "light" ? "#7a3f8f" : T.accent, theme === "light" ? solid(T["accent-tint"], card) : card, 4.5],
    ["the scenario cue (bold, coloured) on cards", T.cue, card, 4.5],
    ["focus ring (accent) on cards, non-text 3:1", T.accent, card, 3], ["focus ring (accent) on the page, non-text 3:1", T.accent, page, 3],
    ["control borders on cards, non-text 3:1", T.control, card, 3], ["control borders on the page, non-text 3:1", T.control, page, 3],
  ];
  for (const [name, fg, bg, min] of pairs) report(ratio(fg, bg) >= min, `contrast (${theme}): ${name} is ${ratio(fg, bg).toFixed(2)}:1 (needs ${min}:1)`);
}

const c = await launch({ width: 1500, height: 1000 });
const audit = `(()=>{
  const vis=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
  const name=e=>(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')&&e.getAttribute('aria-labelledby').split(' ').map(i=>(document.getElementById(i)||{}).textContent||'').join(' ')||(e.labels&&e.labels.length?[...e.labels].map(l=>l.textContent).join(' '):'')||e.textContent||e.getAttribute('title')||'').trim();
  const controls=[...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button]')].filter(vis);
  const unnamed=controls.filter(e=>name(e)==='').map(e=>e.tagName+'.'+e.className);
  const h1=[...document.querySelectorAll('h1')].filter(vis).length;
  const positive=[...document.querySelectorAll('[tabindex]')].filter(e=>Number(e.getAttribute('tabindex'))>0).length;
  const smallTargets=controls.filter(e=>!(e.type==='radio'||e.type==='checkbox'||e.type==='file')).filter(e=>{const r=e.getBoundingClientRect();return r.height<40}).map(e=>name(e).slice(0,30)+':'+Math.round(e.getBoundingClientRect().height));
  return JSON.stringify({unnamed,h1,positive,smallTargets,controls:controls.length});
})()`;
const screen = async (label, { h1 = 1 } = {}) => {
  const a = JSON.parse(await c.ev(audit));
  report(a.unnamed.length === 0, `${label}: every control has an accessible name (${a.controls} checked)`, a.unnamed.slice(0, 3).join(", "));
  report(a.h1 === h1, `${label}: exactly ${h1} visible h1`, String(a.h1));
  report(a.positive === 0, `${label}: no positive tabindex`);
  report(a.smallTargets.length === 0, `${label}: controls are at least 40px tall`, a.smallTargets.slice(0, 3).join(", "));
};
const wait = (s) => c.waitPage(`document.body.innerText.toLowerCase().includes(${JSON.stringify(s.toLowerCase())})`, 8000, s);
try {
  await c.goto(file);
  await c.waitPage("document.querySelectorAll('.m-tab').length === 4", 20000);
  report((await c.ev("document.documentElement.lang")) === "en", "the document language is set");
  await screen("Sessions");
  await clickText(c, ".m-tab", "Ledger"); await screen("Ledger");
  await clickText(c, ".m-tab", "Content"); await screen("Content");
  await clickText(c, ".m-tab", "Sessions");
  await clickText(c, "button", "New session"); await wait("Hand over to participant"); await screen("Setup");
  const labelled = await c.ev("[...document.querySelectorAll('.m-form input, .m-form select')].every(e=>(e.labels&&e.labels.length>0)||e.getAttribute('aria-label'))");
  report(labelled, "Setup: every field has a visible label");
  await clickText(c, "button[type=submit]", "Hand over to participant", { startsWith: true });
  await wait("Thanks for taking part"); await screen("Participant intro");
  await clickText(c, "button", "Show me the first scenario", { startsWith: true });
  await c.waitPage("!!document.querySelector('.tour-tip')", 5000, "the onboarding tour"); await screen("Onboarding tour");
  report(await c.ev("[...document.querySelectorAll('.tour-tip button')].every((b) => b.getBoundingClientRect().height >= 40)"), "Tour: every control is at least 40px tall");
  await c.key("Escape", "Escape"); await sleep(250);
  report(!(await c.ev("!!document.querySelector('.tour-tip')")), "Esc closes the tour");
  await screen("Task before Begin");
  const cue = JSON.parse(await c.ev(`JSON.stringify((()=>{const el=document.querySelector('.p-scenario .cue');if(!el)return null;const a=getComputedStyle(el),b=getComputedStyle(el.parentElement);return {text:el.textContent,weight:Number(a.fontWeight),color:a.color,body:b.color,tag:el.tagName}})())`));
  report(cue?.text === "Before you scroll or click" && cue.tag === "STRONG" && cue.weight >= 700 && cue.color !== cue.body, "the scenario's opening cue is bold and in its own colour", JSON.stringify(cue));
  // Tab starts from where focus last was, so start from the heading, as a participant who has just read the scenario would.
  const firstTab = async () => { await c.ev("(document.querySelector('.p-scenario') ?? document.body).focus(); document.activeElement.blur()"); await c.key("Tab", "Tab"); return c.ev("document.activeElement.textContent.trim()"); };
  report((await firstTab()).includes("Begin"), "Task: the first thing a keyboard user reaches is Begin");
  const outline = await c.ev("(()=>{const s=getComputedStyle(document.activeElement);return s.outlineStyle+' '+s.outlineWidth})()");
  report(!/^none/.test(outline) && !/ 0px/.test(outline), "keyboard focus has a visible outline", outline);
  await c.ev("[...document.querySelectorAll('.p-task-card .btn')].find(b=>b.textContent.trim().startsWith('Begin')).click()");
  await c.waitPage("!!document.querySelector('iframe')", 20000); await sleep(600);
  await screen("Task after Begin");
  report((await c.ev("document.querySelector('iframe').title")).length > 3, "the frame has a title");
  await c.waitPage("[...document.querySelectorAll('.p-actions .btn')].every(b=>!b.disabled)", 10000, "the end buttons to unlock");
  await c.ev("[...document.querySelectorAll('.p-actions .btn')].find(b=>b.textContent==='I can\\'t find it'||b.textContent.trim()==='Done').click()");
  await wait("how easy was it"); await screen("Rating");
  report(await c.ev("!!document.querySelector('fieldset legend h1') && document.querySelectorAll('input[type=radio][name=ease]').length===7"), "Rating: seven native radios in a fieldset with a legend");
  await c.ev("document.querySelector('input[name=ease][value=\"5\"]').click()");
  await c.ev("document.querySelector('input[name=confidence][value=\"5\"]')?.click()");
  await clickText(c, "button", "Done"); await wait("Ready for the next scenario"); await screen("Next scenario");
  const mkey = async () => { await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "M", code: "KeyM", modifiers: 10 }); await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "M", code: "KeyM", modifiers: 10 }); await c.waitPage("!!document.querySelector('dialog[open]')"); };
  await mkey();
  report(await c.ev("document.querySelector('dialog[open]').getAttribute('aria-labelledby') !== null && !!document.getElementById(document.querySelector('dialog[open]').getAttribute('aria-labelledby'))"), "dialogs are labelled by their heading");
  await c.key("Escape", "Escape"); await sleep(200);
  report(!(await c.ev("!!document.querySelector('dialog[open]')")), "Escape closes a dialog");
  await mkey();
  await clickText(c, "dialog button", "End session early"); await wait("Session ended early"); await screen("Debrief");
  report(await c.ev("[...document.querySelectorAll('.m-table button')].every(b=>b.textContent.trim().length>0 && /findings for/.test(b.textContent))"), "Debrief: every findings button names its task");
  await clickText(c, "button", "Add findings for", { startsWith: true });
  await c.waitPage("!!document.querySelector('.m-review')"); await screen("Review", { h1: 1 });
  report(await c.ev("[...document.querySelectorAll('fieldset')].every(f=>f.querySelector('legend'))"), "Review: every fieldset has a legend");
  report(await c.ev("[...document.querySelectorAll('.m-review textarea, .m-review select')].every(e=>e.labels&&e.labels.length>0)"), "Review: every text field and select has a visible label");
  await clickText(c, "button", "Back to the session record", { startsWith: true }); await wait("Session ended early");
  await clickText(c, ".m-tab, button", "All sessions");
  await openPreview(c); await screen("Preview");
  report(c.consoleErrors.length === 0, "no console errors", c.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  report(false, "the accessibility check ran to completion", String(e.stack ?? e));
} finally {
  await c.close();
}
process.exit(summary() ? 0 : 1);
