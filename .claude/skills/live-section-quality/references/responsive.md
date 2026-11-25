# Responsive: every device, every phone

The owner's requirement: whatever is built must fit any device and any phone.
Not "works on my screen and roughly on a phone": every width between a small
phone and a wide desktop, both orientations, touch and mouse.

## Contents

1. What "responsive" means here
2. The screens to design for
3. How to build it
4. The day switcher
5. Long lists on small phones
6. Tables
7. How to check
8. Mistakes that already happened here

## 1. What "responsive" means here

A screen passes when, at every width from 320 px up:

- the page never scrolls sideways (a table may scroll inside its own box);
- nothing overlaps, is cut off or falls outside the screen;
- every control can be reached and tapped (at least 44 by 44 px on touch);
- the same information is available at every size. It may be rearranged or
  moved behind one clear control; it is not silently dropped. The only
  exception is secondary table columns, as section 6 describes;
- text can be made larger by the visitor (browser zoom to 200%, bigger system
  font) without breaking the layout.

Design the phone first, then let it grow. Most visitors are on phones, and a
layout that works at 360 px almost always widens well; the reverse is not
true.

## 2. The screens to design for

| Screen | Width | What matters |
| --- | --- | --- |
| Smallest phones | 320-359 px | Must not break. Tightest spacing, shortest labels |
| Phones | 360-430 px | **The main design.** One column, thumb reach |
| Large phones, small tablets | 431-767 px | Still one column; more air, not bigger text |
| Phone in landscape | about 660-930 px wide, 360-430 px tall | Very little height: sticky bars must stay small |
| Tablets | 768-1023 px | Room for two columns or a side list |
| Laptops | 1024-1439 px | Full layout |
| Desktops and wide screens | 1440 px and up | Content keeps a maximum width and is centred; do not stretch rows across the screen |

Also real: foldable phones (narrow when closed, tablet-like when open),
split-screen on tablets (a "tablet" showing a phone-width window), and any
browser window a desktop user has resized. That is why the rule is "every
width", not a list of devices.

## 3. How to build it

**Let the layout flow; do not pin it.**
- No fixed pixel widths on containers. Use flex and grid with `minmax()`,
  `auto-fit`, percentages and `max-width`.
- Sizes that should grow smoothly use `clamp(min, preferred, max)` instead of
  a jump at a breakpoint.
- Give flex and grid children `min-width: 0` so long names can shrink and show
  an ellipsis instead of pushing the layout wider. This is the usual cause of
  "the page scrolls sideways on a phone".
- Cap the content width on large screens (about 1100-1200 px) and centre it.

**Let each part adapt to the space it is given.**
- A match row or a table appears in different places (a tab, a pop-up, later
  maybe a side panel). Size it by its own container with container queries
  (`container-type: inline-size` on the wrapper, `@container` rules inside),
  not by the screen width. Then it is right wherever it is put.
- Use the screen-width breakpoints already in the code for page-level layout
  (480, 600, 768, 1100 px). Do not introduce a new set.

**Respect the device.**
- Heights: `dvh`, not `vh`. On phones the browser bars come and go and `100vh`
  is taller than what is visible. The site's body already uses `100dvh`.
- Notches and the home bar: where a bar touches a screen edge, add
  `env(safe-area-inset-*)` padding.
- Touch and mouse are different inputs, not different widths. Put hover
  effects inside `@media (hover: hover)` (the site already does this in
  places) and never make something available only on hover. Tablets with a
  mouse and laptops with touch screens both exist.
- Type in `rem`, so the visitor's font size setting is honoured. Never below
  12 px equivalent.
- In landscape on a phone the screen may be 360 px tall. Keep the total height
  of sticky things (tabs, day switcher, group header) small, or let some of
  them scroll away, so matches are still visible.

**Do not branch in JavaScript by screen size.**
- Layout belongs in CSS. Code that reads `window.innerWidth` to choose markup
  goes wrong on rotation, resize and split-screen. If two layouts need
  different markup, render one structure that CSS can rearrange.

## 4. The top of a Live screen

The owner designed this on 2026-11-25. Keep it unless they ask otherwise.

- **The three tabs (Live, Standings, Matches) are always at the top** while
  Live is open, drawn by `public/js/live/headerTabs.js`. Wide screens: inside
  the site header, centred over the content below (not over the header: a
  scrollbar shifts the content), with the Back button floating at the left
  and never hidden. Narrow screens (768 px and less): a bar of their own
  right under the header, starting with a Back arrow without a word; each tab
  is only as wide as its word; no line under the bar. The original tab and
  Back buttons stay in the page, hidden, as the source of the words and the
  actions.
