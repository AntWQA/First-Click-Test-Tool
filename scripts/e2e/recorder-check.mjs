// C2 acceptance: with real mouse events on the built single file, the recorder reports what a participant does, and a
// coverage sweep clicks every header and footer link at the breakpoint where it is reachable and checks the message.
// WC_FUZZ=full runs every link; the default samples every 4th for a quick run.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, report, sleep, summary } from "./cdp.mjs";
import { openPreview, pointOf, resetFrame, setBreakpoint, waitMsg, waitPoint } from "./frame-geometry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const file = pathToFileURL(process.env.WC_FILE ?? path.join(root, "dist-single", "wayfinding-check.html")).href;
const full = process.env.WC_FUZZ === "full";
const sample = (list) => (full ? list : list.filter((_, i) => i % 4 === 0));

// ---- independent expectations, read from the data files (not from the code under test)
const nav = JSON.parse(fs.readFileSync(path.join(root, "src/proto/data/navigation.json"), "utf8"));
const footer = JSON.parse(fs.readFileSync(path.join(root, "src/proto/data/footer.json"), "utf8"));
const header = [];
const walk = (links, section, column, child) => { for (const l of links) { header.push({ href: l.href, label: l.label, section, column, child, rewards: section === "rewards" }); walk(l.children ?? [], section, column, true); } };
for (const item of nav.items) {
  if (item.type === "dropdown") walk(item.links, item.id, item.label, false);
  else { for (const col of item.columns) walk(col.links, item.id, col.title, false); if (item.featured) header.push({ href: item.featured.link.href, label: item.featured.link.label, section: item.id, column: "Featured", child: false, featured: true }); }
}
const footerLinks = [];
for (const m of footer.menus) for (const l of m.links) footerLinks.push({ href: l.href, column: m.title, legal: false });
for (const l of footer.legalLinks) footerLinks.push({ href: l.href, column: "Legal", legal: true });
const testidFor = (prefix, href) => `${prefix}-${href.replace(/\//g, "-").replace(/^-/, "")}`;

const c = await launch({ width: 1500, height: 1000 });
await c.captureMessages();
const clickLink = async (selector, opts) => { const p = await waitPoint(c, selector, opts); if (!p) return null; await c.click(p.x, p.y); return p; };

