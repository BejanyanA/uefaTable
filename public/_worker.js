// Cloudflare Pages routing worker ("advanced mode").
//
// The app in index.html is a single-page app whose screens live at real paths
// like "/en/leagues". Pages would otherwise answer EVERY unknown path with
// index.html and a 200 status, so search engines saw endless duplicate
// homepages ("soft 404s"). This worker:
//   - serves the app shell only for paths that are real app routes,
//   - marks the login-only app screens "noindex",
//   - translates the shell on the server for /fr/... and /am/... URLs, so the
//     page arrives in the right language instead of switching after load,
//   - gives the translated homepages (/fr/, /am/) their own title,
//     description, canonical and structured data,
//   - lets Pages serve everything else (static pages, files), which ends in
//     404.html with a real 404 status when nothing matches.
//
// Nothing here is a copy: the route list and the translations are imported
// from the same modules the browser app uses (js/shared/).
//
// Static folders (/assets, /css, /js, ...) bypass this worker entirely: see
// _routes.json.

import { LANGS, STATIC_SLUGS, classifyRouteKey } from "./js/shared/appRoutes.js";
import { langMap } from "./js/shared/langMap.js";

const SITE = "https://uefaresults.com";
const LANG_SET = new Set(LANGS);
const STATIC_SET = new Set(STATIC_SLUGS);

// URL prefix -> <html lang> value. English is what index.html already contains.
const TRANSLATED = { fr: "fr", am: "hy" };

// Elements of the shell that are visible on first paint: element id -> key in
// langMap. The app's own JavaScript applies the same keys again after load.
const SHELL_TEXT = {
  loginBtn: "login",
  registerBtn: "registerBtn",
  seoH1: "seoH1",
  liveFootball: "liveFootball",
  liveFootballTitle: "liveFootballTitle",
  liveFootballDescription: "liveFootballDescription",
  openLiveFootball: "openLiveFootball",
  customLeague: "customLeague",
  customLeagueTitle: "customLeagueTitle",
  customLeagueDescription: "customLeagueDescription",
  openCustomleague: "openCustomleague",
  seoHeading: "seoHeading",
  seoIntro: "seoIntro",
  seoCustomHeading: "seoCustomHeading",
  seoCustomText: "seoCustomText",
  seoFeaturesHeading: "seoFeaturesHeading",
  seoFeat1Label: "seoFeat1Label",
  seoFeat1Text: "seoFeat1Text",
  seoFeat2Label: "seoFeat2Label",
  seoFeat2Text: "seoFeat2Text",
  seoFeat3Label: "seoFeat3Label",
  seoFeat3Text: "seoFeat3Text",
  seoFeat4Label: "seoFeat4Label",
  seoFeat4Text: "seoFeat4Text",
  seoLinkLive: "seoLinkLive",
  seoLinkCustom: "seoLinkCustom",
  footerAbout: "footerAbout",
  footerContact: "footerContact",
  footerPrivacy: "footerPrivacy",
};

// Links of the shell that point at a landing page: element id -> path. On a
// translated URL they must lead to the landing page in that language.
const SHELL_LINKS = {
  seoLinkLive: "/live-scores/",
  seoLinkCustom: "/custom-leagues/",
  footerAbout: "/about/",
  footerContact: "/contact/",
  footerPrivacy: "/privacy/",
};

// Search-result texts and FAQ of the translated homepages. The English ones
// are in index.html itself.
const LOCALIZED_HOME = {
  fr: {
    title: "UEFA Results - Scores de football en direct et ligues personnalisées",
    description:
      "Suivez les scores de football en direct, les matchs et les classements de la Ligue des champions et de la Coupe du monde, et créez vos ligues entre amis.",
    faq: [
      [
        "Comment créer une ligue de football personnalisée entre amis ?",
        "Ouvrez UEFA Results, choisissez Ligue personnalisée, sélectionnez un format à groupes ou à élimination directe, définissez le nombre d’équipes, invitez vos amis et commencez à suivre les classements ensemble. C’est gratuit.",
      ],
      [
        "Où puis-je suivre les scores de football en direct ?",
        "UEFA Results affiche les scores de football en direct en temps réel, ainsi que les matchs à venir et les résultats finaux, mis à jour automatiquement au fil des matchs.",
      ],
      [
        "UEFA Results est-il gratuit ?",
        "Oui, suivre les scores en direct, les matchs et les classements sur UEFA Results est entièrement gratuit.",
      ],
    ],
  },
  am: {
    title: "UEFA Results - Ֆուտբոլի ուղիղ հաշիվներ և անհատական լիգաներ",
    description:
      "Հետևեք ֆուտբոլի ուղիղ հաշիվներին, խաղերին և աղյուսակներին, դիտեք Չեմպիոնների լիգայի և Աշխարհի առաջնության աղյուսակները և ստեղծեք ձեր լիգաները ընկերների հետ։",
    faq: [
      [
        "Ինչպե՞ս ստեղծել անհատական ֆուտբոլային լիգա ընկերների հետ։",
        "Բացեք UEFA Results-ը, ընտրեք Անհատական լիգա, ընտրեք խմբային կամ փլեյ-օֆֆ ձևաչափ, նշեք թիմերի քանակը, հրավիրեք ընկերներին և սկսեք միասին հետևել աղյուսակին։ Անվճար է։",
      ],
      [
        "Որտե՞ղ կարող եմ հետևել ֆուտբոլի ուղիղ հաշիվներին։",
        "UEFA Results-ը ցույց է տալիս ֆուտբոլի ուղիղ հաշիվները իրական ժամանակում, ինչպես նաև սպասվող խաղերն ու վերջնական արդյունքները, որոնք ավտոմատ թարմացվում են խաղերի ընթացքում։",
      ],
      [
        "UEFA Results-ն անվճա՞ր է։",
        "Այո, UEFA Results-ում ուղիղ հաշիվներին, խաղերին և աղյուսակներին հետևելը լիովին անվճար է։",
      ],
    ],
  },
};

