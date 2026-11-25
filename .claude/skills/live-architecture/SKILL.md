---
name: live-architecture
description: How the Live part of uefaresults.com must be structured so the work is done once and reused - by the website now and by mobile apps later - and so the live data provider (API-Sports today) can be replaced with small changes. Use this whenever you design, write, change or review Live code on either side - a Worker endpoint under /live, the provider adapter, caching, the data model or JSON shape, the Live API document, the web modules in public/js/live, follows or match notifications - and whenever the owner mentions a mobile app, reusing code, clean code for Live, changing or adding a data provider, or asks where a piece of Live logic should go. Read it before creating any new Live file.
---

# Live: build once, for web and mobile, with a replaceable provider

The owner's goal: the Live part is written cleanly, once. A mobile app will
come later and must not repeat the work. The data provider may change one day
and that must be a small job.

Three ideas carry all of it:

1. **The server does the thinking.** Anything that would otherwise be written
   once for the website and again for each app lives in our API.
2. **Our own data shape.** The API speaks in our words, never the provider's.
   The provider is hidden behind one folder.
3. **A written contract.** `docs/live-api.md` describes the API so well that
   someone could build a mobile screen from it without reading the web code.

Use this together with `live-section-quality` (how good it must be) and
`no-regressions` (do not break what exists).

Progress is tracked in `docs/live-plan.md`: read it before starting, and tick
a step in the same change that finishes and checks it.

## What gets reused by a mobile app

Be honest about this when planning: a native or Flutter app cannot run the
website's JavaScript. What it reuses is everything on the server and
everything written down.

| Piece | Reused by mobile | How we make that true |
| --- | --- | --- |
| Fetching, caching, the request budget | Yes, as is | It is all in the Worker |
| Turning provider data into ours | Yes, as is | Provider adapter in the Worker |
| Match states, ordering, grouping | Yes, as is | The server sends ready-to-show data |
| Refresh timing | Yes, as is | The server tells each client when to ask again |
| Goal and match alerts, follows | Yes, as is | Detected and stored on the server |
| Texts and translations | Yes, copied by a script | Kept as pure data with `live_` keys |
| Colours and sizes | Yes, copied | Named in one place |
| Screen behaviour rules | Yes, as a spec | Written in the contract document |
| Web drawing code (DOM, CSS) | No | Kept thin, so little is lost |

So the more a piece of logic matters, the further it belongs toward the
server. If you catch yourself writing a rule in the browser that the app would
need too (which match comes first, what "live" means, when to refresh, how a
score with penalties reads), stop and move it into the API response.

## Rule 1: the server does the thinking

- **Send data ready to show.** Lists arrive already filtered, grouped and in
  display order. Clients may re-sort for a user's choice; they never need to
  know the default rules.
- **Work out the viewer's day on the server.** The opening screen is "the
  matches of my current day". The client sends its date and time zone; the
  server decides which matches fall inside that day. Every client then shows
  the same list, and none of them carries date arithmetic.
- **Send meaning, not raw codes.** One `phase` value per match from our own
  short list, plus period and minute. Clients map a phase to a word in their
  language. They never see or interpret provider codes.
- **Send the timing.** Every response says when it was updated and after how
  many seconds to ask again. Clients obey that number. Then a refresh rate can
  change on the server without a website release or, far slower, an app-store
  release.
- **Keep user choices on the server.** What a signed-in user follows (teams,
  matches, competitions) is stored by our API, so it is the same on the
  website and the app. The device may keep a copy for speed, never the only
  one.
- **Detect events on the server.** A goal is found by comparing two live
  answers in the Worker. Delivery is a separate, swappable step: the existing
  notification stream now, browser push or phone push later. Detection is
  written once.

## Rule 2: our own data shape, provider behind one door

**The shape.** `docs/live-api.md` is the source of truth for every field. Its
core rules:

- Names are ours and plain: `competition`, `match`, `team`, `standing`,
  `event`. No provider field names, no provider codes, no provider URLs
  assembled by a client.
- **Ids are opaque text.** Clients store and send them back unchanged and
  never take them apart. Competitions use our own keys (`champions-league`),
  because they sit in addresses and menus and must survive a provider change.
- Times are ISO 8601 in UTC. Clients turn them into local time.
- Data carries no language. Statuses are values, not words. Proper names
  (clubs, competitions) come as the provider gives them.
- Logos are complete URLs chosen by the server.

**The door.** Only one folder knows the provider exists:

```
routes_endpoints/live/
  routes.js          HTTP in, JSON out. Checks parameters. No provider words.
  service.js         What to fetch, cache times, budget guard, comparing answers
  model.js           Our shapes: builders and checks for match, standing, event
  competitions.js    Our competition keys, names, order, and each provider's reference
  providers/
    index.js         Picks the provider named in env.LIVE_PROVIDER
    api-sports/
      client.js      Host, key header, reading the rate-limit headers
      map.js         Provider JSON -> our model. The status table lives here
      samples/       Saved provider answers used by tests
```

Every provider folder exports the same few functions and each returns **our
model**, for example:

```js
// providers/<name>/index.js
export async function getStandings(env, { competition, season }) { /* -> Standings */ }
export async function getLiveMatches(env) { /* -> Match[] */ }
export async function getMatchesByDate(env, { date }) { /* -> Match[] */ }
export async function getCompetitionMatches(env, { competition, season }) { /* -> Match[] */ }
export async function getQuota(env) { /* -> { limitPerDay, remainingToday } */ }
```

