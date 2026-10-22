// Runs every end-to-end check against dist-single/wayfinding-check.html, one after another, and fails if any fail.
// Build first (npm run build:single). WC_FUZZ=full makes the recorder sweep cover every link.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;
// selfrun-check needs the participant edition built first: npm run build:participant
for (const name of ["frame-check", "recorder-check", "pdp-check", "session-check", "a11y-check", "import-check", "stale-content-check", "selfrun-check"]) {
  console.log(`\n=== ${name}`);
  const r = spawnSync(process.execPath, [path.join(here, `${name}.mjs`)], { stdio: "inherit", env: process.env });
  if (r.status !== 0) failed += 1;
}
console.log(failed === 0 ? "\nAll end-to-end checks passed." : `\n${failed} end-to-end check${failed === 1 ? "" : "s"} failed.`);
process.exit(failed === 0 ? 0 : 1);
