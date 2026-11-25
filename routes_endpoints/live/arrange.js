// Turns stored matches into what a client shows: which matches belong to the
// viewer's day, in which groups and in which order, and when to ask again.
//
// These are the rules every client would otherwise have to repeat, so they
// live here, once. Pure functions: no fetch, no database, the time is passed in.

import { featuredIndex } from "./competitions.js";
import { isInPlay, isOver, LIST_EVENTS, PHASE } from "./model.js";

const SECOND = 1000;
const MINUTE = 60 * SECOND;

// How long a client waits between two score refreshes while a match is on.
export const LIVE_REFRESH_SECONDS = 15;
// How long a client waits before asking for the whole day again.
const DAY_REFRESH_SECONDS = 600;
// A match is expected to be in play from shortly before its kick-off until
// well after it, even if our stored copy still says "scheduled".
const KICKOFF_LEAD_MS = 5 * MINUTE;
const LONGEST_MATCH_MS = 4 * 60 * MINUTE;

export function kickoffMs(match) {
  return Date.parse(match.kickoff);
}

// Matches that kicked off before the viewer's day began but are still being
// played (or ended minutes ago) belong to the start of today too: at 00:10 a
// match that kicked off at 23:30 is still the match people are watching.
// Only for "today", and only for as long as a match can last.
export function stillRunningFromBefore(liveMatches, { start }, now) {
  if (now - start > LONGEST_MATCH_MS) return [];
  return liveMatches.filter((m) => {
    const t = kickoffMs(m);
    return t < start && t >= start - LONGEST_MATCH_MS;
  });
}

export function matchesInWindow(matches, { start, end }) {
  return matches.filter((m) => {
    const t = kickoffMs(m);
    return t >= start && t < end;
  });
}

// Replace stored matches with fresher copies of the same match, where we have one.
export function overlay(matches, fresherById) {
  if (!fresherById || fresherById.size === 0) return matches;
  return matches.map((m) => fresherById.get(m.id) || m);
}

// Could this match be in play right now, judging by what we have stored?
export function mayBeInPlay(match, now) {
  if (isInPlay(match)) return true;
  if (match.phase !== PHASE.SCHEDULED && match.phase !== PHASE.UNKNOWN) return false;
  const t = kickoffMs(match);
  return now >= t - KICKOFF_LEAD_MS && now <= t + LONGEST_MATCH_MS;
}

// List endpoints carry only goals and red cards; everything else is for the
// match details endpoint.
export function forList(match) {
  if (!Array.isArray(match.events)) return match;
  return { ...match, events: match.events.filter((e) => LIST_EVENTS.has(e.type)) };
}

// One shared collator: making one per comparison is slow.
const collator = new Intl.Collator("en", { sensitivity: "base" });

function compareText(a, b) {
  return collator.compare(a, b);
}

// Featured competitions first, in the site's order. Then international ones,
// then the rest by country and name.
function compareCompetitions(a, b) {
  const fa = featuredIndex(a.key);
  const fb = featuredIndex(b.key);
  if (fa !== -1 || fb !== -1) {
    if (fa === -1) return 1;
    if (fb === -1) return -1;
    return fa - fb;
  }
  const ca = a.country?.name || "";
  const cb = b.country?.name || "";
  if (ca !== cb) {
    if (!ca) return -1;
    if (!cb) return 1;
    return compareText(ca, cb);
  }
  return compareText(a.name, b.name) || compareText(a.key, b.key);
}

// Inside a competition matches stay in kick-off order, so a row never moves
// when its state changes.
function compareMatches(a, b) {
  return kickoffMs(a) - kickoffMs(b) || compareText(a.id, b.id);
}

export function groupByCompetition(matches, competitions) {
  const groups = new Map();
  for (const match of matches) {
    const competition = competitions[match.competition];
    if (!competition) continue;
    if (!groups.has(competition.key)) groups.set(competition.key, { competition, matches: [] });
    const { competition: _key, ...row } = forList(match);
    groups.get(competition.key).matches.push(row);
  }
  const list = [...groups.values()];
  list.sort((a, b) => compareCompetitions(a.competition, b.competition));
  for (const group of list) group.matches.sort(compareMatches);
  return list;
}

// When a client should ask for the whole day again.
export function dayRefreshSeconds(matches, now) {
  if (matches.length > 0 && matches.every(isOver)) return null;
  const next = matches
    .filter((m) => m.phase === PHASE.SCHEDULED)
    .map((m) => kickoffMs(m) - KICKOFF_LEAD_MS - now)
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b)[0];
  if (next === undefined) return DAY_REFRESH_SECONDS;
  return Math.max(30, Math.min(DAY_REFRESH_SECONDS, Math.ceil(next / SECOND)));
}
