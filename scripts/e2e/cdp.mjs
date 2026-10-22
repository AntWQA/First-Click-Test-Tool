// A small Chrome DevTools Protocol driver for the end-to-end checks. Headless Chrome, a throwaway profile, real mouse events.
// The prototype sits in a sandboxed iframe with an opaque origin, so the page cannot reach into it; the debugger can,
// which is how these checks read the frame without the shipped file needing any back door.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 1500, height = 1000, port = 9400 + Math.floor(Math.random() * 400) } = {}) {
  const profile = mkdtempSync(path.join(tmpdir(), "wc-e2e-"));
  const chrome = spawn(CHROME, [`--remote-debugging-port=${port}`, "--headless=new", "--no-first-run", "--disable-gpu", "--disable-site-isolation-trials", "--disable-features=IsolateOrigins,site-per-process", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 60 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch { /* not up yet */ } if (!target) await sleep(250); }
  if (!target) throw new Error("Chrome did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.on("open", r));
  let id = 0;
  const pending = new Map();
  const handlers = [];
  ws.on("message", (m) => {
    const d = JSON.parse(m);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method) handlers.forEach((h) => h(d));
  });
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  const requests = [];
  const consoleErrors = [];
  const contexts = new Map(); // frameId -> executionContextId (default world)
  let mainFrameId = null;
  handlers.push((d) => {
    if (d.method === "Network.requestWillBeSent") requests.push(d.params.request.url);
    if (d.method === "Runtime.executionContextCreated") {
      const c = d.params.context;
      if (c.auxData?.isDefault) contexts.set(c.auxData.frameId, c.id);
    }
    if (d.method === "Runtime.executionContextDestroyed") for (const [f, cid] of contexts) if (cid === d.params.executionContextId) contexts.delete(f);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") consoleErrors.push(d.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
    if (d.method === "Runtime.exceptionThrown") consoleErrors.push("exception: " + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300));
  });
  await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });

  // Chrome sometimes opens its own page (for example Settings > About after an update). A background tab never acknowledges
  // mouse events, so a check would hang forever: close any other page and keep ours in front.
  const keepFront = async () => {
    try {
      for (const t of (await (await fetch(`http://127.0.0.1:${port}/json`)).json())) {
        if (t.type === "page" && t.id !== target.id) await fetch(`http://127.0.0.1:${port}/json/close/${t.id}`);
      }
      await fetch(`http://127.0.0.1:${port}/json/activate/${target.id}`);
    } catch { /* browser is closing */ }
  };
  const front = setInterval(keepFront, 2000);
  front.unref?.();

  const unwrap = (r) => { if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text); return r.result?.result?.value; };
  const ev = async (expression, contextId) => unwrap(await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, ...(contextId ? { contextId } : {}) }));
  const api = {
    send, ev, requests, consoleErrors,
    /** Call before goto: records every message the prototype frame posts to the page, for assertions. Test harness only. */
    async captureMessages() {
      await send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__wcMsgs=[];window.addEventListener('message',function(e){if(e.data&&e.data.source==='wc-proto'){window.__wcMsgs.push(e.data.msg);}});" });
    },
    async msgs() { return (await ev("window.__wcMsgs || []")) ?? []; },
    async clearMsgs() { await ev("window.__wcMsgs = []"); },
    async goto(url) { const t = await send("Page.getFrameTree"); mainFrameId = t.result.frameTree.frame.id; await send("Page.navigate", { url }); await sleep(800); },
    /** The default execution context of the (single) child frame, once it exists. */
    async frameContext(timeout = 15000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        const tree = (await send("Page.getFrameTree")).result.frameTree;
        const child = tree.childFrames?.[0]?.frame.id;
        if (child && contexts.has(child)) return contexts.get(child);
        await sleep(200);
      }
      throw new Error("the prototype frame did not appear");
    },
    async evFrame(expression) { return ev(expression, await api.frameContext()); },
    async waitFrame(expression, timeout = 15000, label = expression) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) { try { if (await api.evFrame(expression)) return true; } catch { /* frame reloading */ } await sleep(200); }
      throw new Error("timed out waiting in the frame for: " + label);
    },
    async waitPage(expression, timeout = 15000, label = expression) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) { try { if (await ev(expression)) return true; } catch { /* navigating */ } await sleep(150); }
      throw new Error("timed out waiting on the page for: " + label);
    },
    async mouse(type, x, y, extra = {}) { await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, ...extra }); },
    async move(x, y) { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }); },
    async click(x, y) { await api.move(x, y); await sleep(80); await api.mouse("mousePressed", x, y); await api.mouse("mouseReleased", x, y); },
    async key(key, code = key) {
      const vk = { Escape: 27, Enter: 13, Tab: 9, " ": 32 }[key];
      const extra = vk ? { windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk } : {};
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, ...extra });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, ...extra });
    },
    async type(text) { await send("Input.insertText", { text }); },
    async shot(file) { const r = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(file, Buffer.from(r.result.data, "base64")); },
    async resize(w, h) { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await sleep(300); },
    async close() { clearInterval(front); try { ws.close(); } catch { /* already closed */ } chrome.kill(); },
  };
  return api;
}

let passed = 0, failed = 0;
export function report(ok, message, detail = "") {
  if (ok) { passed += 1; console.log("  PASS  " + message); }
  else { failed += 1; console.log("  FAIL  " + message + (detail ? "  [" + detail + "]" : "")); }
}
export const summary = () => { console.log(`\n${passed} passed, ${failed} failed`); return failed === 0; };
