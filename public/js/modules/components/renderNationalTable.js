import { renderTable, renderInstances } from './leagueViews/tableCore.js';
import { nationalConfig } from './leagueViews/config.js';

export function renderNationalTable(data) {
  return renderTable(data, nationalConfig);
}

export function renderNationalInstances(instanceData, options = {}) {
  return renderInstances(instanceData, options, nationalConfig);
}
