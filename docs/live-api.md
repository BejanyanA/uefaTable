# Live API

The contract between our API and every client that shows live football data:
the website now, mobile apps later. A client should be buildable from this
document alone.

**Status**

| Endpoint | State |
| --- | --- |
| `GET /live/v1/competitions` | Built, on dev |
| `GET /live/v1/matches` (the day view) | Built, on dev |
| `GET /live/v1/matches/live` | Built, on dev |
| `GET /live/v1/competitions/{key}/standings` | Designed below, not built |
| `GET /live/v1/competitions/{key}/matches` | Sketch |
| `GET /live/v1/matches/{id}` | Sketch |

Nothing is on production yet. Once an endpoint is on production its section is
a promise and changes only by adding.

## Rules for every endpoint

- **Base:** `https://api.uefaresults.com` (production) or the dev API. All
  Live addresses start with `/live/v1/`.
- **Reads are `GET`.** Public data needs no sign-in. Personal data (follows,
  alerts) will need `Authorization: Bearer <token>`, the same token as the
  rest of the API.
- **Names and values are ours.** Nothing in a response depends on which data
  provider is behind the API.
- **Ids are opaque text.** Store them and send them back unchanged. Do not
  parse them or assume they are numbers. Keys of the competitions we feature
  (`champions-league`) are stable and readable; they are safe in addresses.
- **Times** are ISO 8601 in UTC (`2026-11-25T19:45:00Z`). Show them in the
  viewer's own time zone.
- **No language in data.** Statuses are values; each client turns them into
  words. Club and competition names are proper names and come as they are.
- **Logos** are complete URLs. Use them as given; they may be `null`.

### Envelope

Success:

```json
{
  "success": true,
  "data": { },
  "meta": {
    "updatedAt": "2026-11-25T19:52:10Z",
    "refreshAfterSeconds": 600,
    "stale": false
  }
}
```

- `updatedAt`: when our copy of this data was last fetched.
- `refreshAfterSeconds`: ask again after this many seconds. Clients take
  their refresh timing from here and from nowhere else. `null` means "no need
  to refresh" (everything shown is over).
- `stale`: `true` when we could not refresh and are serving an older copy.
  Show the data with its age.

Failure:

```json
{ "success": false, "error": "out_of_range" }
```

`error` is a stable code for clients to translate:

| Code | Status | Meaning |
| --- | --- | --- |
| `bad_request` | 400 | A parameter is not valid (date, time zone) |
| `out_of_range` | 400 | The date is outside the days we serve |
| `not_found` | 404 | No such address |
| `method_not_allowed` | 405 | Only `GET` is accepted |
| `unavailable` | 503 | We have no copy of this data and could not get one; ask again shortly |

### Compatibility promise

Inside `v1` we only add: new optional fields, new values in the lists below,
new endpoints. We never remove or rename a field or change what it means.
So every client must:

- ignore fields it does not know;
- cope with a missing optional field (marked "optional" below);
- show something sensible for a value it does not know (an unknown `phase`
  falls back to the kick-off time; an unknown event type is skipped).

## Shared shapes

### Competition

```json
{
  "key": "premier-league",
  "name": "Premier League",
  "kind": "league",
  "country": { "name": "England", "flag": null },
  "logo": "https://uefaresults.com/assets/league_logos/premierLeague.png",
  "featured": true,
  "hasStandings": true
}
```

- `featured`: one of the competitions this site puts first.
- `kind`: `league`, `cup` or `national` for featured competitions; `null`
  when we do not know.
- `country`: `null` for international competitions.
- A competition we do not feature has a key like `c_136`. It is as valid as
  any other id, but it is not guaranteed to stay the same for ever.

### Team

```json
{ "id": "t_541", "name": "Real Madrid", "logo": "https://.../541.png" }
```

### Match

```json
{
  "id": "m_1635718",
  "round": "League Stage - 5",
  "kickoff": "2026-11-25T17:45:00Z",
  "phase": "live",
  "period": "second_half",
  "minute": 67,
  "addedTime": null,
  "home": { "team": { "id": "t_1", "name": "Sabah FA", "logo": "https://..." }, "score": 0, "penalties": null, "winner": null },
  "away": { "team": { "id": "t_2", "name": "Barcelona", "logo": "https://..." }, "score": 1, "penalties": null, "winner": null },
  "decidedBy": null,
  "events": [
    { "type": "goal", "side": "away", "minute": 31, "addedTime": null, "player": "A. Player", "detail": null }
  ]
}
```

