// API-Sports JSON -> our model. Everything this provider calls things by
// stops here: its status codes, its field names, its ids.
// Pure functions, tested against the saved answers in ./samples.

import { featuredCompetition } from "../../competitions.js";
import {
  DECIDED_BY, EVENT, PERIOD, PHASE, POSITION, STAT_FORMAT, STATS, VAR_DECISION,
  makeCompetition, makeEvent, makeLineup, makeLineupPlayer, makeMatch, makeSide, makeTeam,
} from "../../model.js";
import { competitionKey } from "./competitions.js";

// Their short status code -> [our phase, our period, how it was decided].
const STATUS = {
  TBD: [PHASE.SCHEDULED],
  NS: [PHASE.SCHEDULED],
  "1H": [PHASE.LIVE, PERIOD.FIRST_HALF],
  HT: [PHASE.BREAK, PERIOD.HALF_TIME],
  "2H": [PHASE.LIVE, PERIOD.SECOND_HALF],
  ET: [PHASE.LIVE, PERIOD.EXTRA_TIME],
  BT: [PHASE.BREAK, PERIOD.EXTRA_TIME_BREAK],
  P: [PHASE.LIVE, PERIOD.PENALTIES],
  LIVE: [PHASE.LIVE],
  SUSP: [PHASE.SUSPENDED],
  INT: [PHASE.SUSPENDED],
  FT: [PHASE.FINISHED, null, DECIDED_BY.REGULAR],
  AET: [PHASE.FINISHED, null, DECIDED_BY.EXTRA_TIME],
  PEN: [PHASE.FINISHED, null, DECIDED_BY.PENALTIES],
  AWD: [PHASE.FINISHED, null, DECIDED_BY.AWARDED],
  WO: [PHASE.FINISHED, null, DECIDED_BY.AWARDED],
  PST: [PHASE.POSTPONED],
  CANC: [PHASE.CANCELLED],
  ABD: [PHASE.ABANDONED],
};

export function mapStatus(short) {
  const [phase, period = null, decidedBy = null] = STATUS[short] || [PHASE.UNKNOWN];
  return { phase, period, decidedBy };
}

export function matchId(fixtureId) {
  return `m_${fixtureId}`;
}

// Their fixture id for one of our match ids, or null if it is not one of ours.
export function fixtureRef(id) {
  const m = /^m_(\d+)$/.exec(String(id));
  return m ? m[1] : null;
}

function eventType(type, detail) {
  const t = String(type || "").toLowerCase();
  const d = String(detail || "").toLowerCase();
  if (t === "goal") {
    if (d.includes("own")) return EVENT.OWN_GOAL;
    if (d.includes("missed")) return EVENT.MISSED_PENALTY;
    if (d.includes("penalty")) return EVENT.PENALTY_GOAL;
    return EVENT.GOAL;
  }
  if (t === "card") return d.includes("yellow") && !d.includes("second") ? EVENT.YELLOW_CARD : EVENT.RED_CARD;
  if (t === "subst") return EVENT.SUBSTITUTION;
  if (t === "var") return EVENT.VAR;
  return null;
}

// Their VAR wording -> our decision values. Anything else: no detail.
function varDecision(detail) {
  const d = String(detail || "").toLowerCase();
  if (d.includes("goal") && (d.includes("cancel") || d.includes("disallow"))) return VAR_DECISION.GOAL_CANCELLED;
  if (d.includes("goal") && d.includes("confirm")) return VAR_DECISION.GOAL_CONFIRMED;
  if (d.includes("penalty") && d.includes("confirm")) return VAR_DECISION.PENALTY_CONFIRMED;
  if (d.includes("penalty") && d.includes("cancel")) return VAR_DECISION.PENALTY_CANCELLED;
  if (d.includes("card") && d.includes("upgrade")) return VAR_DECISION.CARD_UPGRADED;
  return null;
}

export function playerId(id) {
  return Number.isInteger(id) && id > 0 ? `p_${id}` : null;
}

// `starters`: their ids of the players who started, when known. For a
// substitution they name the player going off as "player" and the one
// coming on as "assist"; the line-ups confirm which is which.
function mapEvents(events, homeTeamId, starters = null) {
  const out = [];
  for (const e of events) {
    const type = eventType(e.type, e.detail);
    if (!type) continue;
    const side = e.team?.id === homeTeamId ? "home" : "away";
    const base = { type, side, minute: e.time?.elapsed, addedTime: e.time?.extra };
    if (type === EVENT.SUBSTITUTION) {
      let off = e.player || {};
      let on = e.assist || {};
      if (starters && starters.has(on.id) && !starters.has(off.id)) [off, on] = [on, off];
      out.push(makeEvent({
        ...base, player: on.name, playerId: playerId(on.id), playerOff: off.name, playerOffId: playerId(off.id),
      }));
      continue;
    }
    const isGoal = type === EVENT.GOAL || type === EVENT.PENALTY_GOAL;
    out.push(makeEvent({
      ...base,
      player: e.player?.name,
      playerId: playerId(e.player?.id),
      assist: isGoal ? e.assist?.name : null,
      detail: type === EVENT.VAR ? varDecision(e.detail) : null,
    }));
  }
  return out;
}

const POSITIONS = { G: POSITION.GOALKEEPER, D: POSITION.DEFENDER, M: POSITION.MIDFIELDER, F: POSITION.FORWARD };

// "2:4" -> { row: 2, col: 4 }
function gridOf(text) {
  const m = /^(\d+):(\d+)$/.exec(String(text || ""));
  return m ? { row: Number(m[1]), col: Number(m[2]) } : null;
}

function mapLineupPlayer(entry) {
  const p = entry?.player || {};
  return makeLineupPlayer({
    id: playerId(p.id),
    name: p.name,
    number: p.number,
    position: POSITIONS[p.pos] || null,
    grid: gridOf(p.grid),
  });
}

