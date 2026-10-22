// Builds the prototype copy and the shell, then folds everything into ONE html file: dist-single/wayfinding-check.html.
// `node scripts/build-single.mjs participant` builds the participant edition instead (set up and run by the participant
// alone, no moderator screens): dist-single/wayfinding-check-participant.html. WC_SEND_TO=name@example.com bakes the address
// the participant is told to send their results to into that file.
// It fails the build rather than ship something that would reach for the network, carry live data, or blow the size budget.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const edition = process.argv[2] === "participant" ? "participant" : "moderator";
const shellConfig = edition === "participant" ? "vite.participant.config.ts" : "vite.shell.config.ts";
const shellOut = edition === "participant" ? "dist-participant" : "dist-shell";
// Raised from 4 MB on 19 Oct 2026 for the homepage images and the 0.8 MB featured-tile video (the artefact host allows 16 MB).
const BUDGET_BYTES = 6 * 1024 * 1024;
const fail = (msg) => { console.error("BUILD FAILED: " + msg); process.exit(1); };
const MB = (n) => (n / 1048576).toFixed(2) + " MB";

await build({ root, configFile: path.join(root, "vite.proto.config.ts"), logLevel: "warn" });
await build({ root, configFile: path.join(root, shellConfig), logLevel: "warn" });

function parts(dir) {
  const html = readFileSync(path.join(dir, readdirSync(dir).find((f) => f.endsWith(".html"))), "utf8");
  const assets = readdirSync(path.join(dir, "assets"));
  const jsFiles = assets.filter((f) => f.endsWith(".js")), cssFiles = assets.filter((f) => f.endsWith(".css"));
  if (jsFiles.length !== 1 || cssFiles.length !== 1 || assets.length !== 2) fail(`${dir}: expected exactly one script and one stylesheet, found ${assets.join(", ")}`);
  return { html, js: readFileSync(path.join(dir, "assets", jsFiles[0]), "utf8"), css: readFileSync(path.join(dir, "assets", cssFiles[0]), "utf8") };
}

// Raleway is the default theme's face. The elevated theme the prototype uses sets Plus Jakarta Sans, so the 18 Raleway
// @font-face blocks (5 MB of base64) are dead weight. Pure's avatar placeholders point at remote photos; they are never
// rendered here, but the references are neutralised so nothing can reach the network.
function prune(css) {
  const out = css.replace(/@font-face\{[^}]*RalewayDoTERRA[^}]*\}/g, "").replace(/url\(https?:[^)]*\)/g, "url(data:,)");
  return out;
}
const escScript = (s) => s.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

// ---- prototype document
const p = parts(path.join(root, "dist-proto"));
const protoCss = prune(p.css);
const protoDoc = p.html
  .replace(/<link rel="stylesheet"[^>]*>/, "")
  .replace(/<script type="module"[^>]*><\/script>/, "")
  .replace("<head>", "<head><!--wc-nonce-->")
  .replace("</head>", () => `<style>${protoCss.replace(/<\/style/gi, "<\\/style")}</style></head>`)
  .replace("</body>", () => `<script type="module">${escScript(p.js)}</script></body>`);

