# Live section design

How Live screens should look and feel. The aim is the standard of the best
score apps today, in the site's own dark style: quiet, dense where it helps,
and instantly readable in a glance on a phone.

## Contents

1. Principles
2. Colours, type and sizes that fit the site
3. Match row
4. Match list (All and Matches tabs)
5. Standings table
6. League picker and tabs
7. Live indicators and score changes
8. Loading, empty, old and failed states
9. Motion
10. What to avoid

## 1. Principles

- **The score is the loudest thing on the screen.** Everything else is
  quieter: names next, then time and status, then decoration.
- **One glance.** A visitor should read a row in under a second: who, score,
  state. If a row needs study, simplify it.
- **Numbers line up.** Scores, minutes and table columns use tabular figures
  (`font-variant-numeric: tabular-nums`) so they do not jitter when they
  change and columns read straight down.
- **Calm by default, alive when live.** Nothing moves unless a match is in
  play or a score just changed.
- **Same parts everywhere.** One match row, one table, one picker, reused on
  every tab. Do not design a second version of the same thing.

## 2. Colours, type and sizes that fit the site

The site has no shared CSS variables today; colours are written out in each
file. For new Live styles, define a small set of custom properties on the Live
container (`.liveDataPage`) and use only those. Scope them there, not on
`:root`, so nothing outside Live changes.

Values that match the existing look (check the neighbouring CSS before you
settle them):

