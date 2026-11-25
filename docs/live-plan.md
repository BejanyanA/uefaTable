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
| 1 | Day view: the opening screen (current day, switch days, live and finished matches) | **On dev, waiting for you** |
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
- **The day view lists every competition of the day, ours first:** the
  competitions from our menus on top in the usual order, then all the others
  grouped by country. (2026-11-25)
- **The three tabs are always at the top of the screen while Live is open,**
  and are not shown separately in the page. Wide screens: inside the site
  header, centred over the content below, with the Back button floating at
  the left and staying there while scrolling. Narrow screens (768 px and
  less): a bar right under the header that starts with a Back arrow (no
  word); the tabs are only as wide as their words; no line under the bar.
  (2026-11-25)
- **The site header is frosted (blurred) on every screen size,** on all
  pages. (2026-11-25)
- **The day view's list is 54rem wide at most** (was 46rem). (2026-11-25)
- **One row sits against the header (on phones against the tab bar) from the
  moment Live opens and stays there:** the Live toggle first, then the days.
  On desktop the Back button is on the same line, at its left. (2026-11-26)
- **Only a Live toggle, no All.** Live is pressed when the screen opens, so
  only the matches in play show (white button, red text); a day with nothing
  in play opens with all its matches. Tapping the button switches between
  live and all, and that choice is kept while moving between days.
  (2026-11-26)
- **Days:** all fifteen (a week each way) in a strip that scrolls sideways;
  only today is named "Today", the others show their weekday. The selected
  day has light text and an underline, no outline; the others are a little
  grey. While another day is selected, "Today" and its date are light
  green. (2026-11-26)
- **Live has its own scroll position:** it always opens at its top, and the
  page you came from comes back where you left it. (2026-11-26)
- **"Updated ... ago" shows only when the API says the data is old**, not
  after a fixed number of minutes. (2026-11-26)
