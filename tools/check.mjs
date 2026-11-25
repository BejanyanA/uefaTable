// Quick "did I break anything?" check for the whole project.
//
//   npm run check                              -> code checks + the dev site
//   npm run check -- http://localhost:8788     -> code checks + a local site (npm run dev:site)
//   npm run check -- https://uefaresults.com   -> code checks + production (read-only requests)
//   npm run check -- --local                   -> code checks only, no network
//
// It only reads: plain GET requests and one empty login POST that the API
// rejects. It does not replace looking at the changed screen in a browser at
// phone and desktop widths, logged in and logged out.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const localOnly = args.includes("--local");
const base = (args.find((a) => /^https?:\/\//.test(a)) || "https://dev.uefatable.pages.dev").replace(/\/$/, "");
const isProduction = /^https:\/\/(www\.)?uefaresults\.com$/.test(base);
const api = isProduction ? "https://api.uefaresults.com" : "https://uefa-app-dev.bejanyanaper.workers.dev";

let failed = 0;
let warned = 0;
const ok = (name) => console.log(`  ok    ${name}`);
const fail = (name, why) => { failed++; console.log(`  FAIL  ${name}${why ? ` - ${why}` : ""}`); };
const warn = (name, why) => { warned++; console.log(`  warn  ${name}${why ? ` - ${why}` : ""}`); };
const check = (name, pass, why) => (pass ? ok(name) : fail(name, why));

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------- code checks
console.log("Code");

// 1. Every script parses.
const scripts = [
  ...walk(join(root, "public/js")), ...walk(join(root, "routes_endpoints")),
  ...walk(join(root, "utils")), ...walk(join(root, "tools")),
  join(root, "worker.js"), join(root, "public/_worker.js"),
].filter((f) => /\.(js|mjs)$/.test(f));
const broken = [];
for (const file of scripts) {
  try { execFileSync(process.execPath, ["--check", file], { stdio: "pipe" }); }
  catch (e) { broken.push(`${file.slice(root.length + 1)}: ${String(e.stderr).split("\n").find((l) => /Error/.test(l)) || "syntax error"}`); }
}
check(`${scripts.length} scripts parse`, broken.length === 0, broken.join("; "));

// 2. The preload list in index.html matches the real imports.
try {
  execFileSync(process.execPath, [join(root, "tools/update-preloads.mjs"), "--check"], { stdio: "pipe" });
  ok("preload list is up to date");
} catch { fail("preload list is up to date", "run: npm run preloads"); }

// 3. Every translation key exists in all three languages.
const { langMap } = await import(pathToFileURL(join(root, "public/js/shared/langMap.js")).href);
const langs = Object.keys(langMap);
const allKeys = new Set(langs.flatMap((l) => Object.keys(langMap[l])));
const missing = [];
for (const l of langs) for (const k of allKeys) if (!(k in langMap[l])) missing.push(`${l}.${k}`);
if (missing.length) warn(`translations: ${missing.length} key(s) not in every language`, missing.slice(0, 8).join(", ") + (missing.length > 8 ? ", ..." : ""));
else ok(`translations: ${allKeys.size} keys in ${langs.join(", ")}`);

// 4. No long dashes in lines added since main (project rule: write "-").
try {
  const diff = execFileSync("git", ["diff", "main", "--unified=0", "--", ".", ":(exclude)package-lock.json"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const bad = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++") && /[\u2013\u2014]/.test(l));
  check("no long dashes in lines added since main", bad.length === 0, `${bad.length} line(s), e.g. ${bad[0]?.slice(0, 80)}`);
} catch { warn("no long dashes in lines added since main", "could not compare with main"); }

// 5. The sitemap lists the home page and every landing page in every language.
const { LANGS, STATIC_SLUGS } = await import(pathToFileURL(join(root, "public/js/shared/appRoutes.js")).href);
const locs = (readFileSync(join(root, "public/sitemap.xml"), "utf8").match(/<loc>/g) || []).length;
const expectedLocs = LANGS.length * (STATIC_SLUGS.length + 1);
check(`sitemap has ${expectedLocs} addresses`, locs === expectedLocs, `found ${locs}`);

// ---------------------------------------------------------------- site checks
if (!localOnly) {
  console.log(`\nSite  ${base}`);
  const get = async (path, init = {}) => {
    try { return await fetch(base + path, { redirect: "manual", ...init }); }
    catch (e) { return { status: 0, headers: new Headers(), text: async () => "", error: String(e.cause?.code || e.message) }; }
  };
  const expectStatus = async (path, status) => {
    const r = await get(path);
    check(`${path} -> ${status}`, r.status === status, r.error || `got ${r.status}`);
    return r;
  };

  // Home in three languages, translated on the server.
  for (const [path, lang] of [["/", "en"], ["/fr/", "fr"], ["/am/", "hy"]]) {
    const r = await get(path);
    const html = await r.text();
    check(`${path} -> 200, html lang="${lang}"`, r.status === 200 && new RegExp(`<html[^>]*lang="${lang}"`).test(html), r.error || `status ${r.status}`);
  }
  const redirect = await get("/fr");
  check("/fr -> 301 /fr/", redirect.status === 301 && /\/fr\/$/.test(redirect.headers.get("location") || ""), `got ${redirect.status}`);

  // App screens: public ones open, private ones are kept out of Google.
  for (const route of ["home", "live", "live-standings", "live-matches"]) {
    const r = await expectStatus(`/en/${route}`, 200);
    if (isProduction) check(`/en/${route} is indexable`, !/noindex/i.test(r.headers.get("x-robots-tag") || ""), "has noindex");
  }
  for (const route of ["leagues", "messages", "profile"]) {
    const r = await get(`/en/${route}`);
    check(`/en/${route} -> 200 with noindex`, r.status === 200 && /noindex/i.test(r.headers.get("x-robots-tag") || ""), `status ${r.status}`);
  }

  // Unknown addresses are real 404s (a 200 here is a "soft 404" for Google).
  await expectStatus("/no-such-page-check/", 404);
  await expectStatus("/en/no-such-route-check", 404);

  // Landing pages in three languages.
  const pages = STATIC_SLUGS.flatMap((s) => [`/${s}/`, `/fr/${s}/`, `/am/${s}/`]);
  const results = await Promise.all(pages.map(async (p) => [p, (await get(p)).status]));
  const badPages = results.filter(([, s]) => s !== 200);
  check(`${pages.length} landing pages -> 200`, badPages.length === 0, badPages.map(([p, s]) => `${p} ${s}`).join(", "));

  // Files every page needs.
  for (const path of ["/js/app.js", "/js/services/config.js", "/css/style.css", "/sitemap.xml", "/robots.txt", "/site.webmanifest"]) {
    await expectStatus(path, 200);
  }

  // API: answers, and only accepts the site's own address.
  console.log(`\nAPI   ${api}`);
  const origin = /localhost|127\.0\.0\.1/.test(base) ? base : new URL(base).origin;
  const apiGet = async (path, init) => { try { return await fetch(api + path, init); } catch (e) { return { status: 0, headers: new Headers(), error: String(e.cause?.code || e.message) }; } };
  const logos = await apiGet("/league-logos", { headers: { Origin: origin } });
  check("/league-logos -> 200 for the site", logos.status === 200 && logos.headers.get("access-control-allow-origin") === origin, logos.error || `status ${logos.status}, allow-origin ${logos.headers.get("access-control-allow-origin")}`);
  const login = await apiGet("/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
  check("/login rejects an empty form with 400", login.status === 400, login.error || `status ${login.status}`);
  const stranger = await apiGet("/league-logos", { headers: { Origin: "https://not-this-site.example" } });
  check("another website is refused", stranger.status === 403, stranger.error || `status ${stranger.status}`);
}

console.log(`\n${failed ? `${failed} FAILED` : "All checks passed"}${warned ? `, ${warned} warning(s)` : ""}.`);
process.exit(failed ? 1 : 0);
