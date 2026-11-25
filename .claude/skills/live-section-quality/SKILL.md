---
name: live-section-quality
description: The quality bar for the Live section of uefaresults.com (live scores, fixtures, results, standings) as it moves from the API-Sports widgets to our own API endpoints and our own front end. Use this whenever you plan, design, build, review or change anything in the Live section or its data - the All / Standings / Matches tabs, liveData.js, live-data.css, a Worker endpoint that calls API-Sports, caching or polling of scores, request limits, loading and error states, or how a match row, a table, the day switcher or a league picker looks and behaves on phones, tablets and desktop. Also use it when the owner asks for the best usability, performance, modern design, responsive layout for any device, accessibility or "reachability" of live data, even if the request names only one small part.
---

# Live section: the quality bar

The owner's goal for everything built in the Live section, in their words: the
best usability, the best performance (where it depends on us), the latest and
best design for live data, reachability, and the other main things. This skill
turns that into things you can check. Read it before you design or write
anything for Live, and go through "Definition of done" before you say a piece
is finished.

Existing screens must keep working while Live is rebuilt, and Live must be
built once for the website and future mobile apps. Use the `no-regressions`
and `live-architecture` skills together with this one.

## The plan

`docs/live-plan.md` lists every stage of the rebuild with what is done and
what is left. Read it before starting Live work so you pick up at the right
step. When a step is finished and checked, tick it in the same change, and
update the "Where we are" table, the date and the change log. Do not tick a
step that was only written and not checked. If the work shows the plan is
wrong or incomplete, change the plan and tell the owner what changed.

## Where things stand

- **Today:** the three Live tabs (All, Standings, Matches) are drawn by
  `<api-sports-widget>` elements from API-Sports. Our code is
  `public/js/modules/liveData.js` and `public/css/components/live-data.css`.
  Much of that code fights the widget: it removes columns, re-translates
  button labels on a timer, and overrides widget CSS. The widget key sits in
  the browser.
- **Target:** our API Worker calls API-Sports, keeps the key as a secret,
  caches the answers and returns small JSON. Our own front end draws it. The
  widget and the workaround code go away tab by tab. The order of the
  pieces is in `docs/live-plan.md`; the day view comes first.
- **Routes stay:** `live`, `live-standings`, `live-matches` (public, under
  `/{lang}/`). Do not rename them; Google and users have these addresses.
- **Order of leagues stays:** Champions League first and selected by default,
  World Cup right before EURO. The owner asked for this.
- **Opening Live shows the current day** (owner, 2026-11-25): the viewer's own
  day, with a way to move to the days before and after, and the selected
  day's matches listed: those in play and those that ended. Matches of that
  day that have not started are listed too, with their kick-off time, since a
  future day has nothing else.
- **It must fit every device and every phone** (owner, 2026-11-25). See
  section 5.

## 1. Start from the request budget

API-Sports allows a fixed number of calls per day. The site is on the Pro plan:
7,500 requests a day and 300 a minute (read on 2026-11-25). The whole design
hangs on that number.

Read `references/request-budget.md` before adding or re-timing any call. It
holds the budget table (about half the daily limit at its ceiling), the guard
that slows refreshing when the day's calls run high, and what to do with the
key once the widgets are gone.

- Every new kind of data gets a line in that budget before it is built.
- The number of visitors must not change the number of calls to API-Sports.
  One visitor or ten thousand, the Worker makes the same calls. If a design
  needs "one upstream call per visitor", it is the wrong design.
- Calls made per match are the dangerous kind. Fetch match detail only when a
  visitor opens that match.

## 2. How data travels

Where each piece of code goes, the shape of the JSON and how the provider is
kept replaceable are in the `live-architecture` skill. Read it before creating
any Live file. This section is about freshness and safety.

```
browser  ->  our API Worker  ->  cache (hit: answer now)
                             ->  API-Sports (miss or stale: fetch, trim, store)
```

- **The browser never calls API-Sports.** The key lives only in the Worker as
  a secret (`wrangler secret put`, once per environment: dev and production).
- **Trim on the server.** Send the browser only the fields the screen shows.
  API-Sports answers are large; a standings table needs rank, team id, name,
  logo, played, won, drawn, lost, goals and points, nothing else.
- **Cache by how fast the data changes:**

  | Data | Fresh for | Notes |
  | --- | --- | --- |
  | Live scores (a match is on) | 15 s | Only while at least one match is live |
  | Today's matches, nothing live | 10 min | |
  | Fixtures and results of a league | 60 min | |
  | Standings | 30 min | |
  | Finished matches, past rounds | 24 h or more | They do not change |
  | League list, seasons | days | Or keep them in our own code |

  These are the times in the budget; change both places together.

