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

  await c.clearMsgs();
  const p = await waitPoint(c, '[data-testid="product-card-lavender"]', { scrollIntoView: true });
  await c.click(p.x, p.y);
  const click = await waitMsg(c, (m) => m.type === "click" && m.testid === "product-card-lavender");
  report(click && click.ends === false && click.kind === "other", "clicking a product card is recorded and does not end a task", JSON.stringify(click));
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
  const label = await c.evFrame("document.querySelector('[data-testid=pdp-add-to-cart]').innerText");
  report(/added/i.test(label), "the add button confirms", label);
  const ship = await waitPoint(c, '[data-testid="pdp-shipping-link"]', { scrollIntoView: true });
  await c.click(ship.x, ship.y);
  await c.waitFrame("!!document.querySelector('[role=dialog] table')", 8000, "the shipping options overlay");
  const rows = await c.evFrame("document.querySelectorAll('[role=dialog] tbody tr').length");
  report(rows === 6, "the shipping options overlay lists six delivery rows", String(rows));

  const outside = c.requests.filter((u) => !/^(file:|data:|blob:|about:)/.test(u));
  report(outside.length === 0, "no network requests were made", outside.slice(0, 3).join(", "));
  report(c.consoleErrors.length === 0, "no console errors or exceptions", c.consoleErrors.slice(0, 2).join(" | "));
} catch (e) {
  report(false, "the check ran to completion", String(e.message ?? e));
} finally {
  await c.close();
}
process.exit(summary() ? 0 : 1);
