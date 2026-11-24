// Cloudflare Pages routing worker ("advanced mode").
//
// The app in index.html is a single-page app whose screens live at real paths
// like "/en/leagues". Pages would otherwise answer EVERY unknown path with
// index.html and a 200 status, so search engines saw endless duplicate
// homepages ("soft 404s"). This worker:
//   - serves the app shell only for paths that are real app routes,
//   - marks the login-only app screens "noindex",
//   - lets Pages serve everything else (static pages, files), which now ends
//     in 404.html with a real 404 status when nothing matches.
//
// Static folders (/assets, /css, /js, ...) bypass this worker entirely: see
// _routes.json.

const LANGS = new Set(["en", "am", "fr"]);

// Translated static landing pages (public/am/<slug>/, public/fr/<slug>/).
// These must reach the static files, never the app shell.
const STATIC_SLUGS = new Set(["live-scores", "custom-leagues", "about", "contact", "privacy"]);

// App routes anyone can open. They keep the shell's canonical ("/") and are
// not marked noindex.
const PUBLIC_ROUTES = new Set(["home", "live", "live-standings", "live-matches"]);

// App routes that need a login. Keep in sync with `routes` in
// public/js/modules/router.js.
const PRIVATE_ROUTES = new Set([
  "messages", "profile", "achievements", "friends", "leagues",
  "champions-league", "europe-league", "euro-cup", "world-cup",
]);

// Generated league routes, e.g. "ucl-basic-my", "wc-only-invited-national-knockouts",
// "uel-basic-my-club-group-A-standing" (see the register*Routes functions in router.js).
const LEAGUE_ROUTE =
  /^(ucl|uel|euro|wc)-(basic|only)-(my|invited)(-(club|national)-(group|knockouts|group-[A-H]-(standing|matches)))?$/;

// Returns "public", "private" or null (not an app route).
function classifyAppRoute(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const hasLang = LANGS.has(segments[0]);
  const rest = hasLang ? segments.slice(1) : segments;

  if (rest.length === 0) return hasLang ? "public" : null; // "/en" -> app home; "/" -> static index
  if (rest.length > 1) return null;

  const slug = rest[0];
  if (STATIC_SLUGS.has(slug)) return null;
  if (PUBLIC_ROUTES.has(slug)) return "public";
  if (PRIVATE_ROUTES.has(slug) || LEAGUE_ROUTE.test(slug)) return "private";
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const kind = classifyAppRoute(url.pathname);

    // Not an app route: static file, static page, redirect or 404.html.
    if (!kind) return env.ASSETS.fetch(request);

    // App route: answer with the app shell (index.html) at this URL.
    const shell = await env.ASSETS.fetch(new Request(new URL("/", url), request));
    const response = new Response(shell.body, shell);
    if (kind === "private") response.headers.set("X-Robots-Tag", "noindex");
    return response;
  },
};