// ---- shell document, with the prototype embedded as a string the shell hands to the sandboxed iframe
const s = parts(path.join(root, shellOut));
// The participant edition tells people who is running the study, how long results are kept and where to send the file.
// A public file must carry all three: the build refuses without them unless WC_ALLOW_MISSING=1 (local testing only).
const clean = (v) => (v ?? "").trim();
const BAD_CHARS = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff<>"`]/;
const sendTo = clean(process.env.WC_SEND_TO), controller = clean(process.env.WC_CONTROLLER), retention = clean(process.env.WC_RETENTION);
if (sendTo && (sendTo.length > 120 || BAD_CHARS.test(sendTo) || !/^[^\s@']+@[^\s@']+\.[^\s@']+$/.test(sendTo))) fail(`WC_SEND_TO is not a plain email address: ${sendTo}`);
for (const [name, v] of [["WC_CONTROLLER", controller], ["WC_RETENTION", retention]]) if (v && (v.length > 160 || BAD_CHARS.test(v))) fail(`${name} must be plain text of at most 160 characters`);
if (edition === "participant" && process.env.WC_ALLOW_MISSING !== "1") {
  const missing = [["WC_SEND_TO", sendTo], ["WC_CONTROLLER", controller], ["WC_RETENTION", retention]].filter(([, v]) => !v).map(([n]) => n);
  if (missing.length) fail(`the participant edition needs ${missing.join(", ")} (for example WC_SEND_TO=research@example.com WC_CONTROLLER="Example Ltd" WC_RETENTION="12 months"); set WC_ALLOW_MISSING=1 only for local testing`);
}
const inject = JSON.stringify({ sendTo, controller, retention }).replace(/</g, "\\u003c");
const sendToScript = edition === "participant" ? `<script>window.__WC_SEND_TO__=${JSON.stringify(sendTo)};window.__WC_NOTICE__=${inject};</script>` : "";
const embedded = JSON.stringify(protoDoc).replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
// A Content-Security-Policy makes "no network at runtime" something the browser enforces, not just something checked in the
// markup: nothing may load or connect except inline code and data URIs. The prototype frame (about:srcdoc) inherits it.
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; frame-src about:; base-uri 'none'; form-action 'none'";
const shellDoc = s.html
  .replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
  .replace(/<link rel="stylesheet"[^>]*>/, "")
  .replace(/<script type="module"[^>]*><\/script>/, "")
  .replace("</head>", () => `<style>${s.css.replace(/<\/style/gi, "<\\/style")}</style></head>`)
  .replace("</body>", () => `${sendToScript}<script>window.__PROTO_HTML__=${embedded};</script><script type="module">${escScript(s.js)}</script></body>`);

// ---- safeguards
const checks = [];
const check = (ok, msg) => { checks.push([ok, msg]); if (!ok) fail(msg); };
// A forbidden pattern: on a hit, the failure shows the text around it so the cause is visible.
const forbid = (re, text, msg) => {
  const m = re.exec(text);
  check(!m, m ? `${msg}: ...${text.slice(Math.max(0, m.index - 80), m.index + 120).replace(/\s+/g, " ")}...` : msg);
};
const size = Buffer.byteLength(shellDoc);
check(size <= BUDGET_BYTES, `size ${MB(size)} is over the ${MB(BUDGET_BYTES)} budget`);
// Structure checks look at the document skeleton: script and style bodies are code, and may mention tags in warning text.
const skeleton = (doc) => doc.replace(/<script[\s\S]*?<\/script>/g, "<script></script>").replace(/<style[\s\S]*?<\/style>/g, "<style></style>");
for (const [name, doc] of [["shell", shellDoc], ["prototype", protoDoc]]) {
  forbid(/<link\b/i, skeleton(doc), `the ${name} document contains a <link> element`);
  forbid(/<script[^>]*\ssrc=/i, skeleton(doc), `the ${name} document loads a script by URL`);
}
check(!/<(img|iframe|source|video|audio)\b[^>]*\s(src|srcset)=["']?https?:/i.test(shellDoc), "the final document has a remote media or frame source");
check(!/@import/.test(protoCss + s.css), "a stylesheet imports another stylesheet");
const cssUrls = [...(protoCss + s.css).matchAll(/url\(([^)]*)\)/g)].map((m) => m[1].replace(/^["']|["']$/g, ""));
check(cssUrls.every((u) => u.startsWith("data:")), "a stylesheet references a file by URL: " + cssUrls.find((u) => !u.startsWith("data:")));
check(!/RalewayDoTERRA[^;}]*\.(woff2?|ttf)/.test(protoCss), "a Raleway font file survived pruning");
check(!/Live Catalogue Data|catalogue\.live/.test(shellDoc), "a reference to the live catalogue folder is in the build");
if (edition === "participant") {
  // The participant edition must carry none of the moderator screens or guidance.
  for (const phrase of ["Add or edit findings", "Hand over to participant", "Researcher: continue", "Backup and import", "What the recorder sees", "Moderator options", "Reset to the plan"]) check(!shellDoc.includes(phrase), `the participant edition contains moderator text: ${phrase}`);
}
check(!/liveCatalogue\s*=\s*\{\s*"?products/.test(shellDoc), "live catalogue data is in the build");

mkdirSync(path.join(root, "dist-single"), { recursive: true });
const outFile = path.join(root, "dist-single", edition === "participant" ? "wayfinding-check-participant.html" : "wayfinding-check.html");
writeFileSync(outFile, shellDoc);
console.log(`built ${path.relative(root, outFile)}  ${MB(size)}  (prototype document ${MB(Buffer.byteLength(protoDoc))}, shell ${MB(size - Buffer.byteLength(protoDoc))})`);
console.log(`${checks.length} safeguards passed`);
const hosts = new Set([...shellDoc.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)].map((m) => m[1]));
console.log("hosts mentioned as text in scripts (none are fetched; checked at runtime by the e2e test): " + [...hosts].join(", "));
