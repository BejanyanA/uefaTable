// Our own shapes for live football data.
//
// Every client (the website, mobile apps later) sees only these names and
// values, whichever data provider is behind the API. The contract for clients
// is docs/live-api.md; this file is its code form. Pure data and pure
// functions: no fetch, no database, no clock.

export const PHASE = Object.freeze({
  SCHEDULED: "scheduled",
  LIVE: "live",
  BREAK: "break",
  FINISHED: "finished",
  POSTPONED: "postponed",
  CANCELLED: "cancelled",
  SUSPENDED: "suspended",
  ABANDONED: "abandoned",
  UNKNOWN: "unknown",
});

export const PERIOD = Object.freeze({
  FIRST_HALF: "first_half",
  HALF_TIME: "half_time",
  SECOND_HALF: "second_half",
  EXTRA_TIME: "extra_time",
  EXTRA_TIME_BREAK: "extra_time_break",
  PENALTIES: "penalties",
});

export const DECIDED_BY = Object.freeze({
  REGULAR: "regular",
  EXTRA_TIME: "extra_time",
  PENALTIES: "penalties",
  AWARDED: "awarded",
});

export const EVENT = Object.freeze({
  GOAL: "goal",
  OWN_GOAL: "own_goal",
  PENALTY_GOAL: "penalty_goal",
  MISSED_PENALTY: "missed_penalty",
  YELLOW_CARD: "yellow_card",
  RED_CARD: "red_card",
  SUBSTITUTION: "substitution",
  VAR: "var",
});

// Event types that list endpoints carry. The full list of a match's events
// belongs to the match details endpoint.
export const LIST_EVENTS = new Set([
  EVENT.GOAL, EVENT.OWN_GOAL, EVENT.PENALTY_GOAL, EVENT.RED_CARD,
]);

const IN_PLAY = new Set([PHASE.LIVE, PHASE.BREAK, PHASE.SUSPENDED]);
const OVER = new Set([PHASE.FINISHED, PHASE.POSTPONED, PHASE.CANCELLED, PHASE.ABANDONED]);

// The match has started and has not ended: its score can still change.
export function isInPlay(match) {
  return IN_PLAY.has(match.phase);
}

// Nothing about this match will change any more.
export function isOver(match) {
  return OVER.has(match.phase);
}

export function makeTeam({ id, name, logo = null }) {
  return { id: String(id), name: String(name ?? ""), logo: logo || null };
}

export function makeSide({ team, score = null, penalties = null, winner = null }) {
  return {
    team,
    score: Number.isInteger(score) ? score : null,
    penalties: Number.isInteger(penalties) ? penalties : null,
    winner: typeof winner === "boolean" ? winner : null,
  };
}

export function makeEvent({ type, side, minute = null, addedTime = null, player = null, detail = null }) {
  return {
    type,
    side,
    minute: Number.isInteger(minute) ? minute : null,
    addedTime: Number.isInteger(addedTime) ? addedTime : null,
    player: player || null,
    detail: detail || null,
  };
}

export function makeMatch({
  id, competition, round = null, kickoff, phase, period = null,
  minute = null, addedTime = null, home, away, decidedBy = null, events,
}) {
  const match = {
    id: String(id),
    competition: String(competition),
    round: round || null,
    kickoff,
    phase,
    period: period || null,
    minute: Number.isInteger(minute) ? minute : null,
    addedTime: Number.isInteger(addedTime) ? addedTime : null,
    home,
    away,
    decidedBy: decidedBy || null,
  };
  if (Array.isArray(events)) match.events = events;
  return match;
}

export function makeCompetition({ key, name, kind = null, country = null, logo = null, featured = false, hasStandings = false }) {
  return {
    key: String(key),
    name: String(name ?? ""),
    kind,
    country: country ? { name: String(country.name ?? ""), flag: country.flag || null } : null,
    logo: logo || null,
    featured: Boolean(featured),
    hasStandings: Boolean(hasStandings),
  };
}
