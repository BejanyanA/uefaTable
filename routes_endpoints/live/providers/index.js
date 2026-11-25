// Picks the live data provider. This is the only place that names one.
//
// To add a provider: a new folder here exporting the same functions as the
// existing one, a line in PROVIDERS, and LIVE_PROVIDER set in the Worker's
// configuration. Nothing outside this folder changes.

import * as apiSports from "./api-sports/index.js";

const PROVIDERS = {
  "api-sports": apiSports,
};

const DEFAULT = "api-sports";

export function getProvider(env) {
  return PROVIDERS[env.LIVE_PROVIDER] || PROVIDERS[DEFAULT];
}
