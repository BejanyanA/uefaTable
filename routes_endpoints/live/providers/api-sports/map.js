// API-Sports JSON -> our model. Everything this provider calls things by
// stops here: its status codes, its field names, its ids.
// Pure functions, tested against the saved answers in ./samples.

import { featuredCompetition } from "../../competitions.js";
import {
  DECIDED_BY, EVENT, PERIOD, PHASE,
  makeCompetition, makeEvent, makeMatch, makeSide, makeTeam,
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

function mapEvents(events, homeTeamId) {
  const out = [];
  for (const e of events) {
    const type = eventType(e.type, e.detail);
    if (!type) continue;
    out.push(makeEvent({
      type,
      side: e.team?.id === homeTeamId ? "home" : "away",
      minute: e.time?.elapsed,
      addedTime: e.time?.extra,
      player: e.player?.name,
      detail: type === EVENT.VAR ? e.detail : null,
    }));
  }
  return out;
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
  const side = (which) => makeSide({
    team: makeTeam({ id: `t_${teams[which].id}`, name: teams[which].name, logo: teams[which].logo }),
    score: goals?.[which],
    penalties: score?.penalty?.[which],
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
