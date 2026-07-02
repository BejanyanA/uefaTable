import { renderGroupStandingsPage } from './leagueViews/standingsCore.js';
import { nationalConfig } from './leagueViews/config.js';

export function renderNationalGroupStandingsPage(leagueId, groupId, groupNameOrOpts, opts = {}) {
  return renderGroupStandingsPage(leagueId, groupId, groupNameOrOpts, opts, nationalConfig);
}
