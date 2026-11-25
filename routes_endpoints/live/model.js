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

// What a VAR check decided (`detail` of a `var` event).
export const VAR_DECISION = Object.freeze({
  GOAL_CANCELLED: "goal_cancelled",
  GOAL_CONFIRMED: "goal_confirmed",
  PENALTY_CONFIRMED: "penalty_confirmed",
  PENALTY_CANCELLED: "penalty_cancelled",
  CARD_UPGRADED: "card_upgraded",
});

// `player` is who the event is about; for a substitution, the player coming
// on, with `playerOff` the one going off. `assist` is the passer of a goal.
// The ids link an event to a player in the line-ups.
export function makeEvent({
  type, side, minute = null, addedTime = null, player = null, detail = null,
  playerId = null, assist = null, playerOff = null, playerOffId = null,
}) {
  return {
    type,
    side,
    minute: Number.isInteger(minute) ? minute : null,
    addedTime: Number.isInteger(addedTime) ? addedTime : null,
    player: player || null,
    detail: detail || null,
    playerId: playerId || null,
    assist: assist || null,
    playerOff: playerOff || null,
    playerOffId: playerOffId || null,
  };
}

// An event as lists carry it: the fields documented for lists, nothing more.
export function listEvent(e) {
  return { type: e.type, side: e.side, minute: e.minute, addedTime: e.addedTime, player: e.player, detail: e.detail };
}

export const POSITION = Object.freeze({
  GOALKEEPER: "goalkeeper",
  DEFENDER: "defender",
  MIDFIELDER: "midfielder",
  FORWARD: "forward",
});

// One player in a line-up. `grid` places a starter on the pitch: `row` 1 is
// the goalkeeper's line, counting forward; `col` 1 is at the team's left.
export function makeLineupPlayer({ id = null, name, number = null, position = null, grid = null }) {
  return {
    id: id || null,
    name: String(name ?? ""),
    number: Number.isInteger(number) ? number : null,
    position: Object.values(POSITION).includes(position) ? position : null,
    grid: grid && Number.isInteger(grid.row) && Number.isInteger(grid.col) ? { row: grid.row, col: grid.col } : null,
  };
}

export function makeLineup({ formation = null, coach = null, starters = [], substitutes = [] }) {
  return { formation: formation || null, coach: coach || null, starters, substitutes };
}

// How a statistic's numbers read.
export const STAT_FORMAT = Object.freeze({ COUNT: "count", PERCENT: "percent", DECIMAL: "decimal" });

// Team statistics in the order clients show them, and how each reads.
export const STATS = Object.freeze([
  ["possession", STAT_FORMAT.PERCENT],
  ["expected_goals", STAT_FORMAT.DECIMAL],
  ["shots", STAT_FORMAT.COUNT],
  ["shots_on_target", STAT_FORMAT.COUNT],
  ["shots_off_target", STAT_FORMAT.COUNT],
  ["shots_blocked", STAT_FORMAT.COUNT],
  ["shots_inside_box", STAT_FORMAT.COUNT],
  ["shots_outside_box", STAT_FORMAT.COUNT],
  ["corners", STAT_FORMAT.COUNT],
  ["offsides", STAT_FORMAT.COUNT],
  ["fouls", STAT_FORMAT.COUNT],
  ["free_kicks", STAT_FORMAT.COUNT],
  ["saves", STAT_FORMAT.COUNT],
  ["passes", STAT_FORMAT.COUNT],
  ["passes_accurate", STAT_FORMAT.COUNT],
  ["pass_accuracy", STAT_FORMAT.PERCENT],
  ["yellow_cards", STAT_FORMAT.COUNT],
  ["red_cards", STAT_FORMAT.COUNT],
]);

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
