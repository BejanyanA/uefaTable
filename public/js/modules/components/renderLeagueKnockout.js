import { renderKnockoutBracket } from './knockout/core.js';
import { clubStageAdapter, clubOnlyKnockoutsAdapter } from './knockout/adapters.js';

export function renderLeagueKnockoutsStage(leagueId, rootEl) {
  return renderKnockoutBracket(leagueId, rootEl, clubStageAdapter);
}

export function renderLeagueOnlyKnockouts(leagueId, rootEl) {
  return renderKnockoutBracket(leagueId, rootEl, clubOnlyKnockoutsAdapter);
}
