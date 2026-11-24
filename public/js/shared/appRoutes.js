// Single source of truth for the app's URL routes.
//
// Used by BOTH sides, so the two can never drift apart:
//   - public/_worker.js (Cloudflare Pages routing worker) decides which URLs
//     get the app shell, which are "noindex", and which are real 404s;
//   - public/js/modules/router.js builds its league routes from the same
//     lists and warns in the console if a route it registers is missing here.
//
// Pure data and pure functions only: no DOM, no imports. It must stay
// importable from a Worker as well as from the browser.
//
// ADDING AN APP SCREEN: add its route key to PUBLIC_ROUTES (anyone can open
// it) or PRIVATE_ROUTES (needs a login), then register its handler in
// router.js. Nothing else to touch.

export const LANGS = ["en", "am", "fr"];

// Static landing pages (public/<slug>/, public/am/<slug>/, public/fr/<slug>/).
// These are real files, never the app shell.
export const STATIC_SLUGS = [
  "live-scores", "custom-leagues", "about", "contact", "privacy",
  "champions-league-tournament", "world-cup-bracket", "tournament-bracket-maker",
];

// App routes anyone can open. They keep the shell's canonical and are indexable
// as far as the shell allows.
export const PUBLIC_ROUTES = ["home", "live", "live-standings", "live-matches"];

// App routes that need a login. Served with "X-Robots-Tag: noindex".
export const PRIVATE_ROUTES = [
  "messages", "profile", "achievements", "friends", "leagues",
  "champions-league", "europe-league", "euro-cup", "world-cup",
];

// Building blocks of the generated league routes, e.g. "ucl-basic-my",
// "wc-only-invited-national-knockouts", "uel-basic-my-club-group-A-standing".
export const LEAGUE = {
  clubComps: ["ucl", "uel", "euro", "wc"],
  nationalComps: ["euro", "wc"],
  stages: ["basic", "only"],          // basic = group + knockouts, only = knockouts only
  groupDetailStages: ["basic"],       // group pages exist only when there is a group stage
  access: ["my", "invited"],
  tabs: ["group", "knockouts"],
  views: ["standing", "matches"],
  letters: ["A", "B", "C", "D", "E", "F", "G", "H"],
};

// "<comp>-<stage>-<access>": the list of a user's leagues for one format.
export function leagueListKey(comp, stage, access) {
  return `${comp}-${stage}-${access}`;
}

// "<comp>-<stage>-<access>-<club|national>-<tab>": one league, group or knockout tab.
export function leagueInstanceKey(comp, stage, access, kind, tab) {
  return `${comp}-${stage}-${access}-${kind}-${tab}`;
}

// "<comp>-<stage>-<access>-<club|national>-group-<letter>-<view>": one group.
export function leagueGroupDetailKey(comp, stage, access, kind, letter, view) {
  return `${comp}-${stage}-${access}-${kind}-group-${letter}-${view}`;
}

// A knockout-only national tournament has no group tab.
export function isValidInstance(kind, stage, tab) {
  return !(kind === "national" && stage === "only" && tab === "group");
}

function buildLeagueRouteKeys() {
  const keys = [];
  const { clubComps, nationalComps, stages, groupDetailStages, access, tabs, views, letters } = LEAGUE;

  for (const comp of clubComps) {
    for (const stage of stages) {
      for (const acc of access) keys.push(leagueListKey(comp, stage, acc));
    }
  }

  for (const [kind, comps] of [["club", clubComps], ["national", nationalComps]]) {
    for (const comp of comps) {
      for (const acc of access) {
        for (const stage of stages) {
          for (const tab of tabs) {
            if (isValidInstance(kind, stage, tab)) keys.push(leagueInstanceKey(comp, stage, acc, kind, tab));
          }
        }
        for (const stage of groupDetailStages) {
          for (const view of views) {
            for (const letter of letters) keys.push(leagueGroupDetailKey(comp, stage, acc, kind, letter, view));
          }
        }
      }
    }
  }
  return keys;
}

export const LEAGUE_ROUTE_KEYS = buildLeagueRouteKeys();

const PUBLIC_SET = new Set(PUBLIC_ROUTES);
const PRIVATE_SET = new Set([...PRIVATE_ROUTES, ...LEAGUE_ROUTE_KEYS]);

// Every route key the app knows.
export const ALL_ROUTE_KEYS = [...PUBLIC_ROUTES, ...PRIVATE_ROUTES, ...LEAGUE_ROUTE_KEYS];

// "public", "private", or null when `key` is not an app route.
export function classifyRouteKey(key) {
  if (PUBLIC_SET.has(key)) return "public";
  if (PRIVATE_SET.has(key)) return "private";
  return null;
}
