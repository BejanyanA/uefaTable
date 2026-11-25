# API-Sports request budget

Read this before adding, removing or re-timing any call to API-Sports.

## The limits

Read from the provider's status endpoint on 2026-11-25 with the site's key:

- **Plan:** Pro
- **Per day:** 7,500 requests
- **Per minute:** 300 requests

The owner can change plan at any time. If a number here matters to a decision,
read it again from the status endpoint (it does not count as a request) rather
than trusting this file. Do not print the key or the account details that the
same endpoint returns.

## The rule

Calls are made by our API Worker when its cached copy is too old **and**
someone asks for that data. So:

- visitors do not multiply calls: a thousand people watching one match cost
  the same as one person;
- data nobody looks at costs nothing;
- the numbers below are ceilings (someone always looking at everything), not
  what a normal day uses.

## The budget

Leagues in the menus today: 23 on the Matches tab, 12 on the Standings tab.
The All tab shows every match of the day.

| Data | One call covers | Fresh for | Ceiling per day |
| --- | --- | --- | --- |
| Live scores | every match in play, all leagues | 15 s, only while a match is in play | 2,400 (10 hours of football) |
| Day view, the current day | every match of one calendar date | 10 min | 288 (two dates, see below) |
| Day view, other days | every match of one calendar date | finished days 24 h, coming days 60 min | about 180 (a week each way) |
| Fixtures and results of a league | one league, whole season | 60 min | 552 (23 leagues) |
| Standings | one league | 30 min | 576 (12 leagues) |
| Match details (events, line-ups, statistics) | one match, only when someone opens it | in play 2 min (score and events come from the live list meanwhile); 90 min before kick-off 5 min; further ahead 60 min; over 24 h | 1,200 (20 different matches followed through 2 hours each); a finished or future match costs about one call |
| **Total** | | | **about 5,200, a little over two thirds of the daily limit** |

Per minute this is at most about 16 calls against a limit of 300.

Match details are the per-match kind of call, so three things hold them in:
only a match id that appeared in one of our lists can be opened (anything
else is refused without a call), one stored copy serves every visitor, and
while a match is on only its line-ups and statistics need the provider (every
2 minutes); score, minute and events come from the live list. The guard below
doubles the 2 minutes past 70% and stops new calls past 90%.

If football were in play around the clock, live scores alone would reach 5,760
a day and the total about 7,350. That is why the guard below exists.

### The day view and time zones

Opening Live shows the viewer's own current day, and they can move to other
days. A viewer's day does not line up with the provider's calendar date, and
viewers are in many time zones. If we asked the provider once per time zone,
calls would grow with the audience. So:

- the Worker fetches and caches by **UTC date**, the same copy for everyone;
- a viewer's day overlaps at most two UTC dates; the Worker cuts the viewer's
  day out of those two cached copies. That is why the current day costs two
  dates;
- the cutting happens on the server (it is a rule a mobile app needs too);
- the day switcher is limited to a fixed range (start with seven days back
  and seven ahead), so nobody can make us fetch years of dates.

## The guard

Keep a count of today's calls where the Worker can read it. Then:

| Used today | What the Worker does |
| --- | --- |
| under 5,250 (70%) | normal times from the table |
| 5,250 to 6,750 | live scores fresh for 30 s; every other time doubled |
| over 6,750 (90%) | serve cached copies only, with their age; no new calls except live scores once a minute |

The provider also returns the remaining count in its response headers
(`x-ratelimit-requests-remaining`). Trust that over our own count when they
disagree.

## The provider refuses some calls from Cloudflare

Found on 2026-11-25. The provider's API is itself behind Cloudflare, so every
call from any Cloudflare Worker reaches it from one shared address. It answers
a share of ours (about four in ten, in bursts) with "too many requests per
minute", although our own count is far below 300 a minute and the same calls
from another network all pass.

What the code does about it (keep these when changing it):

- a refused call is asked again a few times within about 2.5 seconds
  (`providers/api-sports/client.js`);
- a visitor is never kept waiting for that: they are answered from the stored
  copy within about a second, and the refresh carries on in the background;
- after a failed refresh the next request may try again 3 seconds later;
- the days next to the one being viewed are fetched ahead, so switching day
  does not depend on the provider answering at that moment.

Measured afterwards: every request answered in under 1.6 s, live data at most
18 s old, switching day about a quarter of a second.

Only the owner can ask the provider's support whether calls from Cloudflare
Workers can be counted per key instead of per address. The first-ever request
for a day nobody has opened can still fail and shows "Try again".

## Other calls the Worker makes

- When a match leaves the live list, one call asks how it ended (up to 20
  matches per call). A few dozen calls on a busy day.
- The same call corrects a stored day that still shows a match as live after
  it ended while nobody was watching.

## Adding something new

A new kind of data (match events, line-ups, statistics, top scorers, a new
league in a menu) needs a line in the table before it is built: what one call
covers, how long it stays fresh, and its ceiling per day. Per-match calls are
the dangerous kind: 30 matches refreshed every 15 s would use the whole day's
limit in about an hour. Fetch per-match detail only when a visitor opens that
match, and keep it fresh for a minute or more unless the match is in play.

## While the widgets are still on the site

The widgets call API-Sports from each visitor's browser with the same key, so
their calls come out of the same 7,500. On 2026-11-25 the site had used 77 by
the evening, so there is plenty of room, but each tab we replace also removes
that tab's widget calls.

## When the last widget is gone

The current key has been in the site's public code, so anyone can copy it and
use up the limit. Once no page needs it in the browser, the owner should
create a new key in the API-Sports dashboard and store it only as a Worker
secret (dev and production). Remind them; only they can do it.

## Notifications (goals, kick-off, full-time)

API-Sports does not send anything to us: no webhooks or push were found, we
always ask. (Its documentation site blocks automated reading, so this rests on
third-party descriptions of the API and on how the API behaves; re-check in a
browser if it matters.)

Checked on 2026-11-25 with a real call: the one live-scores call already
carries each match's events (goals, cards, substitutions, with minute, player
and team). So alerts need no extra requests: the Worker compares each new live
answer with the previous one and treats the difference as the event.

- **While the site is open:** signed-in users already have a notification
  stream (`routes_endpoints/NotificationHub.js`, the bell in
  `public/js/modules/NotificationManager.js`). Match alerts can travel on it.
- **While the site is closed (phone or browser push):** not built. It needs a
  service worker, the visitor's permission, stored subscriptions, and a
  scheduled job in the Worker that asks for live scores even when nobody is on
  the site. That job's calls are already inside the live-scores ceiling above.
- Alerts only make sense for things a user chose to follow (a team, a match, a
  league). Never notify everyone about everything.
