// Turns a stored match with its details into the match details answer.
//
// Pure functions: no fetch, no database, the time is passed in. These are the
// rules every client would otherwise repeat (what each player did, when to
// ask again), so they live here, once.

import { EVENT, PHASE, isInPlay, isOver } from "./model.js";

const MINUTE = 60 * 1000;

// Line-ups are published about an hour before kick-off. From this long
// before, a match not started yet is asked about more often.
export const LINEUP_WINDOW_MS = 90 * MINUTE;

// How long the details of a match stay fresh in our stored copy.
//   in play       2 minutes (score, minute and events come from the live
//                 list in between, every 15 s)
//   lineup window 5 minutes, so line-ups show soon after they are published
//   ahead         60 minutes
//   over          24 hours (nothing changes any more)
export const DETAILS_FRESH = Object.freeze({
  inPlay: 2 * MINUTE,
  lineupWindow: 5 * MINUTE,
  ahead: 60 * MINUTE,
  over: 24 * 60 * MINUTE,
});

// What the details of a match are worth, by its state and the time.
export function detailsFreshFor(match, now) {
  if (!match) return DETAILS_FRESH.ahead;
  if (isOver(match)) return DETAILS_FRESH.over;
  if (isInPlay(match)) return DETAILS_FRESH.inPlay;
  const untilKickoff = Date.parse(match.kickoff) - now;
  // Past its kick-off but not yet in play: it may start any moment.
  if (untilKickoff <= LINEUP_WINDOW_MS) return DETAILS_FRESH.lineupWindow;
  return DETAILS_FRESH.ahead;
}

// When a client should ask again, in seconds; null when nothing will change.
export function detailsRefreshSeconds(match, now, liveSeconds) {
  if (isOver(match)) return null;
  if (isInPlay(match)) return liveSeconds;
  const untilKickoff = Date.parse(match.kickoff) - now;
  if (untilKickoff <= LINEUP_WINDOW_MS) return untilKickoff <= 5 * MINUTE ? liveSeconds : 120;
  return 30 * 60;
}

// What each player did, from the match's events, written onto the players:
//   goals, ownGoals   how many
//   card              "yellow", "red" or null (a second yellow is "red")
//   offAt, onAt       the minute they went off or came on, or null
export function markPlayers(lineup, events) {
  if (!lineup) return null;
  const marks = new Map();
  const markOf = (id) => {
    if (!marks.has(id)) marks.set(id, { goals: 0, ownGoals: 0, card: null, offAt: null, onAt: null });
    return marks.get(id);
  };
  for (const e of events || []) {
    if (e.type === EVENT.GOAL || e.type === EVENT.PENALTY_GOAL) {
      if (e.playerId) markOf(e.playerId).goals += 1;
    } else if (e.type === EVENT.OWN_GOAL) {
      if (e.playerId) markOf(e.playerId).ownGoals += 1;
    } else if (e.type === EVENT.YELLOW_CARD) {
      if (e.playerId) {
        const m = markOf(e.playerId);
        if (m.card === null) m.card = "yellow";
      }
    } else if (e.type === EVENT.RED_CARD) {
      if (e.playerId) markOf(e.playerId).card = "red";
    } else if (e.type === EVENT.SUBSTITUTION) {
      if (e.playerOffId) markOf(e.playerOffId).offAt = e.minute;
      if (e.playerId) markOf(e.playerId).onAt = e.minute;
    }
  }
  const withMarks = (p) => ({ ...p, ...(p.id && marks.has(p.id) ? marks.get(p.id) : { goals: 0, ownGoals: 0, card: null, offAt: null, onAt: null }) });
  return { ...lineup, starters: lineup.starters.map(withMarks), substitutes: lineup.substitutes.map(withMarks) };
}

// Events in the order they happened. The provider's order is kept for events
// in the same minute.
function inOrder(events) {
  return (events || [])
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.minute ?? 0) - (b.e.minute ?? 0) || (a.e.addedTime ?? 0) - (b.e.addedTime ?? 0) || a.i - b.i)
    .map(({ e }) => e);
}

// The answer of GET /live/v1/matches/{id}. `fresher` is the same match from
// the live list when it is newer than the stored details (score, minute and
// events every 15 s).
export function detailsAnswer({ match, competition, details }, fresher = null) {
  const current = fresher ? { ...match, ...fresher, competition: match.competition } : match;
  const events = inOrder(fresher && Array.isArray(fresher.events) ? fresher.events : match.events);
  const lineups = details.lineups
    ? { home: markPlayers(details.lineups.home, events), away: markPlayers(details.lineups.away, events) }
    : null;
  return {
    match: { ...current, events },
    competition,
    venue: details.venue,
    referee: details.referee,
    halfTime: current.phase === PHASE.SCHEDULED ? null : details.halfTime,
    lineups,
    statistics: details.statistics,
  };
}
