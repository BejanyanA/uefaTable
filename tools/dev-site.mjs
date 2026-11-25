// Runs the site (public/) on this machine, the way Cloudflare Pages serves it.
//
//   npm run dev:site            -> http://localhost:8788
//
// Why not just "wrangler pages dev public": started inside the repo, wrangler
// finds wrangler.toml, which belongs to the API Worker, and fails. So this
// starts it from an empty temporary folder that only holds a link to public/.
// Edits in public/ show up on reload.
//
// The local site talks to the dev API (see public/js/services/config.js).

import { spawn } from "node:child_process";
import { mkdtempSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WRANGLER = "wrangler@4.168.0";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.PORT || "8788";

const workDir = mkdtempSync(join(tmpdir(), "uefa-site-"));
symlinkSync(join(root, "public"), join(workDir, "public"), "dir");

const child = spawn("npx", [WRANGLER, "pages", "dev", "public", "--port", port], {
  cwd: workDir,
  stdio: "inherit",
});

function cleanUp() {
  rmSync(workDir, { recursive: true, force: true });
}

child.on("exit", (code) => {
  cleanUp();
  process.exit(code ?? 0);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
