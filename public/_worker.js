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

// Translated homepages. "/fr/" and "/am/" are indexable pages of their own:
// the worker gives the shell its own lang, title, description and canonical.
// (The visible text is translated by the inline script at the end of
// index.html; the hreflang links are static in index.html.)
const SITE = "https://uefaresults.com";
const LOCALIZED_HOME = {
  fr: {
    htmlLang: "fr",
    title: "UEFA Results - Scores de football en direct et ligues personnalisées",
    description:
      "Suivez les scores de football en direct, les matchs et les classements de la Ligue des champions et de la Coupe du monde, et créez vos ligues entre amis.",
  },
  am: {
    htmlLang: "hy",
    title: "UEFA Results - Ֆուտբոլի ուղիղ հաշիվներ և անհատական լիգաներ",
    description:
      "Հետևեք ֆուտբոլի ուղիղ հաշիվներին, խաղերին և աղյուսակներին, դիտեք Չեմպիոնների լիգայի և Աշխարհի առաջնության աղյուսակները և ստեղծեք ձեր լիգաները ընկերների հետ։",
  },
};

// Returns { kind: "public" | "private" | null, lang, isHome }.
// kind null means "not an app route".
function classifyAppRoute(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const lang = LANGS.has(segments[0]) ? segments[0] : null;
  const rest = lang ? segments.slice(1) : segments;
  const none = { kind: null, lang, isHome: false };

  if (rest.length === 0) {
    // "/en" -> app home; "/" -> static index.html
    return lang ? { kind: "public", lang, isHome: true } : none;
  }
  if (rest.length > 1) return none;

  const slug = rest[0];
  if (STATIC_SLUGS.has(slug)) return none;
  if (PUBLIC_ROUTES.has(slug)) return { kind: "public", lang, isHome: slug === "home" };
  if (PRIVATE_ROUTES.has(slug) || LEAGUE_ROUTE.test(slug)) return { kind: "private", lang, isHome: false };
  return none;
}

const setAttr = (name, value) => ({
  element(el) {
    el.setAttribute(name, value);
  },
});

function localizeHome(response, lang) {
  const meta = LOCALIZED_HOME[lang];
  const canonical = `${SITE}/${lang}/`;
  return new HTMLRewriter()
    .on("html", setAttr("lang", meta.htmlLang))
    .on("title", {
      element(el) {
        el.setInnerContent(meta.title);
      },
    })
    .on('meta[name="description"]', setAttr("content", meta.description))
    .on('link[rel="canonical"]', setAttr("href", canonical))
    .on('meta[property="og:title"]', setAttr("content", meta.title))
    .on('meta[property="og:description"]', setAttr("content", meta.description))
    .on('meta[property="og:url"]', setAttr("content", canonical))
    .on('meta[name="twitter:title"]', setAttr("content", meta.title))
    .on('meta[name="twitter:description"]', setAttr("content", meta.description))
    .transform(response);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { kind, lang, isHome } = classifyAppRoute(url.pathname);

    // Not an app route: static file, static page, redirect or 404.html.
    if (!kind) return env.ASSETS.fetch(request);

    // One address per translated homepage: "/fr" -> "/fr/".
    if (LOCALIZED_HOME[lang] && url.pathname === `/${lang}`) {
      return Response.redirect(`${url.origin}/${lang}/${url.search}`, 301);
    }

    // App route: answer with the app shell (index.html) at this URL.
    const shell = await env.ASSETS.fetch(new Request(new URL("/", url), request));
    let response = new Response(shell.body, shell);
    if (kind === "private") response.headers.set("X-Robots-Tag", "noindex");
    if (isHome && LOCALIZED_HOME[lang]) response = localizeHome(response, lang);
    return response;
  },
};