- **Serve stale while refreshing.** If the cached copy is old, answer with it
  at once and refresh in the background (`ctx.waitUntil`). Nobody should wait
  on API-Sports unless there is nothing cached at all.
- **If API-Sports fails or the limit is hit, keep serving the last good copy**
  and say how old it is. An old table is far better than an error.
- **Only known leagues and seasons.** Accept only league ids from our own
  menu. Otherwise anyone can burn the daily limit by asking for random ids.
  Rate-limit per visitor as the other endpoints do (`utils/rateLimit.js`).
- **Count upstream calls** (per day, per kind) somewhere we can read, so we
  see the budget being used before it runs out.
- Check the current API-Sports documentation for endpoint names, parameters,
  rate-limit headers and their rules on showing logos, instead of trusting
  memory. Check Cloudflare's documentation for the cache you pick (Cache API,
  KV or D1): each has different limits and costs.
- New endpoints follow the existing ones: routed in `worker.js`, CORS through
  `handleCorsHeaders`, JSON through `jsonResponse`, deployed to the dev Worker
  first (`npm run deploy:api:dev`).

## 3. Usability

The visitor came to see a score or a table. Everything else is in the way.

- **The answer is on screen at once.** Open Live and the current day's
  matches are there, live ones first. Open Standings and the default league's
  table is there. No extra tap to see data.
- **Days are one tap apart.** A day switcher moves to the day before and the
  day after, names Today clearly, and always offers a quick way back to it.
  The selected day is in the address, so Back and shared links work.
- **Remember the last choice** (league, tab) on this device and offer it next
  time. The default for a first visit stays Champions League.
- **Every state is designed, not left over:** first load, loading a different
  league, data shown, nothing to show ("No matches today" plus the next match
  day), data that is old, and failure with a Retry button. Never a blank area,
  never a spinner that can spin forever.
- **Times in the visitor's own time zone**, formatted with `Intl` in the
  current language. Day labels (Today, Tomorrow, Yesterday) are translated.
- **A match always says what state it is in:** kick-off time, live minute,
  half-time, full-time, extra time, penalties, postponed, cancelled. Use the
  provider's status codes; do not guess from the clock.
- **Address = state.** Tab and league are in the URL where the routes allow
  it, the Back button goes where the visitor expects, a shared link opens the
  same view.
- **Updates never move things under the finger.** A refresh changes numbers in
  place. It does not rebuild the list, reset the scroll or close an open menu.
- **Phones first.** Most visitors are on phones. Design at 360-430 px wide
  first, then widen (section 5). The owner has already asked for these, so
  keep them:
  long club names stay on one line (cut with "..." if needed), the rank never
  overlaps the club logo, numbers sit centred under their column headers.
- **Words a fan uses.** "Played", "Goal difference", "Half-time". No provider
  field names, no codes without a label or tooltip.

## 4. Performance (the part that depends on us)

We do not control API-Sports' speed or the visitor's network. We control how
often we ask, how much we send and how we draw. Hold these:

- **Repeat visit:** the last known data is drawn straight away from a copy
  kept on the device, then replaced when fresh data arrives. First visit: a
  skeleton in the final layout within the first frame, data as soon as one
  request returns.
- **One request per view.** A tab needs one call to our API, not a chain.
- **No layout shift.** Rows, logos and tables reserve their size before data
  and images arrive (`width`/`height` on images, fixed row heights). Aim for
  a layout shift score of 0 on the Live screens.
- **Refresh only what is live, only while it is looked at.** Poll only when a
  match is in play, pause when the tab or the screen is hidden
  (`visibilitychange`), resume with one immediate refresh. No polling for
  standings or finished matches. Stop timers when leaving Live.
- **Change the page in place.** Compare by match or team id and touch only the
  cells that changed. No `innerHTML` of the whole list on every refresh.
- **Keep the home page light.** Live code should load when Live opens. If you
  add or remove a module import, run `npm run preloads` so the preload list in
  `index.html` matches.
- **No new libraries, frameworks, web fonts or build step.** The site is plain
  JS modules and CSS, and the owner has ruled out bundling. A few hundred
  lines of our own code beat a dependency here.
- **Logos:** small, lazy (`loading="lazy" decoding="async"`), sized. Never let
  thirty logos block the table.
- **Measure, do not assume.** Before calling it fast, look at the network and
  performance panels on the dev site with a throttled phone profile, and
  compare with the widget version: requests, bytes, time to data on screen.
  The `web-perf` skill covers the method.

## 5. Every device, every phone

This is an owner requirement, not a nice-to-have: every Live screen must fit
any device, from a 320 px phone to a wide desktop, in both orientations, with
touch or mouse. Read `references/responsive.md` before writing any Live markup
or CSS. It has the screens to design for, how to build fluid layouts, the day
switcher, long lists on weak phones, tables, and the sizes to check.

