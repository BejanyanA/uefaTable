// Single source of truth for the localStorage keys used to persist auth/session
// state. Prevents the session-invalidation cleanup list from drifting between
// api.js, AuthManager.js, CustomLeagues.js and MeHomepage.js.
export const STORAGE_KEYS = {
  AUTH_TOKEN: "authToken",
  USER: "user",
  LEAGUES_ACTIVE_TAB: "leaguesActiveTab",
  LAST_ACTIVE_LEAGUE_TAB: "lastActiveLeagueTab",
  LAST_ACTIVE_NATIONAL_LEAGUE_TAB: "lastActiveNationalLeagueTab",
  CURRENT_BANNER_ID: "currentBannerId",
  LEAGUE_ID: "leagueId",
  SELECTED_STAGE_TYPE: "selectedStageType",
};

// Cleared whenever the current session becomes invalid: a 401 response, a
// failed login, or a failed /me check.
export const AUTH_SESSION_KEYS = Object.values(STORAGE_KEYS);

export function clearAuthSession() {
  AUTH_SESSION_KEYS.forEach(key => localStorage.removeItem(key));
}

export function clearActiveLeagueTabs() {
  localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE_LEAGUE_TAB);
  localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE_NATIONAL_LEAGUE_TAB);
}
