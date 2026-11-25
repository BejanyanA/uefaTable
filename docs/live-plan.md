# Live rebuild: plan and progress

One place to see what is done and what is left for the new Live section:
our own API and our own screens instead of the API-Sports widgets, built so a
mobile app can reuse it and the data provider can be changed later.

**How to read it:** `[x]` done, `[ ]` not done. "Owner" means only you can do
or approve it. Every step is first done on dev
(https://dev.uefatable.pages.dev); production steps are listed separately and
each needs your yes.

**Last updated:** 2026-11-25

## Where we are

| Stage | What | State |
| --- | --- | --- |
| 0 | Preparation | Done |
| 1 | Day view: the opening screen (current day, switch days, live and finished matches) | **Next** |
| 2 | Standings tab | Not started |
| 3 | Matches tab (fixtures and results per league) | Not started |
| 4 | Match details (goals, cards, line-ups) | Not started |
| 5 | Remove the widgets, new key | Not started |
| 6 | Follows and in-site alerts | Not started, optional |
| 7 | Phone and browser push | Not started, optional |
| 8 | Mobile app | Later |

The website keeps the widget for each tab until that tab's replacement is
live, so nothing is missing for visitors in between.

## Stage 0: preparation (done)

- [x] Dev environment: dev site, dev API (`uefa-app-dev`), dev database
      (`core-db-dev`) with a copy of production data
- [x] Site picks its API by address; analytics only on production
- [x] Seven missing database indexes, on dev and production
- [x] `npm run check`: automatic "is anything broken" test, passes on dev and
      production
- [x] Skill `live-section-quality`: usability, performance, design,
      reachability
- [x] Skill `no-regressions`: how not to break existing parts
- [x] Skill `live-architecture`: build once for web and mobile, replaceable
      provider
- [x] API-Sports plan read: Pro, 7,500 requests a day, 300 a minute
- [x] Request budget written: about half the daily limit at its ceiling
- [x] Draft API contract: `docs/live-api.md`
- [x] Notifications checked: the provider sends none; the live call includes
      goals, so we can make our own

## Decisions already made

- Routes stay: `live`, `live-standings`, `live-matches`.
- League order stays: Champions League first, World Cup right before EURO.
- Three languages for every text: English, French, Armenian.
- No bundler, no framework, no new libraries.
- No server-rendered, indexable standings or fixtures pages.
- **Opening Live shows the current day** (the viewer's own day), with a
  switch to the days before and after. The selected day lists its matches in
  play and its finished ones; matches of that day not started yet are listed
  too, with their kick-off time. (2026-11-25)
- **Every screen fits any device and any phone**, from 320 px wide to a wide
  desktop, portrait and landscape. (2026-11-25)
- The viewer's day is worked out on the server from their date and time zone;
  data is fetched once per calendar date for everyone.
- The server sends ready-to-show data; clients only draw.
- Only `routes_endpoints/live/providers/` knows the provider.

## Open questions

- [ ] **Owner:** read API-Sports' terms on storing their data on our server
      and showing it through our own API. I could not open their site (it
      blocks automated readers).
- [ ] **Owner:** which technology for the mobile app (Flutter, native, other)?
      Not needed to start; it only matters at stage 8.
- [ ] **Owner:** should the day view list every competition in the world (as
      the widget does today, ours shown first) or only the competitions in our
      menus?
- [ ] Where the cached answers live (Cloudflare Cache, KV or D1). Decided at
      the start of stage 1 after reading Cloudflare's current limits.
- [x] How "today" is chosen for a visitor's time zone: on the server, from
      the viewer's date and time zone (see "Decisions").

## Stage 1: day view, the opening screen (next)

Opening Live shows the current day; the visitor can move to the days before
and after. This stage also lays the groundwork every later stage reuses.

**API (dev)**
- [ ] Provider key stored as a secret on the dev API
- [ ] Our competition list: our keys, names, order, provider references
- [ ] Provider folder: fetch the matches of a date and the matches in play,
      turn them into our shape (states, scores, goals and cards)
- [ ] Saved sample answers and tests for that mapping (`npm test`)
- [ ] Cache per calendar date with "serve the old copy while refreshing"
- [ ] The viewer's day cut out on the server from date and time zone
- [ ] Day range limited (a week back, a week ahead)
- [ ] Daily request counter and the budget guard
- [ ] `GET /live/v1/competitions`
- [ ] `GET /live/v1/matches?date=&tz=` and `GET /live/v1/matches/live`
- [ ] Bad dates and time zones are refused
- [ ] `docs/live-api.md` updated with real example answers
- [ ] Deployed to the dev API

**Website (dev)**
- [ ] New folder `public/js/live/`: `api.js`, `store.js`, `format.js`
- [ ] Match row and competition group views
- [ ] Day switcher: Today named, previous and next, days around it, a way to
      jump further; the day is in the address
- [ ] Refresh only while a match is in play and the screen is visible; score
      changes update in place with a short highlight
- [ ] Styles in their own file, colours and sizes named once
- [ ] All states: loading, data, no matches that day, old data, failure with
      Retry
- [ ] Texts in three languages (`live_` keys), day names included
- [ ] The first Live tab uses the new code; its widget code is deleted
- [ ] `npm run preloads` after the module changes

**Checks**
- [ ] Every device: 320 to 1920 px, a phone in landscape, 200% zoom, no
      sideways page scroll (`live-section-quality`, section 5)
- [ ] The rest of the `live-section-quality` checklist, three languages
- [ ] `live-architecture` checklist, including "no provider words outside its
      folder"
- [ ] `no-regressions` checks: `npm run check`, custom-league tables still
      right, the other two Live tabs still work
- [ ] Requests, size and time to data compared with the widget version; the
      day's request count looked at

**Release**
- [ ] **Owner:** try the day view on the dev site, on a real iPhone and a real
      Android phone
- [ ] **Owner says yes:** provider key as a secret on the production API
- [ ] **Owner says yes:** deploy the production API
- [ ] **Owner says yes:** merge to `main` (production site)
- [ ] `npm run check -- https://uefaresults.com` and a look at the real page

## Stage 2: Standings tab

- [ ] `GET /live/v1/competitions/{key}/standings`, shape as in
      `docs/live-api.md`
- [ ] Standings table and league picker views
- [ ] Group tables (Champions League, World Cup, EURO) as well as leagues
- [ ] Widget code for this tab deleted
- [ ] Checks and release as in stage 1, plus the custom-league tables, which
      share table styles

## Stage 3: Matches tab

- [ ] `GET /live/v1/competitions/{key}/matches`, grouped by round
- [ ] Round list view, reusing the match row from stage 1
- [ ] League menu with the 23 competitions in the current order
- [ ] Widget code for this tab deleted
- [ ] Checks and release as in stage 1

## Stage 4: Match details

- [ ] `GET /live/v1/matches/{id}`: goals, cards, substitutions
- [ ] Line-ups and statistics, if the request budget allows (a new line in
      the budget first)
- [ ] Match pop-up or page view
- [ ] Checks and release as in stage 1

## Stage 5: remove the widgets, new key

- [ ] No widget script, widget styles or workaround code left on the site
- [ ] `liveData.js` and `live-data.css` reduced to what is still needed, or
      deleted
- [ ] **Owner:** create a new key in the API-Sports dashboard (the current one
      has been public in the site's code)
- [ ] New key stored only as a secret on the dev and production APIs

## Stage 6: follows and in-site alerts (optional)

- [ ] Follow a team, a match or a competition; stored on the server
- [ ] Goal, kick-off and full-time detected in the API from the live answers
- [ ] Alerts on the existing notification bell for signed-in users

## Stage 7: phone and browser push (optional)

- [ ] Background script on the site, permission prompt, stored subscriptions
- [ ] Scheduled job in the API so alerts work with nobody on the site
- [ ] iPhone: works only after "Add to Home Screen"

## Stage 8: mobile app (later)

- [ ] Texts exported from the website's translation file for the app
- [ ] Colours and sizes exported for the app's theme
- [ ] App screens built against `docs/live-api.md`
- [ ] Phone push for the app (reuses stage 6 detection)

## Not Live, but still open

- [ ] **Owner says yes:** merge `dev` into `main`. Until then production does
      not have: the dev environment setup, the analytics guard, the skills,
      `npm run check`. (The database indexes are already on production.)
- [ ] Two Armenian pages still need "Request indexing" in Search Console:
      `/am/champions-league-tournament/` and `/am/tournament-bracket-maker/`
- [ ] **Owner, optional:** fix the Villarreal row in the production standings
      (goals against and goal difference are empty)
- [ ] **Owner:** post the listings, read the Armenian texts, fill the GitHub
      "About" fields

## Change log

- 2026-11-25: plan created. Stage 0 done.
- 2026-11-25: the day view becomes stage 1 and the opening screen (owner).
  Standings moves to stage 2, the Matches tab to stage 3. "Every device" added
  to the decisions and the checks.