- **Each match is a block of its own, on desktop and phones,** in iOS's dark
  grouped cell colour (#1c1c1e) on a black page, like iPhone Settings, under
  its competition's name. (2026-11-26)
- **Phones match iOS exactly** (skill `ios-mobile-style`): system font, iOS
  colours, round glass Back button, compact Live pill, tabs centred over the
  content. (2026-11-26)
- **Live matches have a red bar at the left of their block** (and a faint
  red glow) instead of a blinking dot. **Each league heading opens and closes
  its matches** with a chevron at its end; closed, it shows live/total. The
  choice is remembered on the device. (2026-11-26)
- **Desktop: each match on one line**, `Home [crest]  2 - 0  [crest] Away`,
  score in the middle; narrow lists keep two lines. (2026-11-26)
- **One corner radius for the whole site: 12px, like the tab bar** (skill
  `corner-radius`); match blocks use it. The Live pill on phones has 14px
  text and is 36px tall; the selected Live tab's icon is red. (2026-11-26)
- **Desktop: the content keeps its width** whether the page needs a
  scrollbar or not (room for it is kept while Live is open). (2026-11-26)
- **The Live block has no outline.** (2026-11-25)
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
- [x] Which matches the day view lists: every competition, ours first (see
      "Decisions").
- [x] Where the cached answers live: in the database (D1). Cloudflare's own
      cache is separate in every location, so it would not stop provider calls
      from growing with the audience.
- [ ] **Owner:** ask API-Sports support whether calls from Cloudflare Workers
      can be counted per key. They refuse a share of them today (see the
      request budget).
- [x] How "today" is chosen for a visitor's time zone: on the server, from
      the viewer's date and time zone (see "Decisions").

## Stage 1: day view, the opening screen (on dev, waiting for you)

Opening Live shows the current day; the visitor can move to the days before
and after. This stage also laid the groundwork every later stage reuses.

**API (dev)**
- [x] Provider key stored as a secret on the dev API
- [x] Our competition list: our keys, names, order; the provider's references
      in its own folder
- [x] Provider folder: fetch the matches of a date and the matches in play,
      turn them into our shape (states, scores, goals and cards)
- [x] Saved sample answers and tests for that mapping (`npm test`, 30 tests)
- [x] Cache per calendar date with "serve the old copy while refreshing"
      (stored in the database, table `live_cache`, dev only so far)
- [x] The viewer's day cut out on the server from date and time zone
- [x] Day range limited (a week back, a week ahead)
- [x] Request count read from the provider and the budget guard
- [x] `GET /live/v1/competitions`
- [x] `GET /live/v1/matches?date=&tz=` and `GET /live/v1/matches/live`
- [x] Bad dates and time zones are refused
- [x] `docs/live-api.md` updated with real example answers
- [x] Deployed to the dev API
- [x] Extra, found on the way: the provider refuses some calls coming from
      Cloudflare; the API retries and never keeps a visitor waiting for it

**Website (dev)**
- [x] New folder `public/js/live/`: `api.js`, `store.js`, `format.js`
- [x] Match row and competition group views; our competitions first, then
      the rest by country
- [x] A busy day stays light: 15 KB answer, off-screen groups not laid out
- [x] Day switcher: Today named, previous and next, days around it, a
      calendar button to jump further; the day is in the address
- [x] Refresh only while a match is in play and the screen is visible; score
      changes update in place with a short highlight
- [x] "Live" and "All" filter with the number of matches in play
- [x] Tabs always at the top (header on desktop, own bar on phones); one
      row with the Live toggle and the days, attached from the start; Live
      keeps its own scroll position
- [x] Styles in their own file, colours and sizes named once
- [x] All states: loading, data, no matches that day, old data, failure with
      Retry
- [x] Texts in three languages (`live_` keys), day names included
- [x] The first Live tab uses the new code; its widget code is deleted
- [x] The Live code loads only when Live is opened (home page unchanged)

**Checks**
- [x] Sizes checked in the browser: 320, 360, 375, 390 px, a phone in
      landscape (740 by 360) and 1440 px; no sideways page scroll
- [ ] Sizes not yet checked: 430, 600, 768, 1024, 1280, 1920 px and 200% zoom
- [x] English, French and Armenian looked at
- [x] No provider words outside the provider folder (`npm run check`)
- [x] `npm run check` passes; Standings and Matches tabs still work; leaving
      Live stops all refreshing; home banners still there
- [x] One request for the day (15 KB), then small score requests (about 2 KB
      compressed) every 15 s; rows are updated in place
- [ ] Keyboard and screen reader pass
- [ ] Comparison with the widget version in numbers
- [ ] Custom-league tables looked at while signed in (no shared styles were
      touched, so no change is expected)

**Known gaps in this stage**
- Tapping a match does nothing yet. The widget opened a match pop-up from
  this tab; that returns with stage 4. The Matches tab still has it.
- The Armenian texts need your eye.
- Processing time on the API for a full day is 9-16 ms; fine on a paid
  Workers plan, tight on the free one. To be watched.

**Release**
- [ ] **Owner:** try the day view on the dev site, on a real iPhone and a real
      Android phone
- [ ] **Owner says yes:** create the `live_cache` table on production
      (`db/migrations/002_live_cache.sql`)
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
- 2026-11-25: the day view lists every competition, ours first (owner).
- 2026-11-25: stage 1 built on dev (API and website). Not on production.
- 2026-11-25: sticky bar with Back and the tabs; Live filter before All (owner).
- 2026-11-25: Live is the default filter; the day switcher back to its
  first look (owner).
- 2026-11-25: tabs always at the top, one row with Live / All and fifteen
  days, round buttons, no count, only Today named (owner).
- 2026-11-26: "Today" in light green while another day is selected (owner).
- 2026-11-26: football pitch picture for empty days; the header's language
  menu opens over the Back button (owner).
- 2026-11-26: Live pressed by default (owner).
- 2026-11-26: one-line match rows on desktop (owner).
- 2026-11-26: red side bar for live matches; leagues open and close with a
  live/total count (owner).
- 2026-11-26: 12px corners like the tab bar (new skill), bigger Live pill on
  phones, red icon on the selected Live tab (owner).
- 2026-11-26: black page and iOS blocks on all sizes; phones follow iOS
  exactly (new skill); tabs centred on phones (owner).
- 2026-11-26: phones get a block per match and a compact Live pill; desktop
  keeps its width when the scrollbar comes and goes (owner).
- 2026-11-26: one Live toggle (All by default), underlined day, row
  attached at open with Back on its line, own scroll for Live (owner).
- 2026-11-25: fixed a second scrollbar on the page (a hidden helper element
  of the day view was placed against the whole page). Back stays on desktop,
  Back arrow in the bar on phones, frosted header, wider list (owner).
- 2026-11-25: the sticky bar is gone again. Tabs go into the site header
  when scrolled, day switcher and filters stay fixed, Back as before, no
  outline (owner).