- `phase`, one of:

  | Value | Meaning | A client shows |
  | --- | --- | --- |
  | `scheduled` | not started | kick-off time |
  | `live` | ball in play | minute and the live mark |
  | `break` | half-time, or the pause inside extra time | "HT" or a break label |
  | `finished` | over | "FT" (see `decidedBy`) |
  | `postponed` | moved to another date | "Postponed" |
  | `cancelled` | will not be played | "Cancelled" |
  | `suspended` | stopped, may resume | "Suspended" |
  | `abandoned` | stopped for good | "Abandoned" |
  | `unknown` | anything else | kick-off time |

- `period` (while `live` or `break`, may be `null`): `first_half`,
  `half_time`, `second_half`, `extra_time`, `extra_time_break`, `penalties`.
- `minute`, `addedTime`: only while `live` or `break`; "45+2" is
  `minute: 45, addedTime: 2`.
- `score`: `null` until the match has one. `penalties`: the shoot-out score,
  `null` when there was none.
- `winner`: `true`, `false`, or `null` (a draw, or not decided yet).
- `decidedBy` (when `finished`): `regular`, `extra_time`, `penalties`,
  `awarded`.
- `events` (optional): present only where stated. In lists it holds goals and
  red cards only. `type` is one of `goal`, `own_goal`, `penalty_goal`,
  `missed_penalty`, `yellow_card`, `red_card`, `substitution`, `var`; `side`
  is `home` or `away`.
- `competition` (a competition key): present on a match only when the match
  is not already inside a competition group.

## Endpoints

### `GET /live/v1/competitions`

The competitions this site features, in the order clients should show them.

```json
{
  "success": true,
  "data": { "competitions": [ { "key": "champions-league", "name": "Champions League", "kind": "cup", "country": null, "logo": "https://uefaresults.com/assets/league_logos/championsLeague.png", "featured": true, "hasStandings": true } ] },
  "meta": { "updatedAt": "2026-11-25T18:23:48Z", "refreshAfterSeconds": 86400, "stale": false }
}
```

### `GET /live/v1/matches` - the day view

**The opening screen.** Every match of one day in the viewer's own time zone:
in play, finished and not started, for every competition played that day.

Query:

- `tz`: the viewer's time zone name (`Europe/Paris`). Default `UTC`.
- `date` (optional): the viewer's calendar date, `YYYY-MM-DD`. Without it,
  today in that time zone. Must be inside `range` (see below).

The server works out which matches fall inside that local day, so every
client shows the same list. For **today**, the list also holds matches that
kicked off before the viewer's midnight and are still being played (or ended
in the last minutes), for up to four hours after midnight: at 00:10 a match
that kicked off at 23:30 is still on, so it is part of today.

```json
{
  "success": true,
  "data": {
    "date": "2026-11-25",
    "timeZone": "Asia/Yerevan",
    "today": "2026-11-25",
    "previousDate": "2026-11-24",
    "nextDate": "2026-11-26",
    "range": { "from": "2026-11-18", "to": "2026-12-02" },
    "live": { "count": 18, "refreshAfterSeconds": 15 },
    "groups": [
      {
        "competition": { "key": "champions-league", "name": "Champions League", "kind": "cup", "country": null, "logo": "https://uefaresults.com/assets/league_logos/championsLeague.png", "featured": true, "hasStandings": true },
        "matches": [
          { "id": "m_1635611", "round": "League Stage - 5", "kickoff": "2026-11-24T20:00:00Z", "phase": "finished", "period": null, "minute": null, "addedTime": null, "home": { "team": { "id": "t_42", "name": "Arsenal", "logo": "https://.../42.png" }, "score": 1, "penalties": null, "winner": null }, "away": { "team": { "id": "t_165", "name": "Borussia Dortmund", "logo": "https://.../165.png" }, "score": 1, "penalties": null, "winner": null }, "decidedBy": "regular" }
        ]
      }
    ]
  },
  "meta": { "updatedAt": "2026-11-25T18:25:15Z", "refreshAfterSeconds": 600, "stale": false }
}
```

