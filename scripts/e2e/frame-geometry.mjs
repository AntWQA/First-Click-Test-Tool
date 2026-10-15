// Helpers shared by the end-to-end checks: finding elements inside the frame and turning frame coordinates into page coordinates.
import { sleep } from "./cdp.mjs";

/** Centre of the first VISIBLE element matching a selector inside the frame (the app renders some links twice, one hidden), in page coordinates. */
export async function pointOf(c, selector, { scrollIntoView = false, textEquals } = {}) {
  const sel = JSON.stringify(selector), txt = JSON.stringify(textEquals ?? null);
  if (scrollIntoView) {
    // Scroll first and let it settle: reading a position mid-scroll would aim the click at a neighbour, which no participant does.
    await c.evFrame(`(()=>{const el=[...document.querySelectorAll(${sel})].find(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0});if(el)el.scrollIntoView({block:'center'});})()`);
    await sleep(400);
  }
  const found = await c.evFrame(`(()=>{
    const els=[...document.querySelectorAll(${sel})].filter(e=>{const r=e.getBoundingClientRect();const st=getComputedStyle(e);return r.width>0&&r.height>0&&st.visibility!=='hidden'&&(${txt}===null||e.textContent.trim()===${txt})});
    const el=els[0]; if(!el) return null;
    const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};})()`);
  if (!found) return null;
  const box = JSON.parse(await c.ev("JSON.stringify((()=>{const b=document.querySelector('.frame-box').getBoundingClientRect();return {left:b.left,top:b.top,scale:Number(document.querySelector('.frame-box').dataset.scale)}})())"));
  return { x: box.left + found.x * box.scale, y: box.top + found.y * box.scale, frame: found, scale: box.scale };
}

/** Waits for a visible element AND for it to hold still (menus slide in), so a click never lands on something still moving. */
export async function waitPoint(c, selector, opts = {}, timeout = 8000) {
  const t0 = Date.now();
  let prev = null;
  while (Date.now() - t0 < timeout) {
    try {
      const p = await pointOf(c, selector, opts);
      if (p) {
        if (prev && Math.abs(p.x - prev.x) < 1 && Math.abs(p.y - prev.y) < 1) return p;
        prev = p; await sleep(160); continue;
      }
    } catch { /* frame busy */ }
    prev = null; await sleep(120);
  }
  return null;
}

export async function waitMsg(c, predicate, timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { const m = (await c.msgs()).find(predicate); if (m) return m; await sleep(100); }
  return null;
}

export async function resetFrame(c) {
  const before = (await c.msgs()).filter((m) => m.type === "ready").length;
  await c.clearMsgs();
  await c.ev("[...document.querySelectorAll('.check-bar button')].find(b=>b.textContent==='Reset').click()");
  const ready = await waitMsg(c, (m) => m.type === "ready", 8000);
  void before;
  await sleep(150);
  return ready;
}

export async function setBreakpoint(c, label) {
  await c.ev(`[...document.querySelectorAll('.check-bar button')].find(b=>b.textContent==='${label}').click()`);
  await sleep(500);
}

/** The moderator Preview tab: the frame with breakpoint buttons, reset and a recorder log. */
export async function openPreview(c) {
  await c.waitPage("[...document.querySelectorAll('.m-tab')].some(b=>b.textContent==='Preview')", 15000, "the moderator tabs");
  await c.ev("[...document.querySelectorAll('.m-tab')].find(b=>b.textContent==='Preview').click()");
  await c.waitPage("!!document.querySelector('.frame-box')", 10000, "the preview frame");
}

/** Sets a React-controlled input or textarea the way typing would, so its onChange runs. */
export async function setValue(c, selector, value) {
  await c.ev(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));})()`);
}

/** Clicks the first element matching a selector whose text equals (or starts with) the given text. */
export async function clickText(c, selector, text, { startsWith = false } = {}) {
  const ok = await c.ev(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>${startsWith ? "e.textContent.trim().startsWith" : "e.textContent.trim()==="}(${JSON.stringify(text)}));if(!el)return false;el.click();return true})()`);
  if (!ok) throw new Error(`no ${selector} with text ${text}`);
}
