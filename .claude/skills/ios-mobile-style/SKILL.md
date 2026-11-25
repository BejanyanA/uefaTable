---
name: ios-mobile-style
description: The rule for uefaresults.com on phones - every mobile screen must look and behave exactly like iOS (dark mode). Use this whenever you build, change or review anything a phone visitor sees (768px and less) - colours, backgrounds, text sizes and fonts, corner radii, buttons (back, toggles, pills), lists and rows, tabs and segmented controls, sheets, spacing, tap areas, motion - on the Live screens or anywhere else on the site. Also use it when the owner says something "does not match iOS", mentions an iPhone, Settings, iOS menus or iOS radius, or asks for a mobile look. Read it before writing mobile CSS.
---

# Phones look exactly like iOS

The owner's rule (2026-11-26): on phones, everything must match iOS styling
exactly. Not "inspired by" iOS: the same colours, the same shapes, the same
sizes, the same behaviour as the iPhone's own apps in dark mode. Desktop keeps
the site's own style unless the owner asks otherwise.

"Phone" here means the site's narrow layout: `@media (max-width: 768px)`.

Use this with `no-regressions` (do not break what works) and, on Live
screens, `live-section-quality` and `live-architecture`.

## How to get "exactly" right

1. **Match a real iPhone, not memory.** The values below are a starting
   point. iOS changes its look between versions (iOS 26 made corners rounder
   and added glass), and Apple does not publish every number. When a value
   matters and you are not sure, ask the owner for a screenshot of the iPhone
   screen they mean, then compare side by side at the same width.
2. **Name every iOS value once** as a CSS custom property next to the screen
   that uses it (for example `--lv-row-radius` in `live-day.css`). Then a
   correction after comparing is one line.
3. **Say what is an estimate.** If a value could not be confirmed (from
   Apple's documentation or a screenshot), say so in the code comment and to
   the owner. Do not present a guess as "exact".
4. **Check on a real iPhone before release.** Browser emulation does not show
   Safari's bars, the notch, the home bar, iOS fonts or real blur.

## iOS dark mode values

Colours (iOS dark mode system colours):

| Role | iOS name | Value |
| --- | --- | --- |
| Page | systemBackground | `#000000` |
| Row, cell, block | secondarySystemGroupedBackground | `#1c1c1e` |
| Raised inside a row | tertiarySystemGroupedBackground | `#2c2c2e` |
| Main text | label | `#ffffff` |
| Secondary text | secondaryLabel | `rgba(235, 235, 245, 0.6)` |
| Faint text | tertiaryLabel | `rgba(235, 235, 245, 0.3)` |
| Hairline | separator | `rgba(84, 84, 88, 0.65)` |
| Fill (buttons, tracks) | tertiarySystemFill | `rgba(118, 118, 128, 0.24)` |
| Red (on dark) | systemRed | `#ff453a` |
| Red (on white or light) | systemRed, light | `#ff3b30` |
| Blue (on dark) | systemBlue | `#0a84ff` |
| Green (on dark) | systemGreen | `#30d158` |
| Orange (on dark) | systemOrange | `#ff9f0a` |

Type: the system font, which is San Francisco on iPhone.

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
```

| iOS style | Size / weight |
| --- | --- |
| Large title | 34px bold |
| Title 3 | 20px regular |
| Headline | 17px semibold |
| Body | 17px regular |
| Subheadline | 15px regular |
| Footnote | 13px regular |
| Caption | 12px regular |

Use `rem` for these (the site's root is 16px) so the visitor's text size
setting still works.

Shapes and sizes:

- **Tap targets: at least 44 by 44 px.** A smaller visible control (a pill,
  a chip) gets an invisible larger tap area (`::before` with negative inset).
- **Side margins:** 16px from the screen edge to a list block.
- **Corner radius: not iOS's.** The owner chose one radius for the whole
  site, 12px like the Live tab bar: follow the `corner-radius` skill. (iOS 26
  rounds lists much more; the owner tried that and asked for less.)
- **Buttons in bars (back, close):** iOS 26 style, a 36px round glass button
  with a chevron or icon: fill `rgba(120, 120, 128, 0.24)`, `backdrop-filter:
  blur(12px) saturate(180%)`, a fine light rim `inset 0 0 0 0.5px
  rgba(255, 255, 255, 0.28)`, no hard outline, slightly darker while pressed.
- **Lists:** rows on the black page, each block in `#1c1c1e`; a section's
  name is a small heading above its blocks, not a bar inside them.
- **Segmented controls and tabs:** an iOS segmented control is a track in
  `tertiarySystemFill` with the selected segment raised in a lighter grey,
  not a coloured gradient. (The Live tabs still use the site's blue: changing
  them is a decision for the owner.)

- **Sheets:** frosted glass (`rgba(28, 28, 30, 0.72)` with `blur(30px)
  saturate(180%)`) over a light dimming of the page, a grabber at the top,
  and they close with a swipe down as well as a button. Use a plain word on
  that button ("Close"), short enough for every language.
- **Bars that stay at the top are frosted like the site header**
  (`rgba(0, 0, 0, 0.329)` with `blur(6px)`), never solid black. The header
  draws its own blur on `header::before`, so frosted things inside it (the
  phone tab bar) can blur the page too; keep it that way.
- **Bars stacked at the top share one frosted band.** Two blurs that meet
  show a sharp line where they touch. On Live the header, the phone tab bar
  and the day row are transparent and one fixed band behind them
  (`.liveDataPage::before`) does the blurring, as tall as all of them.
- **A toggle button in a bar looks like the Back button when it is off**
  (the glass fill above on phones; on desktop the Back button's thin light
  outline and dark fill), so buttons in one bar match.
- **Sticky bars must not sit inside a container-query element.** Safari can
  stop them from sticking. On Live the top row and the list are each their
  own `lv` container instead of the whole view.
- **Menus and popovers go on the page, not inside the header.** A blur
  inside an element that already has a blur (the site header) only sees that
  element, so the menu looks flat. Append floating panels to `document.body`
  and place them with `position: fixed` under their button.
- **Tabs keep their words.** On the narrowest phones let icons go and the
  text shrink a little; do not hide the words (the owner asked for this,
  Armenian words being long).
- **Inputs:** `style.css` gives every input a box, border and shadow with
  `!important`; an iOS search field must override all three, or it shows two
  backgrounds.

Motion: short and quiet (about 0.2-0.3s, ease-out). Respect
`prefers-reduced-motion`.

## Where the Live screens stand

Already iOS on phones (2026-11-26): black page, one `#1c1c1e` block per
match (12px corners, see `corner-radius`), the system font, secondaryLabel
and systemRed colours, the round glass Back button, the Live pill (14px text,
36px tall) with a full-size tap area, a red live mark on the selected Live
tab.

Not yet iOS: the Live / Standings / Matches tabs (blue gradient instead of a
segmented control), the Standings and Matches tabs' content (still the
API-Sports widget), and the rest of the site outside Live.

## Before saying a mobile change is done

1. Every colour and size you used comes from the table above or from a
   comparison with a real iPhone screenshot; estimates are marked. Radii
   follow `corner-radius`.
2. Tap targets are 44px or more.
3. The text still fits in French and Armenian at 320px.
4. Then the `no-regressions` checks, including `npm run check`.
5. Tell the owner what still differs from iOS, if anything.
