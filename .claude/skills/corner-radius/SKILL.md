---
name: corner-radius
description: The one corner radius of uefaresults.com - 12px, the outline of the Live / Standings / Matches tab bar - and how to round anything else from it. Use this whenever you write or change a border-radius, round a block, card, row, button, input, menu, modal, image or skeleton, or the owner says corners are "too round", "not like the tabs" or mentions border radius - on any page, desktop or phone. Read it before typing any border-radius value.
---

# One corner radius: 12px, like the tab bar

The owner's rule (2026-11-26): every rounded corner on the site uses the same
outline as the Live / Standings / Matches tab bar. That bar's corner is
**12px**. It is not a suggestion: do not pick another radius because a shape
"looks better" with one, and do not copy a radius from iOS, a widget or older
CSS in this repo.

This rule wins over the radius notes in `ios-mobile-style` and
`live-section-quality`. Everything else in those skills still applies.

## The values

| Shape | Radius | Example |
| --- | --- | --- |
| Any block, card, row, panel, input, button, menu, image | **12px** | match blocks, the tab bar, Retry button, a day button's highlight |
| Something inside a 12px shape with padding around it | **12px minus that padding** (concentric) | a tab inside the bar: 12px - 2px padding = 10px |
| Round on purpose (the owner chose these) | `50%` or `999px` | the round Back button and arrows, the live dot (the Live toggle is 12px since 2026-11-26) |
| Thin lines and tiny drawn marks | as the drawing needs | the 2px underline, the red card mark, the calendar icon |

A new shape is never "round on purpose" unless the owner asked for it. When
in doubt, it is 12px.

## How to write it

- **Use a named value, never a bare number.** On the Live screen that is
  `--lv-radius` (and `--lv-row-radius`, which points to it) in
  `public/css/components/live-day.css`; the tab bar in `live-data.css` uses
  12px and 10px. A new screen defines its own `--...-radius: 12px` once at the
  top of its stylesheet, or reuses one of these.
- **Concentric inside padding:** an inner shape's radius is the outer radius
  minus the gap between them, so the two outlines run parallel. Never give
  the inner shape the same or a larger radius.
- **Changing it:** if the owner ever asks for another radius, change the
  named values, not individual rules, and update this skill.

## Older parts of the site

Much of the site (custom leagues, modals, the home page cards) was written
before this rule and uses other radii. Do not change them on the side: that
is `no-regressions` territory. When you touch one of those rules for another
reason, ask the owner whether to bring it to 12px, and list the others you
saw.

## Before saying a change is done

1. Search what you wrote for `border-radius`: every value is the named 12px
   value, a concentric value derived from it, or one of the round-on-purpose
   shapes listed above.
2. Look at the change next to the tab bar at the top of a Live screen: the
   corners should look like the same family.