| Role | Value | Notes |
| --- | --- | --- |
| Page background | `rgb(1, 10, 20)` | The site's body colour |
| Surface (cards, table) | `rgba(255, 255, 255, 0.05)` | Already used for panels |
| Surface, raised or hover | `rgba(255, 255, 255, 0.1)` | |
| Hairlines | `rgba(255, 255, 255, 0.1)` | 1 px separators, no heavy borders |
| Main text, scores, names | `rgb(250, 249, 249)` or `#fff` | |
| Secondary text | no dimmer than `rgba(255, 255, 255, 0.6)` | Keeps 4.5:1 contrast |
| Live | `#dc3545` (the site's red) | Always with the word or minute too |
| Positive (win, promotion) | `#28a745` (the site's green) | Always with a letter or label |

- **Font:** the site uses `Arial, sans-serif`. Keep it; do not add a web font.
- **Sizes on a phone:** score 18-20 px bold, team names 15-16 px, time and
  status 12-13 px, table cells 13-14 px. Never below 12 px.
- **Spacing:** a 4 px step (4, 8, 12, 16, 24). Rows at least 48 px tall so the
  whole row is a comfortable touch target.
- **Corners:** follow the radius the neighbouring panels use.
- **Breakpoints already in the code:** 480 px is the common phone cut, with
  600, 768, 800 and 1100 px in the table styles. Reuse these; do not add a
  new set. How layouts adapt between them is in `responsive.md`.

## 3. Match row

```
[time / minute]  [logo] Home team name ............  2
                 [logo] Away team name ............  1
```

- **Narrow lists (phones, small windows):** two lines, one team per line,
  scores right-aligned in a column. This survives long names on narrow
  screens.
- **Wide lists (640px of list width and more, desktop):** one line, as the
  owner asked on 2026-11-26: `Home name [crest]  2 - 0  [crest] Away name`,
  the score in the exact middle of the block, the home name right-aligned
  against its crest. The switch is a container query on the list, not on the
  window.
- Left column, fixed width: kick-off time before the match, the live minute
  during it (with the live mark), "HT", "FT", "AET", "Pen" after.
- Team names on one line, cut with an ellipsis. The winner's name and score
  slightly brighter or bolder once the match is over; the loser stays at
  secondary text. Never hide the loser.
- Logos 20-24 px, fixed box, `object-fit: contain`. If a logo fails, keep the
  box and show the first letter of the club; the row must not shift.
- Penalties and aggregate scores go in small secondary text next to the score,
  never instead of it.
- Postponed or cancelled: the status word in the left column, no score, names
  at secondary text.

## 4. Match list (All and Matches tabs)

- Group by competition (or by round on the Matches tab), with a small header:
  logo, competition name, country. The whole header is a button that closes
  and opens the competition (a chevron at its end); a closed one shows
  "live/total" (live in red when above 0). Closed competitions are
  remembered on the device.
- Order inside "today": live first, then upcoming by kick-off, then finished.
- The day switcher sits above the list: the selected day, the days around it,
  previous and next arrows, Today always one tap away. Its full rules are in
  `responsive.md`, section 4. Opening Live selects the viewer's current day.
- A selected day lists its matches in play and its finished ones, and those
  not started yet with their kick-off time.
- Hairline between rows, a little more space between groups. No boxes inside
  boxes.

## 5. Standings table

- A real table. Columns in this order: rank, club (logo + name), played, won,
  drawn, lost, goals for:against (or goal difference), points.
- **Points are the brightest number**, bold, last column. Goal difference
  shows its sign ("+12", "-6").
- **On narrow phones** keep rank, club, played, goal difference and points
  visible without scrolling. Extra columns can scroll sideways inside the
  table wrapper while the rank and club column stays put
  (`position: sticky; left: 0` with a solid background), or be dropped below
  a width. The page itself must never scroll sideways.
- Rank in its own fixed-width column so it cannot touch the logo. Club names
  on one line with an ellipsis. Numbers centred under their headers.
- Qualification and relegation zones: a thin coloured bar on the left edge of
  the row plus a short legend under the table. The legend is what makes the
  colour meaningful; never colour alone.
- Group stages: one small table per group with the group name as its header.
- Header row sticks while the table scrolls.
- **These rules also apply to the custom-league tables,** which share
  `standings.css` with the Live table. Change shared rules only on purpose and
  check both (see the `no-regressions` skill).

## 6. League picker and tabs

- Tabs (All, Standings, Matches) are one row, equal width on phones, with a
  clear selected state that does not rely on colour alone (weight or an
  underline as well).
- League picker: logo plus name, the chosen league always visible. On phones a
  horizontally scrolling row of chips or a full-width sheet both work; a tiny
  dropdown does not. The selected chip scrolls into view.
- Keep the owner's order: Champions League first, World Cup right before EURO.
- Controls a visitor uses often should sit where a thumb reaches without
  stretching: full-width rows, nothing important in the far top corners only.

## 7. Live indicators and score changes

- A live match shows its minute in strong white text and a red bar at the
  left edge of its block, with a faint red glow behind it (the owner's
  choice, 2026-11-26). Nothing blinks.
- When a score changes, highlight that score cell for about two seconds
  (a soft background fade), then return to normal. No sound, no popup, no
  shifting of rows.
- When a match moves from upcoming to live or from live to finished, change
  its row in place. Reorder the list only on the next full load or when the
  visitor is not scrolling, so rows do not jump under the finger.
- Show "Updated just now" / "Updated 2 min ago" in small secondary text near
  the top of the list. It builds trust and makes old data honest.

## 8. Loading, empty, old and failed states

- **Loading:** skeleton rows in the exact shape of the real ones (same height,
  logo boxes, bars for names and numbers). Use the real row count when it is
  known (a league table has a fixed number of clubs). No centred spinner over
  an empty area.
- **Switching league:** keep the old content dimmed until the new one is
  ready, or swap to skeletons at once. Do not flash an empty state in between.
- **Empty:** one short sentence in the current language and, if known, the
  next match day. A friendly line beats an icon wall.
- **Old data:** content as normal plus the "Updated ... ago" line in a
  noticeable (not alarming) colour.
- **Failed with nothing to show:** a short explanation and a Retry button.
  Never a raw error text from the API.

## 9. Motion

- Short and functional: 150-250 ms for state changes, about 2 s for the score
  highlight. Ease out. Animate only `opacity` and `transform`.
- Nothing loops forever.
- Under `prefers-reduced-motion: reduce`, drop the fades and turns; change
  state instantly.

## 10. What to avoid

- The widget look: heavy boxes, bright gradients inside the data area, many
  competing colours.
- Centred single-line "Home 2 - 1 Away" rows that break on long names.
- Hiding data behind taps (accordions closed by default, "show more" for the
  first screen).
- Adverts-style banners, auto-scrolling tickers, or anything that moves
  without a score change.
- Tooltips as the only way to learn what a column means; phones have no hover.
- Pure white large areas or thin grey text on the dark page.
- Captions under images, and any long dash in text. The owner removed both
  elsewhere on the site.
