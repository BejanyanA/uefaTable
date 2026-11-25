// API-Sports league ids for the competitions this site features.
// Our key -> their id. A competition missing here is still shown, as a
// non-featured one, under a key made from its id.

const REFS = {
  "champions-league": 2,
  "la-liga": 140,
  "spanish-super-cup": 556,
  "copa-del-rey": 143,
  "premier-league": 39,
  "community-shield": 528,
  "fa-cup": 45,
  "ligue-1": 61,
  "trophee-des-champions": 526,
  "coupe-de-france": 66,
  "serie-a": 135,
  "italian-super-cup": 547,
  "coppa-italia": 137,
  "bundesliga": 78,
  "german-super-cup": 529,
  "dfb-pokal": 81,
  "eredivisie": 88,
  "dutch-super-cup": 543,
  "knvb-beker": 90,
  "europa-league": 3,
  "world-cup": 1,
  "euro": 4,
  "confederations-cup": 21,
  "nations-league": 5,
};

const KEY_BY_REF = new Map(Object.entries(REFS).map(([key, ref]) => [ref, key]));

// Our competition key for one of their league ids.
export function competitionKey(leagueId) {
  return KEY_BY_REF.get(leagueId) || `c_${leagueId}`;
}

export function isFeaturedRef(leagueId) {
  return KEY_BY_REF.has(leagueId);
}