- **One row sits right under them from the moment Live opens** and stays
  there while scrolling: the Live toggle first, then the days. On wide
  screens the Back button is on the same line, at its left.
- **The Live toggle** is one round button: released, every match of the day
  is shown; pressed (white, red text), only the matches in play.
- **The days are all fifteen** (a week each way) in a strip that scrolls
  sideways on its own, with the selected day brought to the middle. Only
  today is named ("Today"); every other day shows its weekday and date. The
  selected day has light text and an underline (no outline); the others are
  a little grey. On desktop there are previous and next arrows and a
  calendar button as well; on phones the strip is scrolled with a finger.
- **Live keeps its own scroll position.** The whole site scrolls on the body,
  so `liveData.js` opens Live at its top and puts the page you came from back
  where it was (`enterLiveScroll` / `leaveLiveScroll`). Check it: scroll the
  home page, open Live, scroll, go back.
- The selected day is in the address (`?date=`), so Back, reload and a shared
  link all return to it. Without a date the address means "today".
- **Anything that stays in view stops below what is fixed above it:** use
  `top: var(--lv-sticky-top)` (set on `.liveDataPage` in `live-data.css`: the
  header height, plus the tab bar's on phones), never `top: 0`, or it slides
  under the header. Check by scrolling, not only by looking at the top.
- On wide screens the day view keeps clear of the floating Back button
  (its width leaves room at the sides), so the two never overlap.
- **Never position anything against the whole page from inside a Live view.**
  The body is what scrolls on this site, and an absolutely positioned element
  without a positioned parent inside the view is placed against the page
  instead: it gave the page a second scrollbar once. `.lv` is
  `position: relative` for that reason.
- A phone on its side is the exception: with so little height the row scrolls
  away with the page.

## 5. Long lists on small phones

A busy day can have hundreds of matches. A cheap phone must stay smooth.

- Group by competition. The owner decided the order: the competitions from
  our menus first, in their usual order, then every other competition grouped
  by country.
- Do not make the browser lay out what is far off-screen: give each
  competition group `content-visibility: auto` with a size hint
  (`contain-intrinsic-size`), or add groups as the visitor scrolls.
- A refresh touches only the rows that changed.
- Sticky competition headers are one line tall.

## 6. Tables

- Standings on a phone show rank, club, played, goal difference and points
  without scrolling. Other columns either scroll sideways inside the table's
  own wrapper (with the rank and club column fixed in place) or appear from a
  width where they fit.
- Club names take the flexible space and are cut with an ellipsis; number
  columns have fixed, equal widths so they line up.
- The table header stays visible while the table scrolls.
- These rules are shared with the custom-league tables. Changing shared table
  styles means checking those too (`no-regressions`).

## 7. How to check

Emulation first, on the dev site or locally, at each of these:

| Check | Sizes |
| --- | --- |
| Phones, portrait | 320, 360, 390, 430 px wide |
| Phone, landscape | about 740 by 360 px |
| In between | 600 px |
| Tablet | 768 and 1024 px |
| Laptop and desktop | 1280, 1440 and 1920 px |
| Zoom | 200% at 1280 px (behaves like a 640 px screen) |
| Language | Armenian at 320 and 360 px: its words are the longest |

At each size look for: sideways page scroll (check
`document.documentElement.scrollWidth` against the window width), overlaps,
cut-off text, controls smaller than 44 px, sticky bars eating the screen.
Also drag the window width slowly from 320 to 1440 once: breakage often hides
between the sizes in the table.

Then the real thing. Emulation does not show the moving browser bars, the
notch, the home bar or real touch. Before a Live piece goes to production, ask
the owner to open the dev site on a real iPhone (Safari) and a real Android
phone (Chrome), and say plainly if that was not done.

## 8. Mistakes that already happened here

- A desktop alignment fix made long club names wrap on phones.
- The rank number overlapped the club logo on small screens.
- A fix measured the desktop table at a phone width, where it is hidden, and
  got zeros. Check the element that is actually visible at that width.
- Numbers were not centred under their headers at some widths.

Each was found by the owner on a phone after release. The checks above exist
so that the next one is found before.