- `today`: today's date in the viewer's time zone, as the server sees it.
- `previousDate`, `nextDate`: for the day switcher; `null` at the ends of the
  range.
- `range`: the first and last day a viewer may ask for (a week each way).
  A date outside it answers `out_of_range`.
- `groups` come in display order: the competitions we feature first, in the
  site's order, then international ones, then the rest by country and name.
  Inside a group matches are in kick-off order and stay there whatever their
  state, so a row never moves.
- `live`: `null` when nothing of that day is in play or about to start.
  Otherwise the client should refresh scores every
  `live.refreshAfterSeconds` with `GET /live/v1/matches/live`, and keep
  refreshing the whole day every `meta.refreshAfterSeconds`.
- Matches here carry `events` only while they are in play.
- A typical day is about 140 KB of JSON, 15 KB compressed.

### `GET /live/v1/matches/live`

Only what changes quickly: every match in play right now, in any competition,
plus the ones that ended in the last 15 minutes. Small (about 12 KB).

```json
{
  "success": true,
  "data": {
    "matches": [ { "id": "m_1601615", "competition": "c_136", "round": "Regular Season - 13", "kickoff": "2026-11-25T18:00:00Z", "phase": "live", "period": "first_half", "minute": 22, "addedTime": null, "home": { }, "away": { }, "decidedBy": null, "events": [ ] } ],
    "ended": [ ]
  },
  "meta": { "updatedAt": "2026-11-25T18:24:41Z", "refreshAfterSeconds": 15, "stale": false }
}
```

How a client uses it: for each match in `ended` and `matches`, replace its own
copy of the match with the same `id`. Ignore matches it is not showing. That
is all; no ordering or state rules are needed on the client.

### `GET /live/v1/competitions/{key}/standings` (not built)

Query: `season` (optional). Without it, the current season. A season is named
by the year it starts in (`2026` for 2026/27).

```json
{
  "success": true,
  "data": {
    "competition": { "key": "premier-league", "name": "Premier League", "kind": "league", "country": { "name": "England", "flag": null }, "logo": "https://...", "featured": true, "hasStandings": true },
    "season": 2026,
    "tables": [
      {
        "name": null,
        "rows": [
          {
            "rank": 1,
            "team": { "id": "t_42", "name": "Arsenal", "logo": "https://..." },
            "played": 12, "won": 9, "drawn": 2, "lost": 1,
            "goalsFor": 26, "goalsAgainst": 8, "goalDifference": 18,
            "points": 29,
            "form": ["W", "W", "D", "W", "L"],
            "zone": "champions_league"
          }
        ]
      }
    ],
    "zones": [ { "key": "champions_league", "label": "Champions League" } ]
  },
  "meta": { "updatedAt": "2026-11-25T19:52:10Z", "refreshAfterSeconds": 1800, "stale": false }
}
```

- `tables`: one entry for a league; one per group for a group stage, with
  `name` set (`"Group A"`).
- `rows` come in display order. Use `rank` for the number shown.
- `form` (optional): latest results, oldest first, each `W`, `D` or `L`.
- `zone` (optional, may be `null`): a key into `zones`, for the coloured
  marker and the legend.

### Still a sketch

- `GET /live/v1/competitions/{key}/matches?season=` - fixtures and results of
  one competition, grouped by round.
- `GET /live/v1/matches/{id}` - one match with all its events.
- Follows and alerts, signed-in only. What a user follows is stored by the API
  so the website and the apps agree.

## Change log

- 2026-11-26: today's list also holds matches still running from before
  midnight.

- 2026-11-25: first draft.
- 2026-11-25: the day view is the opening screen and lists every competition
  of the day, ours first.
- 2026-11-25: `competitions`, `matches` (day view) and `matches/live` built on
  dev. Shapes above are taken from real answers. Added `range`, `live`,
  `featured`, the `period` values `half_time` and `extra_time_break`, the
  `decidedBy` value `awarded`, and the error `out_of_range`.
