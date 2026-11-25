import test from "node:test";
import assert from "node:assert/strict";
import { dayRefreshSeconds, forList, groupByCompetition, matchesInWindow, mayBeInPlay, overlay, stillRunningFromBefore } from "../../routes_endpoints/live/arrange.js";
import { FEATURED } from "../../routes_endpoints/live/competitions.js";
import { makeCompetition, makeMatch, makeSide, makeTeam, PHASE } from "../../routes_endpoints/live/model.js";

const side = (name) => makeSide({ team: makeTeam({ id: `t_${name}`, name }) });
const match = (id, competition, kickoff, phase = PHASE.SCHEDULED, extra = {}) =>
  makeMatch({ id, competition, kickoff, phase, home: side("A"), away: side("B"), ...extra });
const comp = (key, name, country) => makeCompetition({ key, name, country: country ? { name: country } : null });

const featured = Object.fromEntries(FEATURED.map((c) => [c.key, c]));
const competitions = {
  ...featured,
  c_1: comp("c_1", "Premier League", "Armenia"),
  c_2: comp("c_2", "Serie B", "Brazil"),
  c_3: comp("c_3", "AFC Champions League", null),
};

test("only matches that kick off inside the viewer's day are kept", () => {
  const window = { start: Date.parse("2026-11-24T20:00:00Z"), end: Date.parse("2026-11-25T20:00:00Z") };
  const list = [
    match("m_1", "c_1", "2026-11-24T19:59:00Z"),
    match("m_2", "c_1", "2026-11-24T20:00:00Z"),
    match("m_3", "c_1", "2026-11-25T19:59:00Z"),
    match("m_4", "c_1", "2026-11-25T20:00:00Z"),
  ];
  assert.deepEqual(matchesInWindow(list, window).map((m) => m.id), ["m_2", "m_3"]);
});

test("our competitions come first in the site's order, then international, then by country", () => {
  const list = [
    match("m_1", "c_2", "2026-11-25T10:00:00Z"),
    match("m_2", "c_1", "2026-11-25T10:00:00Z"),
    match("m_3", "europa-league", "2026-11-25T10:00:00Z"),
    match("m_4", "c_3", "2026-11-25T10:00:00Z"),
    match("m_5", "premier-league", "2026-11-25T10:00:00Z"),
    match("m_6", "champions-league", "2026-11-25T10:00:00Z"),
    match("m_7", "euro", "2026-11-25T10:00:00Z"),
    match("m_8", "world-cup", "2026-11-25T10:00:00Z"),
  ];
  const keys = groupByCompetition(list, competitions).map((g) => g.competition.key);
  assert.deepEqual(keys, ["champions-league", "premier-league", "europa-league", "world-cup", "euro", "c_3", "c_1", "c_2"]);
});

test("inside a competition matches stay in kick-off order whatever their state", () => {
  const list = [
    match("m_3", "c_1", "2026-11-25T18:00:00Z", PHASE.LIVE),
    match("m_1", "c_1", "2026-11-25T12:00:00Z", PHASE.FINISHED),
    match("m_2", "c_1", "2026-11-25T15:00:00Z", PHASE.SCHEDULED),
  ];
  const [group] = groupByCompetition(list, competitions);
  assert.deepEqual(group.matches.map((m) => m.id), ["m_1", "m_2", "m_3"]);
  assert.equal("competition" in group.matches[0], false, "the group already names the competition");
});

test("a fresher copy of a match replaces the stored one", () => {
  const stored = [match("m_1", "c_1", "2026-11-25T18:00:00Z"), match("m_2", "c_1", "2026-11-25T18:00:00Z")];
  const fresher = new Map([["m_2", match("m_2", "c_1", "2026-11-25T18:00:00Z", PHASE.LIVE)]]);
  assert.deepEqual(overlay(stored, fresher).map((m) => m.phase), [PHASE.SCHEDULED, PHASE.LIVE]);
});

test("a match may be in play from just before kick-off, even if stored as scheduled", () => {
  const kickoff = Date.parse("2026-11-25T18:00:00Z");
  const m = match("m_1", "c_1", "2026-11-25T18:00:00Z");
  assert.equal(mayBeInPlay(m, kickoff - 10 * 60000), false);
  assert.equal(mayBeInPlay(m, kickoff - 2 * 60000), true);
  assert.equal(mayBeInPlay(m, kickoff + 100 * 60000), true);
  assert.equal(mayBeInPlay(m, kickoff + 5 * 3600000), false);
  assert.equal(mayBeInPlay(match("m_2", "c_1", "2026-11-25T18:00:00Z", PHASE.FINISHED), kickoff + 60000), false);
  assert.equal(mayBeInPlay(match("m_3", "c_1", "2026-11-25T10:00:00Z", PHASE.BREAK), kickoff), true);
});

test("list answers carry goals and red cards only", () => {
  const events = [{ type: "goal" }, { type: "yellow_card" }, { type: "substitution" }, { type: "red_card" }, { type: "own_goal" }];
  const m = match("m_1", "c_1", "2026-11-25T18:00:00Z", PHASE.LIVE, { events });
  assert.deepEqual(forList(m).events.map((e) => e.type), ["goal", "red_card", "own_goal"]);
  assert.equal(m.events.length, 5, "the stored match is not changed");
});

test("when to ask for the day again", () => {
  const now = Date.parse("2026-11-25T12:00:00Z");
  const over = [match("m_1", "c_1", "2026-11-25T09:00:00Z", PHASE.FINISHED), match("m_2", "c_1", "2026-11-25T09:00:00Z", PHASE.POSTPONED)];
  assert.equal(dayRefreshSeconds(over, now), null, "a finished day never needs refreshing");
  assert.equal(dayRefreshSeconds([], now), 600);
  assert.equal(dayRefreshSeconds([match("m_1", "c_1", "2026-11-25T20:00:00Z")], now), 600);
  // Kick-off in 7 minutes: ask again 5 minutes before it, that is in 2 minutes.
  assert.equal(dayRefreshSeconds([match("m_1", "c_1", "2026-11-25T12:07:00Z")], now), 120);
  assert.equal(dayRefreshSeconds([match("m_1", "c_1", "2026-11-25T12:05:10Z")], now), 30, "never sooner than 30 seconds");
});

test("matches still on from before midnight belong to the start of today", () => {
  const window = { start: Date.parse("2026-11-26T00:00:00Z"), end: Date.parse("2026-11-27T00:00:00Z") };
  const live = [
    match("m_1", "c_1", "2026-11-25T23:30:00Z", PHASE.LIVE),     // kicked off 30 min before midnight
    match("m_2", "c_1", "2026-11-25T19:00:00Z", PHASE.LIVE),     // more than 4 hours before: not ours
    match("m_3", "c_1", "2026-11-26T00:10:00Z", PHASE.LIVE),     // already inside today
    match("m_4", "c_1", "2026-11-25T22:45:00Z", PHASE.FINISHED), // just ended
  ];
  const at = (iso) => stillRunningFromBefore(live, window, Date.parse(iso)).map((m) => m.id);
  assert.deepEqual(at("2026-11-26T00:20:00Z"), ["m_1", "m_4"]);
  assert.deepEqual(at("2026-11-26T05:00:00Z"), [], "late in the day nothing from yesterday is added");
});
