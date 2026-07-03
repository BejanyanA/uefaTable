import { renderTable, renderInstances } from './leagueViews/tableCore.js';
import { clubConfig } from './leagueViews/config.js';

export function renderLeagueTable(data) {
  return renderTable(data, clubConfig);
}

export function renderLeagueInstances(instanceData, options = {}) {
  return renderInstances(instanceData, options, clubConfig);
}
