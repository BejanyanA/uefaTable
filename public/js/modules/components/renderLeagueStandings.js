import { renderGroupStandingsPage } from './leagueViews/standingsCore.js';
import { clubConfig } from './leagueViews/config.js';

export function renderLeagueGroupStandingsPage(leagueId, groupId, groupNameOrOpts, opts = {}) {
  return renderGroupStandingsPage(leagueId, groupId, groupNameOrOpts, opts, clubConfig);
}
