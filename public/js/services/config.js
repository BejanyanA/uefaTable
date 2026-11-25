// Which API the site talks to depends on where the site itself is opened.
//
//   uefaresults.com (and www)      -> production API
//   anything else                  -> dev API: dev.uefatable.pages.dev, other
//                                     branch previews, localhost
//
// So no code change is needed when a branch moves from dev to production.

const PRODUCTION_HOSTS = new Set(["uefaresults.com", "www.uefaresults.com"]);

const PRODUCTION_API = "https://api.uefaresults.com";
const DEV_API = "https://uefa-app-dev.bejanyanaper.workers.dev";

export const IS_PRODUCTION = PRODUCTION_HOSTS.has(window.location.hostname);

// Only on localhost: point the site at an API running on this machine
// (npm run dev:api) by running this once in the browser console:
//   localStorage.setItem("apiBase", "http://localhost:8787")
// and localStorage.removeItem("apiBase") to go back to the dev API.
function localOverride() {
  if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) return null;
  try {
    const value = localStorage.getItem("apiBase");
    return value && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export const API_BASE = IS_PRODUCTION ? PRODUCTION_API : (localOverride() || DEV_API);
