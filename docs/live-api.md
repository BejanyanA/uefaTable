# Live API

The contract between our API and every client that shows live football data:
the website now, mobile apps later. A client should be buildable from this
document alone.

**Status: draft. Nothing here is built yet.** The day view (matches of
one day) is built first and its exact shape is settled then, starting from the
Match sketch below. The Standings shape below is the one to implement when its
turn comes. Once an endpoint is
live, its section is the truth and changes only by adding.

## Rules for every endpoint

- **Base:** `https://api.uefaresults.com` (production) or the dev API. All
  Live addresses start with `/live/v1/`.
- **Reads are `GET`.** Public data needs no sign-in. Personal data (follows,
  alerts) needs `Authorization: Bearer <token>`, the same token as the rest of
  the API.
- **Names and values are ours.** Nothing in a response depends on which data
  provider is behind the API.
- **Ids are opaque text.** Store them and send them back unchanged. Do not
  parse them or assume they are numbers. Competition keys (`champions-league`)
  are stable and readable; they are safe to use in addresses.
- **Times** are ISO 8601 in UTC (`2026-11-25T19:45:00Z`). Show them in the
  viewer's own time zone.
- **No language in data.** Statuses are values; each client turns them into
  words. Club and competition names are proper names and come as they are.
- **Logos** are complete URLs. Use them as given; they may be missing (`null`).

### Envelope

Success:

```json
{
  "success": true,
  "data": { },
  "meta": {
    "updatedAt": "2026-11-25T19:52:10Z",
    "refreshAfterSeconds": 1800,
    "stale": false
  }
}
```

- `updatedAt`: when our copy of this data was last fetched.
- `refreshAfterSeconds`: ask again no sooner than this. Clients take their
  refresh timing from here and from nowhere else. `null` means "no need to
  refresh" (finished data).
- `stale`: `true` when we could not refresh and are serving an older copy.
  Show the data with its age.

Failure:

```json
{ "success": false, "error": "unknown_competition" }
```

`error` is a stable code for clients to translate. Codes so far:
`unknown_competition`, `unknown_season`, `bad_request`, `not_found`,
`too_many_requests`, `unavailable` (no data and the provider cannot be
reached).

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
  "key": "champions-league",
  "name": "Champions League",
  "kind": "cup",
  "country": null,
  "logo": "https://.../champions-league.png",
  "hasStandings": true
}
```

- `kind`: `league`, `cup` or `national` (national-team tournaments).
- `country`: our country key (`england`) or `null` for international ones.

### Team

```json
{ "id": "t_541", "name": "Real Madrid", "logo": "https://.../541.png" }
```

### Match (sketch)

```json
{
  "id": "m_1208021",
  "competition": "champions-league",
  "round": "League Stage - 5",
  "kickoff": "2026-11-25T20:00:00Z",
  "phase": "live",
  "period": "second_half",
  "minute": 67,
  "addedTime": null,
  "home": { "team": { "id": "t_541", "name": "Real Madrid", "logo": "https://..." }, "score": 2, "penalties": null, "winner": null },
  "away": { "team": { "id": "t_50", "name": "Manchester City", "logo": "https://..." }, "score": 1, "penalties": null, "winner": null },
  "decidedBy": null,
  "events": []
}
```

- `phase`, one of:

  | Value | Meaning | A client shows |
  | --- | --- | --- |
  | `scheduled` | not started | kick-off time |
  | `live` | ball in play | minute and the live mark |
  | `break` | half-time or a pause before extra time or penalties | "HT" or the break label |
  | `finished` | over | "FT" (see `decidedBy`) |
  | `postponed` | moved to another date | "Postponed" |
  | `cancelled` | will not be played | "Cancelled" |
  | `suspended` | stopped, may resume | "Suspended" |
  | `abandoned` | stopped for good | "Abandoned" |
  | `unknown` | anything else | kick-off time |

- `period` (only while `live` or `break`): `first_half`, `second_half`,
  `extra_time`, `penalties`.
- `decidedBy` (only when `finished`): `regular`, `extra_time`, `penalties`.
- `winner`: `true`, `false`, or `null` (draw or not finished).
- `events` (optional), each `{ "type", "minute", "addedTime", "side", "player", "detail" }`
  with `type` one of `goal`, `own_goal`, `penalty_goal`, `missed_penalty`,
  `yellow_card`, `red_card`, `substitution`, `var`; `side` is `home` or `away`.

## Endpoints

### `GET /live/v1/competitions`

The menus, in the order clients should show them.

```json
{
  "success": true,
  "data": { "competitions": [ { "key": "champions-league", "name": "Champions League", "kind": "cup", "country": null, "logo": "https://...", "hasStandings": true } ] },
  "meta": { "updatedAt": "2026-11-25T00:00:00Z", "refreshAfterSeconds": 86400, "stale": false }
}
```

### `GET /live/v1/competitions/{key}/standings`

Query: `season` (optional). Without it, the current season. A season is named
by the year it starts in (`2026` for 2026/27).

```json
{
  "success": true,
  "data": {
    "competition": { "key": "premier-league", "name": "Premier League", "kind": "league", "country": "england", "logo": "https://...", "hasStandings": true },
    "season": 2026,
    "tables": [
      {
        "name": null,
        "rows": [
          {
            "rank": 1,
            "team": { "id": "t_42", "name": "Arsenal", "logo": "https://..." },
            "played": 12,
            "won": 9,
            "drawn": 2,
            "lost": 1,
            "goalsFor": 26,
            "goalsAgainst": 8,
            "goalDifference": 18,
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
  marker and the legend. `label` is a proper name from the provider.
- Errors: `unknown_competition`, `unknown_season`, `not_found` (the
  competition has no table), `unavailable`.

### Matches (sketch, not final)

- `GET /live/v1/matches?date=YYYY-MM-DD&tz=Europe/Paris` - **the opening
  screen.** The matches of one day in the viewer's own time zone: in play,
  finished and not started, for every competition played that day, grouped
  by competition in display order: the competitions from our menus first
  (`featured: true`), then the others by country. `date`
  is the viewer's local calendar date and `tz` their time zone name; without
  them the server uses the current UTC day. The server works out which
  matches fall inside that local day, so every client shows the same list.
  `data` also carries `previousDate` and `nextDate` (`null` at the ends of
  the allowed range) for the day switcher. While any listed match is in play,
  `refreshAfterSeconds` is short; otherwise long.
- `GET /live/v1/matches/live` - every match in play now, for clients that
  only need to refresh scores.
- `GET /live/v1/competitions/{key}/matches?season=` - fixtures and results of
  one competition, grouped by round.
- `GET /live/v1/matches/{id}` - one match with its events.

### Follows and alerts (later)

Signed-in only. What a user follows is stored by the API so the website and
the apps agree. Not designed yet.

## Change log

- 2026-11-25: first draft. Nothing built.
- 2026-11-25: the day view (`matches?date=&tz=`) is the opening screen. It
  lists every competition of the day, ours first.
