import { renderKnockoutBracket } from './knockout/core.js';
import { nationalStageAdapter, nationalOnlyKnockoutsAdapter } from './knockout/adapters.js';

export function renderNationalKnockoutsStage(leagueId, rootEl) {
  return renderKnockoutBracket(leagueId, rootEl, nationalStageAdapter);
}

export function renderNationalOnlyKnockouts(leagueId, rootEl) {
  return renderKnockoutBracket(leagueId, rootEl, nationalOnlyKnockoutsAdapter);
}
