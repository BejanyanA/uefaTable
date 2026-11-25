// The competitions this site features, with our own keys.
//
// The order of this list is the order clients show them in: the owner chose
// Champions League first and World Cup right before EURO. Our keys appear in
// addresses and menus, so they never change, whichever data provider we use.
// Each provider keeps its own references to these keys in its own folder.

import { makeCompetition } from "./model.js";

const LOGOS = "https://uefaresults.com/assets/league_logos/";

const SPAIN = { name: "Spain" };
const ENGLAND = { name: "England" };
const FRANCE = { name: "France" };
const ITALY = { name: "Italy" };
const GERMANY = { name: "Germany" };
const NETHERLANDS = { name: "Netherlands" };

const LIST = [
  { key: "champions-league", name: "Champions League", kind: "cup", country: null, logo: "championsLeague.png", hasStandings: true },

  { key: "la-liga", name: "La Liga", kind: "league", country: SPAIN, logo: "laliga.png", hasStandings: true },
  { key: "spanish-super-cup", name: "Super Cup", kind: "cup", country: SPAIN, logo: "spanishSuperCup.png" },
  { key: "copa-del-rey", name: "Copa del Rey", kind: "cup", country: SPAIN, logo: "copaDelRey.png" },

  { key: "premier-league", name: "Premier League", kind: "league", country: ENGLAND, logo: "premierLeague.png", hasStandings: true },
  { key: "community-shield", name: "Community Shield", kind: "cup", country: ENGLAND, logo: "communityShield.png" },
  { key: "fa-cup", name: "FA Cup", kind: "cup", country: ENGLAND, logo: "englandFaCup.png" },

  { key: "ligue-1", name: "Ligue 1", kind: "league", country: FRANCE, logo: "frenchLigue1.png", hasStandings: true },
  { key: "trophee-des-champions", name: "Trophée des Champions", kind: "cup", country: FRANCE, logo: "tropheeDesChampions.png" },
  { key: "coupe-de-france", name: "Coupe de France", kind: "cup", country: FRANCE, logo: "coupeDeFrance.png" },

  { key: "serie-a", name: "Serie A", kind: "league", country: ITALY, logo: "serieA.png", hasStandings: true },
  { key: "italian-super-cup", name: "Super Cup", kind: "cup", country: ITALY, logo: "italianSuperCup.png" },
  { key: "coppa-italia", name: "Coppa Italia", kind: "cup", country: ITALY, logo: "coppaItalia.png" },

  { key: "bundesliga", name: "Bundesliga", kind: "league", country: GERMANY, logo: "bundesliga.png", hasStandings: true },
  { key: "german-super-cup", name: "Super Cup", kind: "cup", country: GERMANY, logo: "germanySuperCup.png" },
  { key: "dfb-pokal", name: "DFB Pokal", kind: "cup", country: GERMANY, logo: "germanyDfbCup.png" },

  { key: "eredivisie", name: "Eredivisie", kind: "league", country: NETHERLANDS, logo: "eredivisie.png", hasStandings: true },
  { key: "dutch-super-cup", name: "Super Cup", kind: "cup", country: NETHERLANDS, logo: "nethSuperCup.png" },
  { key: "knvb-beker", name: "KNVB Beker", kind: "cup", country: NETHERLANDS, logo: "knvbBeker.png" },

  { key: "europa-league", name: "Europa League", kind: "cup", country: null, logo: "europaLeague.png", hasStandings: true },
  { key: "world-cup", name: "World Cup", kind: "national", country: null, logo: "worldCup.png", hasStandings: true },
  { key: "euro", name: "EURO", kind: "national", country: null, logo: "euro.png", hasStandings: true },
  { key: "confederations-cup", name: "Confederations Cup", kind: "national", country: null, logo: "confederationsCup.png", hasStandings: true },
  { key: "nations-league", name: "Nations League", kind: "national", country: null, logo: "nationsLeague.png", hasStandings: true },
];

export const FEATURED = Object.freeze(
  LIST.map((c) => Object.freeze(makeCompetition({ ...c, logo: LOGOS + c.logo, featured: true })))
);

const BY_KEY = new Map(FEATURED.map((c, index) => [c.key, { competition: c, index }]));

export function featuredCompetition(key) {
  return BY_KEY.get(key)?.competition || null;
}

// Position in the featured order, or -1 for a competition we do not feature.
export function featuredIndex(key) {
  return BY_KEY.has(key) ? BY_KEY.get(key).index : -1;
}