try {
  await c.goto(file);
  await openPreview(c);
  const ready = await waitMsg(c, (m) => m.type === "ready", 20000);
  report(!!ready, "the prototype reports ready after it has painted", ready ? `at ${ready.at} ms, ${ready.w} x ${ready.h}` : "");

  // ---------- desktop walk-through with real mouse movement ----------
  const shop = await pointOf(c, "[data-testid=nav-shop]");
  await c.move(shop.x - 30, shop.y); await sleep(100); await c.move(shop.x, shop.y);
  const opened = await waitMsg(c, (m) => m.type === "menu-open" && m.section === "shop");
  report(opened?.surface === "mega" && opened?.via === "hover", "hovering Shop reports the mega menu opening (via hover)", JSON.stringify(opened));
  await c.move(10, 10); // leave the nav and the panel
  const closed = await waitMsg(c, (m) => m.type === "menu-close" && m.section === "shop", 4000);
  report(!!closed && closed.at > opened.at, "moving away reports it closing");
  const rewardsBtn = await pointOf(c, "[data-testid=nav-rewards]");
  await c.move(rewardsBtn.x, rewardsBtn.y);
  const rewards = await waitMsg(c, (m) => m.type === "menu-open" && m.section === "rewards");
  report(rewards?.surface === "dropdown", "hovering Rewards reports the dropdown opening", JSON.stringify(rewards));
  await c.move(10, 10); await sleep(700);

  await c.clearMsgs();
  await c.move(shop.x, shop.y); await sleep(700);
  await clickLink("[data-testid=nav-link-shop-goal-sleep-solutions]");
  const leaf = await waitMsg(c, (m) => m.type === "click" && m.kind === "nav-leaf");
  report(leaf?.href === "/shop/goal/sleep-solutions" && leaf.section === "shop" && leaf.column === "Shop by Goal" && leaf.ends === true, "a mega menu link click carries href, section and column and ends the task", JSON.stringify(leaf));
  const route = await waitMsg(c, (m) => m.type === "route" && m.path === "/shop/goal/sleep-solutions");
  report(!!route, "the route change to the destination is reported");

  // ---------- reset restarts the clock and the app ----------
  const r = await resetFrame(c);
  report(!!r && r.at < 2000, "reset remounts the app and reports a fresh ready", JSON.stringify(r));
  const path0 = await c.evFrame("document.querySelector('h1')?.textContent");
  report(/Storefront navigation prototype/.test(path0 ?? ""), "after reset the prototype is back on the start page", path0);

  // ---------- footer and featured tile: plain anchors must be intercepted ----------
  await c.clearMsgs();
  const fl = await clickLink("footer a[href='/support/contact']", { scrollIntoView: true });
  const fclick = await waitMsg(c, (m) => m.type === "click" && m.kind === "footer");
  report(!!fl && fclick?.section === "footer" && fclick.href === "/support/contact" && fclick.ends === true, "a footer link click is recorded as kind footer", JSON.stringify(fclick));
  const froute = await waitMsg(c, (m) => m.type === "route" && m.path === "/support/contact");
  const stillHere = await c.evFrame("window.location.href === 'about:srcdoc' && !!document.getElementById('root')");
  report(!!froute && stillHere, "the footer link was routed inside the frame; the frame did not leave the prototype", String(stillHere));

  await resetFrame(c); await c.clearMsgs();
  const sh = await pointOf(c, "[data-testid=nav-shop]"); await c.move(sh.x, sh.y); await sleep(700);
  await clickLink("[data-testid=content-card-action-link]");
  const feat = await waitMsg(c, (m) => m.type === "click" && m.kind === "featured");
  report(feat?.ends === true && feat.href === "/shop/eo-mega-plus", "the featured tile (a plain link) is recorded as featured and routed", JSON.stringify(feat));
  report(await c.evFrame("window.location.href === 'about:srcdoc'"), "the featured tile did not navigate the frame away");

  // ---------- search, logo, utilities ----------
  await resetFrame(c); await c.clearMsgs();
  await clickLink("[data-testid=header-search-input] input, input[data-testid=header-search-input]");
  const sclick = await waitMsg(c, (m) => m.type === "click" && m.kind === "search");
  report(!!sclick && sclick.ends === false, "clicking the search field is recorded as search and does not end the task", JSON.stringify(sclick));
  await c.type("oil"); await c.key("Enter", "Enter");
  const submit = await waitMsg(c, (m) => m.type === "search-submit", 6000);
  report(submit?.query === "oil", "submitting a search is reported as search-submit", JSON.stringify(submit));
  await resetFrame(c); await c.clearMsgs();
  await clickLink("[data-testid=toolbar-account]");
  const util = await waitMsg(c, (m) => m.type === "click" && m.kind === "utility");
  report(!!util && !util.ends, "an account or bag click is recorded as a utility");
  await clickLink("[data-testid=header-logo]");
  const logo = await waitMsg(c, (m) => m.type === "click" && m.kind === "logo");
  report(!!logo && !logo.ends, "a logo click is recorded and does not end the task");

  // ---------- mobile drawer ----------
  await setBreakpoint(c, "Mobile 402"); await resetFrame(c); await c.clearMsgs();
  await clickLink("[data-testid=mobile-menu-toggle]");
  const tog = await waitMsg(c, (m) => m.type === "click" && m.kind === "menu-toggle");
  report(!!tog, "opening the mobile menu is recorded as menu-toggle");
  await sleep(700);
  await clickLink("[data-testid=mobile-learn]");
  const row = await waitMsg(c, (m) => m.type === "click" && m.kind === "nav-top" && m.section === "learn");
  const drill = await waitMsg(c, (m) => m.type === "menu-open" && m.surface === "drill" && m.section === "learn");
  report(!!row && drill?.via === "click", "tapping a section row records the click and the drill-in opening", JSON.stringify(drill));
  await sleep(500);
  await clickLink("[data-testid=mobile-link-learn-essential-oils-certified-pure-testing-grade]", { scrollIntoView: true });
  const mleaf = await waitMsg(c, (m) => m.type === "click" && m.kind === "nav-leaf");
  report(mleaf?.href === "/learn/essential-oils/certified-pure-testing-grade" && mleaf.section === "learn" && mleaf.column === "Essential Oils", "a mobile link carries href, section and column", JSON.stringify(mleaf));

  // ---------- coverage sweep ----------
  const desktopLinks = sample(header.filter((h) => !h.child && !h.featured));
  const mobileLinks = sample(header.filter((h) => !h.child));
  const tabletLinks = sample(header);
  const footerSweep = sample(footerLinks);
  console.log(`\n  sweep (${full ? "full" : "sampled"}): ${desktopLinks.length} desktop, ${mobileLinks.length} mobile, ${tabletLinks.length} tablet, ${footerSweep.length} footer links`);
  const bad = [];
  const expectClick = (m, h, kind = "nav-leaf") => m && m.kind === kind && m.href === h.href && m.section === h.section && m.column === h.column && m.ends === true;

  await setBreakpoint(c, "Desktop 1440");
  let retried = 0; // links that needed a second attempt (a slow moment under load); reported, never hidden
  for (const h of desktopLinks) {
    const once = async () => {
      await resetFrame(c);
      const top = await waitPoint(c, `[data-testid=nav-${h.section}]`);
      await c.move(top.x - 25, top.y); await sleep(60); await c.move(top.x, top.y); await sleep(450);
      const clicked = await clickLink(`[data-testid="${testidFor("nav-link", h.href)}"]`);
      return clicked ? await waitMsg(c, (x) => x.type === "click" && x.kind !== "nav-top", 3000) : null;
    };
    let m = await once();
    if (!expectClick(m, h)) { retried += 1; m = await once(); }
    if (!expectClick(m, h)) bad.push(`desktop ${h.href}: ${JSON.stringify(m)}`);
  }
  report(bad.length === 0, `desktop: every sampled header link reports href, section and column (${desktopLinks.length}, ${retried} needed a second try)`, bad.slice(0, 3).join(" | "));

  for (const [label, links, tag] of [["Mobile 402", mobileLinks, "mobile"], ["Tablet 768", tabletLinks, "tablet"]]) {
    await setBreakpoint(c, label);
    const fails = [];
    let retriedHere = 0;
    for (const h of links) {
      const once = async () => {
        await resetFrame(c);
        await clickLink("[data-testid=mobile-menu-toggle]"); await sleep(600);
        await clickLink(`[data-testid=mobile-${h.section}]`);
        await waitPoint(c, "[data-testid=mobile-back]"); // the section view has replaced the root list
        const clicked = await clickLink(`[data-testid="${testidFor("mobile-link", h.href)}"]`, { scrollIntoView: true });
        return clicked ? await waitMsg(c, (x) => x.type === "click" && x.ends === true, 3000) : null;
      };
      const okKind = h.featured ? "featured" : "nav-leaf";
      let m = await once();
      if (!expectClick(m, h, okKind)) { retriedHere += 1; m = await once(); }
      if (!expectClick(m, h, okKind)) fails.push(`${tag} ${h.href}: ${JSON.stringify(m)}`);
    }
    retried += retriedHere;
    report(fails.length === 0, `${tag}: every sampled header link reports href, section and column (${links.length}, ${retriedHere} needed a second try)`, fails.slice(0, 3).join(" | "));
  }

  await setBreakpoint(c, "Desktop 1440");
  const ffails = [];
  for (const f of footerSweep) {
    await resetFrame(c);
    const sel = `footer a[href="${f.href}"]`;
    const idx = await c.evFrame(`(()=>{const as=[...document.querySelectorAll(${JSON.stringify(sel)})];const want=${JSON.stringify(f.column)}.toUpperCase();const i=as.findIndex(a=>${JSON.stringify(f.legal)}?!!a.closest('ul'):(a.parentElement.firstElementChild.textContent.trim().toUpperCase()===want&&!a.closest('ul')));return i<0?0:i;})()`);
    await c.evFrame(`document.querySelectorAll(${JSON.stringify(sel)})[${idx}].scrollIntoView({block:'center'})`);
    await sleep(120);
    const p = JSON.parse(await c.evFrame(`(()=>{const a=document.querySelectorAll(${JSON.stringify(sel)})[${idx}];const r=a.getBoundingClientRect();return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2})})()`));
    const box = JSON.parse(await c.ev("JSON.stringify((()=>{const b=document.querySelector('.frame-box').getBoundingClientRect();return {left:b.left,top:b.top,scale:Number(document.querySelector('.frame-box').dataset.scale)}})())"));
    await c.click(box.left + p.x * box.scale, box.top + p.y * box.scale);
    const m = await waitMsg(c, (x) => x.type === "click" && x.kind === "footer", 3000);
    const stay = await c.evFrame("window.location.href === 'about:srcdoc'");
    if (!(m && m.href === f.href && m.section === "footer" && m.column === f.column && m.ends && stay)) ffails.push(`footer ${f.href} (${f.column}): ${JSON.stringify(m)}`);
  }
  report(ffails.length === 0, `footer: every sampled link reports href and the right menu, and the frame stays put (${footerSweep.length})`, ffails.slice(0, 3).join(" | "));

  const outside = c.requests.filter((u) => !/^(file:|data:|blob:|about:)/.test(u));
  report(outside.length === 0, "no network requests during the whole run", outside.slice(0, 3).join(", "));
  report(c.consoleErrors.length === 0, "no console errors or exceptions during the whole run", c.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  report(false, "the check ran to completion", String(e.stack ?? e));
} finally {
  await c.close();
}
process.exit(summary() ? 0 : 1);
