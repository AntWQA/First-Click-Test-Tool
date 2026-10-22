// The product page inside the built single file: a homepage product card opens it, the buy box and shipping overlay work,
// the recorder reports the clicks without ending a task, and nothing reaches the network.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launch, report, sleep, summary } from "./cdp.mjs";
import { openPreview, pointOf, waitMsg, waitPoint } from "./frame-geometry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const file = pathToFileURL(process.env.WC_FILE ?? path.join(root, "dist-single", "wayfinding-check.html")).href;
const FEATURED = ["lavender", "on-guard", "frankincense", "deep-blue-rub", "ylang-ylang"];

const c = await launch({ width: 1500, height: 1000 });
await c.captureMessages();
try {
  await c.goto(file);
  await openPreview(c);
  const ready = await waitMsg(c, (m) => m.type === "ready", 20000);
  report(!!ready, "the prototype reports ready");

  // The card shows the name, image and price of its product, and the page the card opens shows the same.
  const card = await c.evFrame(`(()=>{const out={};for(const s of ${JSON.stringify(FEATURED)}){const el=document.querySelector('[data-testid="product-card-'+s+'"]');const img=el&&el.querySelector('img');out[s]=el?{text:el.innerText.replace(/\\n+/g,' | '),img:(img&&img.src.slice(0,40))}:null}return JSON.stringify(out)})()`);
  const cards = JSON.parse(card);
  report(FEATURED.every((s) => cards[s] && /\$\d/.test(cards[s].text) && cards[s].img), "all five best seller cards show a name, a price and an image", FEATURED.filter((s) => !cards[s]).join(","));

  // Zones: each real click reports the part of the page it landed in, which is how a click task is scored.
  const zoneOf = async (selector, label, want) => {
    const pt = await waitPoint(c, selector, { scrollIntoView: true });
    if (!pt) { report(false, `${label}: the element was not found`, selector); return; }
    await c.clearMsgs(); await c.click(pt.x, pt.y);
    const m = await waitMsg(c, (x) => x.type === "click");
    report(m?.zone === want, `${label} reports the ${want} zone`, JSON.stringify(m));
  };
  // Homepage zones: the bands a click task can name. Each click only records, so the page stays where it is.
  await zoneOf(".hp-hero h1", "the hero heading", "hero");
  await zoneOf('[data-zone="why-value-cards"] > *', "a value card", "why-value-cards");
  await zoneOf('[data-testid="section-link-quality"]', "the How we source and test link", "quality");
  await zoneOf("#quality h2", "the quality block heading", "quality");
  await zoneOf("#offers h2", "the offers heading", "offers");
  await zoneOf("#faq h2", "the FAQ heading", "faq");
  await c.clearMsgs();
  const p = await waitPoint(c, '[data-testid="product-card-lavender"]', { scrollIntoView: true });
  await c.click(p.x, p.y);
  const click = await waitMsg(c, (m) => m.type === "click" && m.testid === "product-card-lavender");
  report(click && click.ends === false && click.kind === "other", "clicking a product card is recorded and does not end a task", JSON.stringify(click));
  report(click?.zone === "best-sellers", "the card click carries the best-sellers zone", String(click?.zone));
  const route = await waitMsg(c, (m) => m.type === "route" && /^\/shop\/products\//.test(m.path));
  report(!!route, "the route change to the product page is reported", route?.path);
  await c.waitFrame("!!document.querySelector('[data-testid=pdp-buy-box]')", 10000, "the product page");

  const page = JSON.parse(await c.evFrame(`JSON.stringify({h1:document.querySelector('h1').textContent,price:document.querySelector('[data-testid=pdp-price]').innerText.replace(/\\n+/g,' '),img:document.querySelector('[data-testid=pdp-gallery] img').src.slice(0,40),crumbs:!!document.querySelector('nav[aria-label=Breadcrumb]')})`));
  const cardName = cards.lavender.text.split(" | ")[0];
  const cardPrice = cards.lavender.text.match(/\$[\d.,]+/g).pop();
  report(page.h1 === cardName, "the page title matches the card name", `${cardName} / ${page.h1}`);
  report(page.price.includes(cardPrice), "the page price matches the card price", `${cardPrice} / ${page.price}`);
  report(page.img === cards.lavender.img, "the page image matches the card image");
  report(page.crumbs, "the page has a breadcrumb");

  // The image bank rule: every product served has its own photo, so no two recommendations share an image.
  const rel = JSON.parse(await c.evFrame(`JSON.stringify([...document.querySelectorAll('[data-testid^=pdp-related-]')].map(r=>({name:r.innerText.split('\\n')[0],img:(r.querySelector('img')||{}).src||''})))`));
  report(rel.length >= 5 && rel.every((r) => r.img.length > 100), "the recommendations show a photo for every product", `${rel.length} cards`);
  report(new Set(rel.map((r) => r.img)).size === rel.length, "no two recommended products share a photo", rel.map((r) => r.name).join(", "));

  // The buy box: the account option shows the membership price, the add button confirms, the shipping overlay opens.
  await c.evFrame("document.querySelector('#pdp-opt-account').click()"); await sleep(300);
  const acct = await c.evFrame("document.querySelector('[data-testid=pdp-price]').innerText.replace(/\\n+/g,' ')");
  report(/membership price/i.test(acct) && (acct.match(/\$[\d.]+/g) ?? []).length === 2, "choosing the account option shows the membership price beside the retail price", acct);
  const add = await waitPoint(c, '[data-testid="pdp-add-to-cart"]', { scrollIntoView: true });
  await c.clearMsgs();
  await c.click(add.x, add.y);
  const addClick = await waitMsg(c, (m) => m.type === "click" && m.testid === "pdp-add-to-cart");
  report(addClick && addClick.ends === false, "the add button click is recorded and does not end a task", JSON.stringify(addClick));
  report(addClick?.zone === "add-to-cart", "the add button click carries the add-to-cart zone", String(addClick?.zone));
  const label = await c.evFrame("document.querySelector('[data-testid=pdp-add-to-cart]').innerText");
  report(/added/i.test(label), "the add button confirms", label);
  // Zones, product page. (zoneOf is defined with the homepage zones above.)
  await zoneOf('[data-testid="pdp-option-one-time"] label', "choosing the one-time option", "option-one-time");
  await zoneOf('[data-testid="pdp-option-account"] label', "choosing the account option", "option-account");
  await zoneOf('[data-testid="pdp-quantity"] button:last-of-type', "the quantity plus button (the minus is disabled at 1)", "quantity");
  await zoneOf('[data-testid="pdp-gallery"] img', "the gallery", "gallery");
  await zoneOf('[data-testid="pdp-title"]', "the product title", "badges-title");
  await zoneOf('[data-testid="pdp-rating"]', "the rating", "rating");
  await zoneOf('[data-testid="pdp-shipping-link"]', "the shipping line link", "shipping");
  await c.waitFrame("!!document.querySelector('[role=dialog] table')", 8000, "the shipping overlay opened by that click");
  await c.key("Escape", "Escape"); await sleep(400);
  await c.evFrame("document.querySelector('[role=dialog]')?.querySelector('button')?.click()"); await sleep(300);
  const ship = await waitPoint(c, '[data-testid="pdp-shipping-link"]', { scrollIntoView: true });
  await c.click(ship.x, ship.y);
  await c.waitFrame("!!document.querySelector('[role=dialog] table')", 8000, "the shipping options overlay");
  const rows = await c.evFrame("document.querySelectorAll('[role=dialog] tbody tr').length");
  report(rows === 6, "the shipping options overlay lists six delivery rows", String(rows));

  // The shipping overlay is still open; its backdrop would take the next click, so close it as a participant would.
  await c.evFrame("document.querySelector('.dtds-modal__close-button')?.click()"); await sleep(500);
  report(!(await c.evFrame("!!document.querySelector('.dtds-modal')")), "the shipping overlay closes");
  // last: a footer link leaves the page
  await zoneOf('footer ul a[href^="/"]', "a footer link", "footer");
  const outside = c.requests.filter((u) => !/^(file:|data:|blob:|about:)/.test(u));
  report(outside.length === 0, "no network requests were made", outside.slice(0, 3).join(", "));
  report(c.consoleErrors.length === 0, "no console errors or exceptions", c.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  report(false, "the check ran to completion", String(e.message ?? e));
} finally {
  await c.close();
}
process.exit(summary() ? 0 : 1);
