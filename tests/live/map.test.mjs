// The provider's answers must come out in our own words. A second provider
// has to pass the same checks on the model.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapFixtures, mapStatus, matchId, fixtureRef } from "../../routes_endpoints/live/providers/api-sports/map.js";
import { PHASE, PERIOD, DECIDED_BY, EVENT } from "../../routes_endpoints/live/model.js";

const sample = (name) => JSON.parse(readFileSync(new URL(`../../routes_endpoints/live/providers/api-sports/samples/${name}.json`, import.meta.url), "utf8"));
const byId = (list, id) => list.find((m) => m.id === id);

test("every status code maps to one of our phases", () => {
  assert.deepEqual(mapStatus("NS"), { phase: PHASE.SCHEDULED, period: null, decidedBy: null });
  assert.deepEqual(mapStatus("1H"), { phase: PHASE.LIVE, period: PERIOD.FIRST_HALF, decidedBy: null });
  assert.deepEqual(mapStatus("HT"), { phase: PHASE.BREAK, period: PERIOD.HALF_TIME, decidedBy: null });
  assert.deepEqual(mapStatus("P"), { phase: PHASE.LIVE, period: PERIOD.PENALTIES, decidedBy: null });
  assert.deepEqual(mapStatus("FT"), { phase: PHASE.FINISHED, period: null, decidedBy: DECIDED_BY.REGULAR });
  assert.deepEqual(mapStatus("AET"), { phase: PHASE.FINISHED, period: null, decidedBy: DECIDED_BY.EXTRA_TIME });
  assert.deepEqual(mapStatus("PEN"), { phase: PHASE.FINISHED, period: null, decidedBy: DECIDED_BY.PENALTIES });
  assert.equal(mapStatus("PST").phase, PHASE.POSTPONED);
  assert.equal(mapStatus("CANC").phase, PHASE.CANCELLED);
  assert.equal(mapStatus("SUSP").phase, PHASE.SUSPENDED);
  assert.equal(mapStatus("ABD").phase, PHASE.ABANDONED);
});

test("a status we have never seen becomes 'unknown', not an error", () => {
  assert.equal(mapStatus("SOMETHING_NEW").phase, PHASE.UNKNOWN);
  assert.equal(mapStatus(undefined).phase, PHASE.UNKNOWN);
});

test("match ids are ours and convert back", () => {
  assert.equal(matchId(1635718), "m_1635718");
  assert.equal(fixtureRef("m_1635718"), "1635718");
  assert.equal(fixtureRef("1635718"), null);
  assert.equal(fixtureRef("m_1; DROP"), null);
});

test("a day's matches: shape, phases and scores", () => {
  const { matches, competitions } = mapFixtures(sample("date"));
  assert.equal(matches.length, 6);

  const live = byId(matches, "m_1635718");
  assert.equal(live.competition, "champions-league");
  assert.equal(live.kickoff, "2026-11-25T17:45:00Z");
  assert.equal(live.phase, PHASE.LIVE);
  assert.equal(live.period, PERIOD.FIRST_HALF);
  assert.equal(typeof live.minute, "number");
  assert.equal(live.home.team.name, "Sabah FA");
  assert.equal(live.home.team.id.startsWith("t_"), true);
  assert.equal(live.home.score, 0);
  assert.equal(live.away.score, 1);
  assert.equal(live.round, "League Stage - 5");
  assert.equal("events" in live, false, "a day list has no events");

  const finished = byId(matches, "m_1649153");
  assert.equal(finished.phase, PHASE.FINISHED);
  assert.equal(finished.decidedBy, DECIDED_BY.REGULAR);
  assert.equal(finished.minute, null, "a finished match has no minute");
  assert.equal(finished.home.winner, false);
  assert.equal(finished.away.winner, true);

  const upcoming = byId(matches, "m_1611803");
  assert.equal(upcoming.phase, PHASE.SCHEDULED);
  assert.equal(upcoming.home.score, null);
  assert.equal(upcoming.home.winner, null);

  assert.equal(byId(matches, "m_1649631").phase, PHASE.POSTPONED);

  const pens = byId(matches, "m_1650137");
  assert.equal(pens.decidedBy, DECIDED_BY.PENALTIES);
  assert.deepEqual([pens.home.score, pens.away.score], [2, 2]);
  assert.deepEqual([pens.home.penalties, pens.away.penalties], [4, 3]);
  assert.equal(pens.home.winner, true);

  for (const m of matches) assert.ok(competitions[m.competition], `competition of ${m.id} is listed`);
});

test("featured competitions keep our name and logo; others come from the provider", () => {
  const { competitions } = mapFixtures(sample("date"));
  const ucl = competitions["champions-league"];
  assert.equal(ucl.name, "Champions League");
  assert.equal(ucl.featured, true);
  assert.equal(ucl.country, null);
  assert.match(ucl.logo, /^https:\/\/uefaresults\.com\/assets\/league_logos\//);

  const other = Object.values(competitions).find((c) => !c.featured && c.country);
  assert.match(other.key, /^c_\d+$/);
  assert.equal(typeof other.country.name, "string");

  const international = Object.values(competitions).find((c) => !c.featured && !c.country);
  assert.ok(international, "an international competition has no country");
});

test("live matches carry goals and cards in our words", () => {
  const { matches } = mapFixtures(sample("live"));
  assert.equal(matches.length, 4);
  const types = new Set(matches.flatMap((m) => m.events.map((e) => e.type)));
  for (const t of [EVENT.GOAL, EVENT.OWN_GOAL, EVENT.PENALTY_GOAL, EVENT.RED_CARD, EVENT.YELLOW_CARD, EVENT.SUBSTITUTION]) {
    assert.ok(types.has(t), `sample has a ${t}`);
  }
  const known = new Set(Object.values(EVENT));
  for (const m of matches) {
    for (const e of m.events) {
      assert.ok(known.has(e.type));
      assert.ok(e.side === "home" || e.side === "away");
      assert.equal(typeof e.minute, "number");
    }
  }
});

test("nothing of the provider's vocabulary leaks into the model", () => {
  const out = JSON.stringify([mapFixtures(sample("date")), mapFixtures(sample("live"))]);
  for (const word of ['"fixture"', '"league"', '"short"', '"elapsed"', '"timestamp"', '"subst"', "Normal Goal"]) {
    assert.equal(out.includes(word), false, `${word} must not appear`);
  }
});

test("one unreadable item does not lose the rest", () => {
  const items = [...sample("date"), { broken: true }, null];
  assert.equal(mapFixtures(items).matches.length, 6);
});