The test, at every width from 320 px up:

- the page never scrolls sideways;
- nothing overlaps, is cut off or leaves the screen;
- every control is reachable and at least 44 by 44 px on touch;
- the same information is there at every size, rearranged if needed;
- it survives 200% zoom and the long words of Armenian.

Build the phone layout first and let it grow. Size each part by the space it
is given (container queries), put layout in CSS and never in JavaScript that
reads the screen width, and use `dvh` and the safe-area insets so phone
browser bars and notches do not hide content. Emulation is not enough for
release: ask the owner to try the dev site on a real iPhone and a real Android
phone, and say so if that has not happened.

## 6. Design

Read `references/design.md` before drawing any Live screen. It covers the look
(match rows, tables, league picker, live indicators, skeletons, motion), the
colours and sizes that fit the rest of the site, and what to avoid.

In short: a calm dark screen where the score is the loudest thing, live matches
are unmistakable, numbers line up, and every screen works with one thumb.

## 7. Reachability

Three meanings, all required.

**Everyone can use it.**
- Standings are a real `<table>` with header cells (`<th scope="col">`) and a
  name; match lists are real lists. Screen readers depend on this.
- Tabs and the league picker work from the keyboard (Tab, arrows, Enter,
  Escape) and show a clear focus ring. Tabs use the tab roles
  (`role="tablist"`, `aria-selected`).
- A goal is announced once, politely (`aria-live="polite"` on a small status
  line), not the whole list on every refresh.
- Never colour alone: "live" has a word, a win/draw/loss mark has a letter.
- Text contrast at least 4.5:1 on the dark background. Note that the site's
  default grey text (`rgb(95, 95, 95)` on the near-black page) is too dim for
  data; use the lighter text colours listed in the design reference.
- Touch targets at least 44 by 44 px. Text scales with the visitor's font
  size; nothing is cut off at 200% zoom.
- Motion respects `prefers-reduced-motion`: no pulsing or flashing for people
  who turned motion off.

**It works on any device and any connection.**
- Usable from 320 px wide up to desktop, in portrait and landscape
  (section 5).
- On a slow or dropped connection: show the last data with its age, keep the
  screen usable, retry quietly with growing pauses. Say "Offline" in words.

**It can be found and linked.**
- The Live routes stay public and keep their titles, descriptions and
  canonical links (see `public/_worker.js` and `public/index.html`). Do not
  add `noindex` to them or change their addresses.
- Do not propose server-rendered, indexable standings or fixtures pages. The
  owner said no to that on 2026-11-25.

## 8. The other main things

- **Three languages.** Every visible word goes through
  `public/js/shared/langMap.js` in English, French and Armenian. Team and
  league names come from the provider as they are. The Armenian text needs
  the owner's eye; say so when you add any.
- **Write "-" and never a long dash** in text, comments and commit messages.
- **Safety.** No key, token or secret in `public/`. No visitor data sent to
  the provider. Escape provider text before putting it in the page
  (`textContent`, not `innerHTML`): team names are outside data.
- **Honest numbers.** If data is older than its "fresh for" time, show
  "Updated 3 min ago" rather than pretending it is live.
- **One part at a time.** Replace one tab, prove it on the dev site, keep the
  widget for the other tabs until their turn. Remove the old workaround code
  for a tab only when its replacement is live, in the same change.
- **Dev first.** Build on the `dev` branch, test on
  https://dev.uefatable.pages.dev with the dev API. Ask before pushing to
  `main` and before deploying the production Worker.

## Definition of done

Go through this for every Live piece before saying it is finished. Report each
line you could not check, with the reason.

1. **Budget:** every call this piece makes has a line in
   `references/request-budget.md`, and the total still fits the daily limit.
2. **Data path:** no API-Sports key or call in the browser; unknown league ids
   are refused; a cached answer is served when the provider is down.
3. **States:** loading, data, empty, old data and failure each look right.
4. **Every device:** checked at 320, 360, 390, 430, 600, 768, 1024, 1280, 1440
   and 1920 px, a phone in landscape, and 200% zoom; no sideways page scroll
   at any of them. Whether the owner tried it on real phones.
5. **Languages:** English, French and Armenian, including the empty and error
   texts and the day labels.
6. **Keyboard and screen reader basics:** tabs and picker reachable, table
   headers present, focus visible, reduced motion respected.
7. **Speed:** one request per view, no layout shift, polling stops when the
   tab is hidden and when nothing is live. Numbers compared with the widget.
8. **Nothing else broke:** run the `no-regressions` skill's checks, including
   `npm run check` and the custom-league tables that share styles with Live.
