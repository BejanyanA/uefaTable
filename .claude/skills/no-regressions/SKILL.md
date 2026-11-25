---
name: no-regressions
description: How to change uefaresults.com without breaking what already works. Use this before and after ANY change to this project - a CSS tweak, a new screen, a text or translation change, a route, an API endpoint, a database change, a deploy - and always before saying a change is done or asking to push. It maps the parts that are shared or fragile (tables used by both Live and custom leagues, three languages, the route list, server-side translation, SEO pages, browser caching, the separate API Worker and database) and gives the checks to run (`npm run check`, plus the screens and screen widths to look at). Use it even when the change looks tiny - most breakages in this project came from small CSS or HTML edits.
---

# Do not break what works

uefaresults.com is live and people use it. A change is only finished when the
thing you changed works AND everything around it still does. This skill is the
routine for that: look before you change, change narrowly, check widely, and
say plainly what you did not check.

## Why this exists

Each of these really happened in this project. They show where it is fragile.

- A CSS fix for the Live standings header would also have moved the numbers in
  the custom-league tables, because both use the same table styles.
- A desktop alignment fix made long club names wrap and let the rank overlap
  the club logo on small phones.
- New HTML went out with a changed stylesheet, but browsers still had the old
  stylesheet: competition titles overlapped the trophies.
- Unknown addresses answered "200 OK" with the app shell, so Google reported
  dozens of soft 404s.
- Logging in from the Live screen and going Home showed a home page without
  its Live and Custom Leagues banners.
- Opening the Achievements address directly threw an error, though it worked
  when reached by clicking.
- On /fr and /am the page painted in the wrong order on first load.
- A NULL in one standings row stayed NULL forever, because updates add to the
  old value (`column + ?`) and NULL plus anything is NULL.

The pattern: something is shared, has more than one way in, or has more than
one version (language, screen size, logged in or out), and only one was looked
at.

## Step 1: before you change anything

1. **Find who else uses it.** Search the whole repo for the class, id,
   function, translation key or route you are about to touch
   (`public/`, `worker.js`, `routes_endpoints/`, `utils/`). A class in one CSS
   file is often used by markup that another module builds.
2. **Decide which side you are on.** The site (`public/`, deployed by pushing
   a branch), the API Worker (`worker.js` and friends, deployed separately) or
   the database (changed by hand). A feature often needs two of them, and they
   do not ship together.
3. **Look at the screen first** on the dev site or locally, so you know what
   "still works" looks like before you edit. Screenshots at a phone width and
   a desktop width are enough.
4. **Check the map below** for the area you are touching.

## Step 2: the map of shared and fragile parts

| If you touch | It also affects | So check |
| --- | --- | --- |
| `standings.css`, `.standings-table` | Live tables AND custom-league tables | Both, at phone and desktop widths. Scope a Live-only fix to the Live container |
| `matches.css`, `knockouts.css`, `stage.css`, `instances.css` | Every custom-league format - Champions League, Europa League, EURO, World Cup; club and national; group stage and knockout-only | At least one club league and one national league, group and knockout views |
| Any CSS with a `@media` rule | The other side of that width | Each side of every breakpoint you edit (480 px is the common one) |
| `public/index.html` | First paint, the preload list, the pre-paint `not-home-route` script, server-side translation | Home in en, fr and am on a cold load; `npm run preloads:check` |
| HTML together with a CSS or JS file | Visitors whose browser still has the old file | Change the file's address (`?v=N` in the `<link>` or `<script>`) |
| Any visible text | Three languages; some text is also translated on the server | Keys in `public/js/shared/langMap.js` for en, fr, am; `SHELL_TEXT` and `LOCALIZED_HOME` in `public/_worker.js` if it is on the home shell |
| Routes or screens | `public/js/shared/appRoutes.js` (one list for the browser and the Pages worker), `router.js`, `_routes.json`, noindex on private routes | Open the address directly AND reach it by clicking; an unknown address still returns 404 |
| Module imports (add, remove, rename a file in `public/js`) | The preload list in `index.html` | `npm run preloads` |
| Titles, descriptions, canonical, hreflang, structured data, `sitemap.xml`, `robots.txt`, the landing pages | Google indexing, which took real work to fix | View source in all three languages; do not change addresses that are indexed |
| Login, logout, anything that depends on who is signed in | The same screen for a visitor, a signed-in user, and right after signing in | All three, including going Home from another screen after login |
| `public/js/services/config.js`, `utils/helper.js` (allowed origins) | Which API each site talks to, and who the API accepts | Dev site talks to the dev API; production accepts only production |
| API endpoints | Every caller in `public/js`; the dev and production Workers are separate | Deploy to dev first (`npm run deploy:api:dev`); never change a response's shape without updating its callers in the same change |
| Database tables, columns, indexes | Both databases, `db/schema.sql`, every query on that table | A numbered file in `db/migrations/`, run on dev first, then production with the owner's yes |
| Scores and standings writes | Totals are updated by adding to the old value | New columns need `DEFAULT 0` or `COALESCE`; never leave a NULL where a number is added |
| The Live widget code in `liveData.js` | Fragile workarounds around a third-party widget (column removal, re-translation timers) | All three Live tabs in three languages after any edit there |

