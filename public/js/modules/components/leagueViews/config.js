import { renderLeagueOnlyKnockouts } from '../renderLeagueKnockout.js';
import { renderNationalOnlyKnockouts } from '../renderNationalKnockout.js';
import { getClubBackInstancesHash, getNationalBackInstancesHash } from '../../router.js';
import { STORAGE_KEYS } from '../../../utils/storageKeys.js';

// Per-variant differences between the club (leagueType1) and national (leagueType2)
// leagues-list / instances / standings / matches pages. Everything else about these
// pages is identical, so this config is the entire surface a new variant would need.
export const clubConfig = {
  rootId: "leagueType1",
  routeSegment: "club",
  activeLeagueTabKey: STORAGE_KEYS.LAST_ACTIVE_LEAGUE_TAB,
  activeInstancesTabKey: "lastActiveInstancesTab",
  backBtnId: "backBtn",
  getGroupItems: (groupData) => groupData.clubs || [],
  teamNameField: "club_name",
  renderOnlyKnockouts: renderLeagueOnlyKnockouts,
  getBackInstancesHash: getClubBackInstancesHash,
  endpoints: {
    standings: "/standings",
    matches: "/matches",
    players: "/league-players",
    updateScore: "/update-score",
    attachPlayer: "/attach-players",
  },
};

export const nationalConfig = {
  rootId: "leagueType2",
  routeSegment: "national",
  activeLeagueTabKey: STORAGE_KEYS.LAST_ACTIVE_NATIONAL_LEAGUE_TAB,
  activeInstancesTabKey: "lastActiveNationalInstancesTab",
  backBtnId: "nationalBackBtn",
  getGroupItems: (groupData) => groupData.countries || [],
  teamNameField: "country_name",
  renderOnlyKnockouts: renderNationalOnlyKnockouts,
  getBackInstancesHash: getNationalBackInstancesHash,
  endpoints: {
    standings: "/national-standings",
    matches: "/national-matches",
    players: "/national-players",
    updateScore: "/update-national-score",
    attachPlayer: "/attach-national-players",
  },
};

// bannerId -> competition route segment. Identical for club and national in every
// reachable case (national pages only ever run with bannerId 3/4); the "else" branch
// is unreachable in practice since currentBannerId is always set to 1-4 upstream.
export function computeComp(bannerId) {
  return { 1: "ucl", 2: "uel", 3: "euro", 4: "wc" }[bannerId] ?? null;
}
