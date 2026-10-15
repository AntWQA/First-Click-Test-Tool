// Builds the prototype copy and the shell, then folds everything into ONE html file: dist-single/wayfinding-check.html.
// It fails the build rather than ship something that would reach for the network, carry live data, or blow the size budget.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUDGET_BYTES = 4 * 1024 * 1024;
const fail = (msg) => { console.error("BUILD FAILED: " + msg); process.exit(1); };
const MB = (n) => (n / 1048576).toFixed(2) + " MB";

await build({ root, configFile: path.join(root, "vite.proto.config.ts"), logLevel: "warn" });
await build({ root, configFile: path.join(root, "vite.shell.config.ts"), logLevel: "warn" });

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
const s = parts(path.join(root, "dist-shell"));
const embedded = JSON.stringify(protoDoc).replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
// A Content-Security-Policy makes "no network at runtime" something the browser enforces, not just something checked in the
// markup: nothing may load or connect except inline code and data URIs. The prototype frame (about:srcdoc) inherits it.
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; frame-src about:; base-uri 'none'; form-action 'none'";
const shellDoc = s.html
  .replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
  .replace(/<link rel="stylesheet"[^>]*>/, "")
  .replace(/<script type="module"[^>]*><\/script>/, "")
  .replace("</head>", () => `<style>${s.css.replace(/<\/style/gi, "<\\/style")}</style></head>`)
  .replace("</body>", () => `<script>window.__PROTO_HTML__=${embedded};</script><script type="module">${escScript(s.js)}</script></body>`);

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
check(!/liveCatalogue\s*=\s*\{\s*"?products/.test(shellDoc), "live catalogue data is in the build");

mkdirSync(path.join(root, "dist-single"), { recursive: true });
const outFile = path.join(root, "dist-single", "wayfinding-check.html");
writeFileSync(outFile, shellDoc);
console.log(`built ${path.relative(root, outFile)}  ${MB(size)}  (prototype document ${MB(Buffer.byteLength(protoDoc))}, shell ${MB(size - Buffer.byteLength(protoDoc))})`);
console.log(`${checks.length} safeguards passed`);
const hosts = new Set([...shellDoc.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)].map((m) => m[1]));
console.log("hosts mentioned as text in scripts (none are fetched; checked at runtime by the e2e test): " + [...hosts].join(", "));
