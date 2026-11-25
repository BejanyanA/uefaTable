// API-Sports as a live data provider.
//
// Every provider folder exports these same functions, and each answers in our
// model (see ../../model.js) together with what is left of the day's
// allowance: { matches, competitions, quota }.

import { ProviderError, request } from "./client.js";
import { fixtureRef, mapFixtures } from "./map.js";

export { ProviderError };

// Their "by ids" call takes at most this many matches.
const IDS_PER_CALL = 20;

async function fixtures(env, params) {
  const { items, quota } = await request(env, "/fixtures", params);
  return { ...mapFixtures(items), quota };
}

// Every match of one UTC calendar date ("2026-11-25"), all competitions.
export function getMatchesByDate(env, { date }) {
  return fixtures(env, { date, timezone: "UTC" });
}

// Every match in play right now, with its goals and cards.
export function getLiveMatches(env) {
  return fixtures(env, { live: "all" });
}

// The current state of a few known matches (one call for up to 20 of them).
export async function getMatchesByIds(env, { ids }) {
  const refs = ids.map(fixtureRef).filter(Boolean).slice(0, IDS_PER_CALL);
  if (refs.length === 0) return { matches: [], competitions: {}, quota: null };
  return fixtures(env, { ids: refs.join("-") });
}

export const MAX_IDS_PER_CALL = IDS_PER_CALL;