function mapLineup(lineup) {
  if (!lineup) return null;
  return makeLineup({
    formation: lineup.formation,
    coach: lineup.coach?.name || null,
    starters: (lineup.startXI || []).map(mapLineupPlayer),
    substitutes: (lineup.substitutes || []).map(mapLineupPlayer),
  });
}

// Their statistic names -> our keys (see STATS in the model).
const STAT_KEYS = {
  "Ball Possession": "possession",
  expected_goals: "expected_goals",
  "Total Shots": "shots",
  "Shots on Goal": "shots_on_target",
  "Shots off Goal": "shots_off_target",
  "Blocked Shots": "shots_blocked",
  "Shots insidebox": "shots_inside_box",
  "Shots outsidebox": "shots_outside_box",
  "Corner Kicks": "corners",
  Offsides: "offsides",
  Fouls: "fouls",
  "Free Kicks": "free_kicks",
  "Goalkeeper Saves": "saves",
  "Total passes": "passes",
  "Passes accurate": "passes_accurate",
  "Passes %": "pass_accuracy",
  "Yellow Cards": "yellow_cards",
  "Red Cards": "red_cards",
};

// "35%" -> 35, "2.15" -> 2.15, null -> null.
function statNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

function mapStatistics(list, homeTeamId) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const values = { home: {}, away: {} };
  for (const team of list) {
    const side = team.team?.id === homeTeamId ? "home" : "away";
    for (const s of team.statistics || []) {
      const key = STAT_KEYS[s.type];
      if (key) values[side][key] = statNumber(s.value);
    }
  }
  const out = [];
  for (const [key, format] of STATS) {
    const home = values.home[key];
    const away = values.away[key];
    // A row both teams lack is left out; a count one team lacks is 0.
    if ((home === null || home === undefined) && (away === null || away === undefined)) continue;
    const fill = (v) => (v === null || v === undefined ? (format === STAT_FORMAT.COUNT ? 0 : null) : v);
    out.push({ key, format, home: fill(home), away: fill(away) });
  }
  return out;
}

// "Michael Oliver, England" -> "Michael Oliver"
function refereeName(text) {
  const name = String(text || "").split(",")[0].trim();
  return name || null;
}

// One fixture with everything they know about it -> our match and details.
export function mapMatchDetails(item) {
  const { match, competition } = mapFixture(item);
  const { fixture, teams, score, lineups, statistics, events } = item;
  const homeId = teams.home.id;
  const lineupOf = (id) => (Array.isArray(lineups) ? lineups.find((l) => l.team?.id === id) : null);
  const homeLineup = mapLineup(lineupOf(homeId));
  const awayLineup = mapLineup(lineupOf(teams.away.id));
  const starters = new Set((lineups || []).flatMap((l) => (l.startXI || []).map((s) => s.player?.id)).filter(Boolean));
  if (Array.isArray(events)) match.events = mapEvents(events, homeId, starters.size > 0 ? starters : null);
  else match.events = [];

  const half = score?.halftime;
  const venue = fixture.venue?.name ? { name: fixture.venue.name, city: fixture.venue.city || null } : null;
  return {
    match,
    competition,
    details: {
      venue,
      referee: refereeName(fixture.referee),
      halfTime: Number.isInteger(half?.home) && Number.isInteger(half?.away) ? { home: half.home, away: half.away } : null,
      lineups: homeLineup || awayLineup ? { home: homeLineup, away: awayLineup } : null,
      statistics: mapStatistics(statistics, homeId),
    },
  };
}

function mapCompetition(league) {
  const key = competitionKey(league.id);
  // A featured competition keeps our own name, logo and country.
  const ours = featuredCompetition(key);
  if (ours) return ours;
  const international = !league.country || league.country === "World";
  return makeCompetition({
    key,
    name: league.name,
    country: international ? null : { name: league.country, flag: league.flag },
    logo: league.logo,
    featured: false,
    hasStandings: false,
  });
}

function mapFixture(item) {
  const { fixture, league, teams, goals, score, events } = item;
  const { phase, period, decidedBy } = mapStatus(fixture.status?.short);
  const competition = mapCompetition(league);
  // They fill the shoot-out score with 0 for some matches that had none
  // (seen on a suspended match): only a shoot-out has one.
  const shootout = fixture.status?.short === "P" || fixture.status?.short === "PEN";
  const side = (which) => makeSide({
    team: makeTeam({ id: `t_${teams[which].id}`, name: teams[which].name, logo: teams[which].logo }),
    score: goals?.[which],
    penalties: shootout ? score?.penalty?.[which] : null,
    winner: teams[which].winner,
  });
  const match = makeMatch({
    id: matchId(fixture.id),
    competition: competition.key,
    round: league.round,
    kickoff: new Date(fixture.timestamp * 1000).toISOString().replace(".000Z", "Z"),
    phase,
    period,
    minute: phase === PHASE.LIVE || phase === PHASE.BREAK ? fixture.status?.elapsed : null,
    addedTime: phase === PHASE.LIVE ? fixture.status?.extra : null,
    home: side("home"),
    away: side("away"),
    decidedBy,
    events: Array.isArray(events) ? mapEvents(events, teams.home.id) : undefined,
  });
  return { match, competition };
}

// A list of their fixtures -> { matches, competitions } in our model.
// One broken item never loses the rest of the list.
export function mapFixtures(items) {
  const matches = [];
  const competitions = {};
  for (const item of items) {
    try {
      const { match, competition } = mapFixture(item);
      matches.push(match);
      competitions[competition.key] = competition;
    } catch {
      // Skip an item we cannot read.
    }
  }
  return { matches, competitions };
}