// Returns { kind: "public" | "private" | null, lang, isHome }.
// kind null means "not an app route".
function classifyPath(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const lang = LANG_SET.has(segments[0]) ? segments[0] : null;
  const rest = lang ? segments.slice(1) : segments;
  const none = { kind: null, lang, isHome: false };

  if (rest.length === 0) {
    // "/en" -> app home; "/" -> static index.html
    return lang ? { kind: "public", lang, isHome: true } : none;
  }
  if (rest.length > 1) return none;

  const slug = rest[0];
  if (STATIC_SET.has(slug)) return none;
  const kind = classifyRouteKey(slug);
  return kind ? { kind, lang, isHome: slug === "home" } : none;
}

const setAttr = (name, value) => ({
  element(el) {
    el.setAttribute(name, value);
  },
});

// Translates the visible shell text and its landing-page links.
function translateShell(rewriter, lang) {
  const t = langMap[lang];
  rewriter.on("html", setAttr("lang", TRANSLATED[lang]));
  rewriter.on("#langTrigger", setAttr("src", `assets/flags/${lang}.svg`));

  for (const [id, key] of Object.entries(SHELL_TEXT)) {
    const text = t[key];
    const href = SHELL_LINKS[id] ? `/${lang}${SHELL_LINKS[id]}` : null;
    if (text == null && !href) continue;
    rewriter.on(`#${id}`, {
      element(el) {
        if (text != null) el.setInnerContent(text);
        if (href) el.setAttribute("href", href);
      },
    });
  }
}

// Rewrites the JSON-LD block of the shell for a translated homepage. The block
// arrives in chunks, so it is buffered and replaced in one go; if anything is
// unexpected the original block is passed through untouched.
class JsonLdLocalizer {
  constructor(lang) {
    this.lang = lang;
    this.buffer = "";
  }

  text(chunk) {
    this.buffer += chunk.text;
    if (!chunk.lastInTextNode) {
      chunk.remove();
      return;
    }
    let out = this.buffer;
    try {
      const data = JSON.parse(this.buffer);
      const meta = LOCALIZED_HOME[this.lang];
      for (const node of data["@graph"] || []) {
        if (node["@type"] === "WebSite") {
          node.description = meta.description;
          node.inLanguage = TRANSLATED[this.lang];
        } else if (node["@type"] === "FAQPage") {
          node["@id"] = `${SITE}/${this.lang}/#faq`;
          node.inLanguage = TRANSLATED[this.lang];
          node.mainEntity = meta.faq.map(([question, answer]) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: { "@type": "Answer", text: answer },
          }));
        }
      }
      // "<" is escaped so the JSON can never close the <script> element.
      out = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
    } catch (err) {
      out = this.buffer;
    }
    chunk.replace(out, { html: true });
    this.buffer = "";
  }
}

// Own title, description, canonical and structured data for "/fr/" and "/am/".
function localizeHomeHead(rewriter, lang) {
  const meta = LOCALIZED_HOME[lang];
  const canonical = `${SITE}/${lang}/`;
  rewriter
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
    .on('script[type="application/ld+json"]', new JsonLdLocalizer(lang));
}

// Fetches index.html (the app shell) for the current request.
function fetchShell(request, env, url, { fresh }) {
  const headers = new Headers(request.headers);
  if (fresh) {
    // The shell is about to be rewritten, so a "304 Not Modified" for
    // index.html would be wrong: the rewritten page can change (new
    // translations) while index.html stays the same.
    headers.delete("if-none-match");
    headers.delete("if-modified-since");
  }
  return env.ASSETS.fetch(new Request(new URL("/", url), { method: request.method, headers }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { kind, lang, isHome } = classifyPath(url.pathname);

    // Not an app route: static file, static page, redirect or 404.html.
    if (!kind) return env.ASSETS.fetch(request);

    const translated = Boolean(TRANSLATED[lang]);

    // One address per translated homepage: "/fr" -> "/fr/".
    if (translated && url.pathname === `/${lang}`) {
      return Response.redirect(`${url.origin}/${lang}/${url.search}`, 301);
    }

    // App route: answer with the app shell (index.html) at this URL.
    const shell = await fetchShell(request, env, url, { fresh: translated });
    const response = new Response(shell.body, shell);
    if (kind === "private") response.headers.set("X-Robots-Tag", "noindex");
    if (!translated) return response;

    // The rewritten page no longer matches index.html's validator.
    response.headers.delete("etag");
    response.headers.delete("last-modified");

    const rewriter = new HTMLRewriter();
    translateShell(rewriter, lang);
    if (isHome) localizeHomeHead(rewriter, lang);
    return rewriter.transform(response);
  },
};
