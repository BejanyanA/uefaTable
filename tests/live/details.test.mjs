// Match details: the provider's answer in our own words, and the rules the
// details answer follows. Checked against a real saved answer.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapMatchDetails } from "../../routes_endpoints/live/providers/api-sports/map.js";
import { DETAILS_FRESH, detailsAnswer, detailsFreshFor, detailsRefreshSeconds, markPlayers } from "../../routes_endpoints/live/details.js";
import { forList } from "../../routes_endpoints/live/arrange.js";
import { EVENT, PHASE, POSITION, VAR_DECISION } from "../../routes_endpoints/live/model.js";

const samples = JSON.parse(readFileSync(new URL("../../routes_endpoints/live/providers/api-sports/samples/details.json", import.meta.url), "utf8"));
const finished = () => mapMatchDetails(samples[0]);
const scheduled = () => mapMatchDetails(samples[1]);
const MIN = 60 * 1000;

test("a finished match: score, half-time, venue and referee", () => {
  const { match, competition, details } = finished();
  assert.equal(match.id, "m_1635682");
  assert.equal(competition.key, "champions-league");
  assert.equal(match.phase, PHASE.FINISHED);
  assert.deepEqual(details.halfTime, { home: 0, away: 1 });
  assert.deepEqual(details.venue, { name: "Stade Pierre-Mauroy", city: "Lille" });
  assert.equal(details.referee, "Marco Guida");
});

test("events: every kind in our words, with player ids", () => {
  const { events } = finished().match;
  const goal = events.find((e) => e.type === EVENT.GOAL);
  assert.equal(goal.side, "away");
  assert.equal(goal.minute, 15);
  assert.equal(goal.playerId, "p_1149");
  assert.equal(goal.assist, "Tom Bischof");

  // An own goal counts for the team it was scored for.
  const own = events.find((e) => e.type === EVENT.OWN_GOAL);
  assert.equal(own.side, "home");
  assert.equal(own.assist, null);

  const check = events.find((e) => e.type === EVENT.VAR);
  assert.equal(check.detail, VAR_DECISION.GOAL_CANCELLED);

  const late = events.filter((e) => e.minute === 90);
  assert.ok(late.every((e) => e.addedTime === 2));
});

test("a substitution names the player coming on and the one going off", () => {
  const { match, details } = finished();
  const starters = new Set(details.lineups.away.starters.map((p) => p.id));
  const sub = match.events.find((e) => e.type === EVENT.SUBSTITUTION && e.side === "away");
  assert.equal(sub.player, "Jamal Musiala");
  assert.equal(sub.playerOff, "Tom Bischof");
  assert.equal(starters.has(sub.playerOffId), true, "the player going off started");
  assert.equal(starters.has(sub.playerId), false, "the player coming on did not");
});

test("line-ups: formation, coach, positions and places on the pitch", () => {
  const { home } = finished().details.lineups;
  assert.equal(home.formation, "4-3-3");
  assert.equal(home.coach, "Davide Ancelotti");
  assert.equal(home.starters.length, 11);
  assert.equal(home.substitutes.length, 12);
  const keeper = home.starters[0];
  assert.equal(keeper.position, POSITION.GOALKEEPER);
  assert.deepEqual(keeper.grid, { row: 1, col: 1 });
  assert.equal(home.substitutes.every((p) => p.grid === null), true);
});

test("statistics: our keys, in order, as numbers", () => {
  const stats = finished().details.statistics;
  assert.deepEqual(stats[0], { key: "possession", format: "percent", home: 35, away: 65 });
  assert.deepEqual(stats[1], { key: "expected_goals", format: "decimal", home: 2.15, away: 1.19 });
  assert.equal(stats.every((s) => typeof s.home === "number" && typeof s.away === "number"), true);
  assert.equal(stats.some((s) => s.key === "pass_accuracy"), false, "a row both teams lack is left out");
});

test("a match not started yet has no line-ups, statistics or events", () => {
  const { match, details } = scheduled();
  assert.equal(match.phase, PHASE.SCHEDULED);
  assert.equal(details.lineups, null);
  assert.deepEqual(details.statistics, []);
  assert.deepEqual(match.events, []);
  assert.equal(details.halfTime, null);
});

test("players carry what they did in the match", () => {
  const { match, details } = finished();
  const away = markPlayers(details.lineups.away, match.events);
  const byName = (name) => [...away.starters, ...away.substitutes].find((p) => p.name.includes(name));
  assert.equal(byName("Upamecano").goals, 1);
  assert.equal(byName("Laimer").card, "yellow");
  assert.equal(byName("Pavlovi").ownGoals, 1);
  assert.equal(byName("Bischof").offAt, 76);
  assert.equal(byName("Musiala").onAt, 76);
  assert.equal(byName("Urbig").goals, 0);
});

test("the live list's newer score and events win over the stored details", () => {
  const stored = finished();
  stored.match.phase = PHASE.LIVE;
  const fresher = { ...stored.match, minute: 88, home: { ...stored.match.home, score: 3 }, events: stored.match.events.slice(0, 2) };
  const answer = detailsAnswer(stored, fresher);
  assert.equal(answer.match.minute, 88);
  assert.equal(answer.match.home.score, 3);
  assert.equal(answer.match.events.length, 2);
  assert.equal(answer.match.competition, "champions-league");
  assert.equal(answer.statistics.length > 0, true, "statistics stay from the stored details");
});

test("how long details stay fresh, and when clients ask again", () => {
  const now = Date.parse("2026-11-26T12:00:00Z");
  const at = (minutes) => new Date(now + minutes * MIN).toISOString();
  assert.equal(detailsFreshFor({ phase: PHASE.FINISHED, kickoff: at(-200) }, now), DETAILS_FRESH.over);
  assert.equal(detailsFreshFor({ phase: PHASE.LIVE, kickoff: at(-30) }, now), DETAILS_FRESH.inPlay);
  assert.equal(detailsFreshFor({ phase: PHASE.SCHEDULED, kickoff: at(60) }, now), DETAILS_FRESH.lineupWindow);
  assert.equal(detailsFreshFor({ phase: PHASE.SCHEDULED, kickoff: at(600) }, now), DETAILS_FRESH.ahead);

  assert.equal(detailsRefreshSeconds({ phase: PHASE.FINISHED, kickoff: at(-200) }, now, 15), null);
  assert.equal(detailsRefreshSeconds({ phase: PHASE.LIVE, kickoff: at(-30) }, now, 15), 15);
  assert.equal(detailsRefreshSeconds({ phase: PHASE.SCHEDULED, kickoff: at(60) }, now, 15), 120);
  assert.equal(detailsRefreshSeconds({ phase: PHASE.SCHEDULED, kickoff: at(600) }, now, 15), 1800);
});

test("lists keep only their documented event fields", () => {
  const { match } = finished();
  const row = forList(match);
  for (const e of row.events) {
    assert.deepEqual(Object.keys(e), ["type", "side", "minute", "addedTime", "player", "detail"]);
    assert.ok([EVENT.GOAL, EVENT.OWN_GOAL, EVENT.PENALTY_GOAL, EVENT.RED_CARD].includes(e.type));
  }
});