Keep that list short. Add a function only when a screen needs it.

**What "changing the provider is a small job" means.** When it happens, the
work should be exactly this and nothing else:

1. A new folder under `providers/` with the same functions.
2. The new provider's references added in `competitions.js`.
3. A new secret for its key and `LIVE_PROVIDER` switched (dev first).
4. The cache times and budget table reviewed for the new plan.

No change in `routes.js`, in `docs/live-api.md`, in the website or in any app.
If a provider swap would need more than that, the design has leaked: fix the
leak now, while there is one provider and it is cheap.

Known cost to accept: team and match ids differ between providers. Because
clients treat ids as opaque, only stored follows need translating, on the
server, in one migration.

**Leaks to watch for.** They are easy to add and expensive later:

- A provider status code (`"1H"`, `"FT"`) reaching a client.
- A provider id used as a number in a URL or in web code (`league=39`).
- A season rule (when a season starts) written in the client.
- A field passed through "because the provider had it" without being in the
  contract.
- The provider's name in a file, variable, route or comment outside its
  folder. `npm run check` fails on this for Live code.

## Rule 3: a contract that outlives the website

- **Address:** everything Live is under `/live/v1/`. Reads are `GET` so they
  can be cached; the older endpoints of this API use `POST` for reads, do not
  copy that here.
- **Envelope:** the same as the rest of the API, plus `meta`:
  `{ "success": true, "data": ..., "meta": { "updatedAt", "refreshAfterSeconds", "stale" } }`.
  Errors: `{ "success": false, "error": "a_stable_code" }`. Clients translate
  the code; the API never sends sentences to show.
- **Old apps keep working.** A phone may run a year-old version of the app.
  Inside `v1` only add: new optional fields, new endpoints. Never remove,
  rename or change the meaning of a field. A breaking change means `/live/v2/`
  next to `v1`, not instead of it.
- **Unknown values are normal.** Every client must show something sensible for
  a phase or event type it has never seen (fall back to the kick-off time or a
  neutral label). That is what lets us add a value without breaking old apps.
  Write this into each client from the first version, including the website.
- **Nothing web-only.** No cookies, no reliance on the `Origin` header as
  protection (apps send none; the Worker already lets such requests through),
  no HTML in responses, no assumption of `localStorage`.
- **Sign-in is the existing token** (`Authorization: Bearer`). Public Live
  data needs no token. Only personal things (follows, alerts) do.
- **Update the document in the same change as the code.** A field that is not
  in `docs/live-api.md` does not exist. Each endpoint has one example response
  there, copied from a real answer on dev.

## The website side

New Live web code goes in its own folder, in layers that only look downward:

```
public/js/live/
  api.js       The only file that knows Live addresses. Returns our model
  store.js     State, refresh timer, comparing old and new. No DOM
  format.js    Small pure helpers: local time, phase -> text key, score text
  views/       DOM only: matchRow.js, standingsTable.js, picker.js ...
```

- `views` read from `store`; `store` calls `api`; nothing calls upward.
- `api.js`, `store.js` and `format.js` touch no DOM and no CSS. That keeps
  them testable, and they double as the exact behaviour reference for whoever
  writes the same thing in the app's language.
- The existing `public/js/modules/liveData.js` is the widget version. Do not
  grow it. Each tab moves to the new folder when it is rebuilt, and that tab's
  widget code is deleted in the same change.
- New Live texts get keys starting with `live_` in
  `public/js/shared/langMap.js`. That file is pure data on purpose; a mobile
  app can take its texts from it with a small export script.
- New Live styles live in their own file with their colours and sizes named
  once on the Live container (see the design reference in
  `live-section-quality`). Named values are what a mobile theme copies.

## Clean code, here

- **One job per file, named for the job.** If describing a file needs "and",
  split it.
- **Pure where possible.** Mapping, ordering, comparing and formatting are
  functions of their inputs: no fetch, no clock read inside (pass the time
  in), no DOM. They are the parts worth testing and the parts worth porting.
- **Test what protects the two promises.** With Node's built-in runner
  (`node --test`, no new dependency): the provider mapping against saved
  sample answers, the status table, the ordering, the goal detection. A second
  provider must pass the same tests on the model.
- **No leftovers.** No commented-out code, no unused exports, no "temporary"
  workaround without a note saying when it goes.
- **Comments say why,** not what. Write "-" and never a long dash.
- **Follow the house style** already in the Worker: plain ES modules, no
  framework, no build step, `jsonResponse` and `handleCorsHeaders` from
  `utils/helper.js`.

## Before you say a Live piece is done

1. Is every rule the app would also need on the server, not in the browser?
2. Does the response contain only our names and values? Search the new code
   for the provider's name: it appears only under `providers/`.
3. Could the provider be swapped by doing only the four steps above?
4. Is `docs/live-api.md` updated, with a real example, and is the change
   additive?
5. Does the client cope with an unknown phase, a missing optional field, and
   `stale: true`?
6. Do `store.js`, `format.js` and `api.js` run without a DOM?
7. Are the mapping and ordering covered by a test with a saved sample?
8. Then the `live-section-quality` checklist and the `no-regressions` checks,
   including `npm run check`.
