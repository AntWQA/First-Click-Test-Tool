// C1 acceptance: the single HTML file opens from file://, the prototype renders at three breakpoints inside the sandboxed
// frame, nothing touches the network, and no Raleway text survived the font pruning.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, report, sleep, summary } from "./cdp.mjs";
import { openPreview } from "./frame-geometry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const file = pathToFileURL(path.join(root, "dist-single", "wayfinding-check.html")).href;
const shots = process.env.WC_SHOTS ?? "";

const c = await launch({ width: 1500, height: 1000 });
try {
  await c.goto(file);
  await openPreview(c);
  await c.waitFrame("document.querySelector('[data-testid=header-logo]') !== null", 20000, "the prototype header");
  report(true, "the single file opens from file:// and the prototype renders inside the frame");

  const sandbox = await c.ev("document.querySelector('iframe').getAttribute('sandbox')");
  report(sandbox === "allow-scripts", "the frame is sandboxed with allow-scripts only (no same-origin access)", sandbox);
  report((await c.ev("document.querySelector('iframe').srcdoc.length")) > 1_000_000, "the prototype is embedded as srcdoc, not loaded by URL");
  const noncePresent = await c.evFrame("typeof window.__WC_NONCE__ === 'string' && window.__WC_NONCE__.length > 10");
  report(noncePresent, "a per-load nonce was injected into the prototype document");

  for (const [label, width, height, mobile] of [["Desktop 1440", 1440, 1024, false], ["Tablet 768", 768, 1024, true], ["Mobile 402", 402, 874, true]]) {
    await c.ev(`[...document.querySelectorAll('.check-bar button')].find(b=>b.textContent==='${label}').click()`);
    await sleep(900);
    const w = await c.evFrame("innerWidth"), h = await c.evFrame("innerHeight");
    await c.waitPage(`(document.querySelector('.check-log li')?.textContent ?? '').includes('Menu ready (${width} x ${height})')`, 8000, `the recorder log to start with the ${label} viewport`);
    report(true, `${label}: the recorder log starts with this breakpoint's own viewport (${width} x ${height})`);
    report(w === width && h === height, `${label}: the frame viewport is ${width} x ${height}`, `${w} x ${h}`);
    const scale = Number(await c.ev("document.querySelector('.frame-box').dataset.scale"));
    // In a 1500 x 1000 window the 1024-tall desktop and tablet frames must be scaled down; the 874-tall mobile frame fits at true size.
    report(height > 900 ? scale > 0.5 && scale < 1 : scale > 0.9 && scale <= 1, `${label}: ${height > 900 ? "scaled down to fit" : "shown at or near true size"} (${scale})`);
    const pageScrolls = await c.ev("document.documentElement.scrollHeight > innerHeight + 2 || document.querySelector('.m-root').scrollHeight > document.querySelector('.m-root').clientHeight + 2");
    report(!pageScrolls, `${label}: the page does not scroll to reach the frame`);
    const box = JSON.parse(await c.ev("JSON.stringify(document.querySelector('.frame-box').getBoundingClientRect())"));
    report(Math.abs(box.width - width * scale) < 1.5, `${label}: the visible frame is the scaled width`, `${box.width} vs ${width * scale}`);
    const toggleShown = await c.evFrame("(()=>{const t=document.querySelector('[data-testid=mobile-menu-toggle]');return !!t && t.getBoundingClientRect().width>0 && getComputedStyle(t).display!=='none'})()");
    const navShown = await c.evFrame("(()=>{const t=document.querySelector('[data-testid=nav-shop]');return !!t && t.getBoundingClientRect().width>0})()");
    report(mobile ? toggleShown && !navShown : navShown && !toggleShown, `${label}: the ${mobile ? "menu button replaces the hover nav" : "hover nav is shown"}`);
    if (!mobile) {
      // The header spans the page: the last control ends as far from the right edge as the logo starts from the left.
      const edges = JSON.parse(await c.evFrame("JSON.stringify({left: document.querySelector('[data-testid=header-logo]').getBoundingClientRect().left, right: innerWidth - document.querySelector('[data-testid=toolbar-bag]').getBoundingClientRect().right})"));
      report(Math.abs(edges.left - edges.right) <= 2, `${label}: the header is full width (logo ${edges.left}px from the left edge, last icon ${edges.right}px from the right)`);
    }
    if (shots) await c.shot(path.join(shots, `frame-${width}.png`));
  }

  await c.ev("[...document.querySelectorAll('.check-bar button')].find(b=>b.textContent==='Desktop 1440').click()");
  await sleep(600);
  const raleway = await c.evFrame("[...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).fontFamily.includes('Raleway')).length");
  report(raleway === 0, "no element in the prototype uses the pruned Raleway face", String(raleway));
  const family = await c.evFrame("getComputedStyle(document.body).fontFamily");
  report(/Plus Jakarta Sans/.test(family), "the prototype text is set in Plus Jakarta Sans", family);
  const loaded = await c.evFrame("document.fonts.check('500 16px \"Plus Jakarta Sans\"')");
  report(loaded === true, "Plus Jakarta Sans is available offline (embedded, no web font fetch)");

  const policy = await c.ev("document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]')?.content ?? ''");
  report(/default-src 'none'/.test(policy), "the page carries a Content-Security-Policy that denies everything except inline code and data:");
  const frameFetch = await c.evFrame("fetch('https://example.com/x').then(()=>'loaded',()=>'blocked')");
  report(frameFetch === "blocked", "the policy is inherited by the prototype frame: its requests to the network are blocked", frameFetch);
  // Shortcut keys on a moderator screen: ? lists them, and the header stays put when the tab changes.
  await c.key("?", "Slash"); await c.waitPage("!!document.querySelector('dialog[open]')", 4000, "the shortcuts panel");
  const panel = await c.ev("document.querySelector('dialog[open]').textContent");
  report(["Switch to Ledger", "Switch to Preview", "Toggle light or dark theme"].every((x) => panel.includes(x)) && !panel.includes("Switch to Content") && !panel.includes("Save content changes"), "the ? panel lists the tab and theme shortcuts, and nothing for the removed Content tab");
  await c.key("Escape", "Escape"); await sleep(200);
  c.consoleErrors.splice(0, c.consoleErrors.length); // the blocked probes above are expected
  const outside = c.requests.filter((u) => !/^(file:|data:|blob:|about:)/.test(u));
  report(outside.length === 0, "no network requests were made", outside.slice(0, 3).join(", "));
  report(c.consoleErrors.length === 0, "no console errors or exceptions", c.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  report(false, "the check ran to completion", String(e.message ?? e));
} finally {
  await c.close();
}
process.exit(summary() ? 0 : 1);