When the change is in the Live section, also follow `live-section-quality`
and `live-architecture`. Once a Live endpoint is released, its JSON is a
promise to old app versions: add fields, never remove or rename them
(`docs/live-api.md`).

## Step 3: while you change

- **Change the narrowest thing that fixes it.** Prefer a rule scoped to the
  screen you mean over editing a shared rule. If you must edit a shared rule,
  list everything that uses it and check each one.
- **Do not tidy on the way.** Renaming, reformatting or "cleaning up" nearby
  code in the same change hides the real change and breaks things nobody asked
  to touch. Suggest it separately.
- **Keep addresses, ids and translation keys stable.** Other code, Google and
  users' bookmarks point at them. Add new ones rather than repurposing.
- **Follow the owner's standing rules:** write "-" and never a long dash; no
  captions under screenshots; no bundler or framework; the owner's name
  appears only in the footer.
- **One environment at a time.** Work on the `dev` branch. The dev database
  holds a copy of real users' data: do not print rows, and do not test with
  other people's accounts.

## Step 4: check before you say it is done

Run the automatic check, then look with your own eyes. The script catches what
is mechanical; it cannot see a layout.

```bash
npm run check
```

That runs the code checks and requests the dev site and dev API. Variants:
`npm run check -- http://localhost:8788` for a local site started with
`npm run dev:site`, `npm run check -- --local` for code checks only, and
`npm run check -- https://uefaresults.com` to confirm production after a
release (read-only requests). A failed line is a real problem: fix it, do not
explain it away.

Then, in a browser, for every screen the change could reach:

1. **Widths:** 320, 360, 390, 430, 768, 1100 and 1400 px, and a phone in
   landscape. The owner requires every screen to fit any device and any
   phone: no sideways page scroll, nothing overlapping or cut off. If you
   edited a breakpoint, both sides of it. Check the element you changed is the visible
   one at that width (the desktop and phone versions of a table are separate
   elements; measuring the hidden one gives zeros).
2. **Languages:** English, French (`/fr/...`) and Armenian (`/am/...`).
   Armenian words are long and break layouts first.
3. **Signed out and signed in**, when the screen differs. You cannot type the
   owner's password: ask them to sign in in the browser, or check what you can
   and say what was left.
4. **Both ways in:** open the address directly (cold load) and reach it by
   clicking from Home.
5. **The neighbours from the map:** for a table change, a Live table and a
   custom-league table; for a home change, the home banners and the first
   paint.
6. **The console:** no new errors or failed requests.

For a change to the API or the database, also call the changed endpoint on
dev and confirm that an old caller still gets what it expects.

## Step 5: ship in the safe order

1. Commit on `dev`, push `dev`. The site is on https://dev.uefatable.pages.dev
   in under a minute. API changes need `npm run deploy:api:dev`.
2. Check on the dev site (Step 4).
3. Ask the owner before each of these, every time: pushing to `main`
   (production site), deploying the production Worker, changing or reading
   rows of the production database. An earlier yes does not cover the next
   one.
4. When site and API both change, ship in the order that never leaves them
   mismatched: usually the API first, still answering the old way as well,
   then the site.
5. After production, run `npm run check -- https://uefaresults.com` and look
   at the changed screen once on the real site.

## What to tell the owner

End with what is true, in plain words: what changed, what you checked and how
(widths, languages, signed in or not), and what you did not check and why. If
`npm run check` failed or a screen looked wrong, say so with the detail. "Not
tested" is a useful sentence; a broken live site is not.
