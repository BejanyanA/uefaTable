// The only file on the website that knows the Live API's addresses.
// The contract is docs/live-api.md. Every function resolves (never throws) to
//   { ok: true, data, meta }   or   { ok: false, error }
// where `error` is one of the API's stable codes, or "offline" / "timeout".

import { API_BASE } from "../services/config.js";

const TIMEOUT_MS = 12000;

async function get(path, params = {}) {
  const url = new URL(API_BASE + path);
  for (const [name, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") url.searchParams.set(name, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (body && body.success === true) return { ok: true, data: body.data, meta: body.meta || {} };
    return { ok: false, error: (body && body.error) || "unavailable" };
  } catch (err) {
    return { ok: false, error: err && err.name === "AbortError" ? "timeout" : "offline" };
  } finally {
    clearTimeout(timer);
  }
}

// The matches of one day in the viewer's time zone. Without a date: today.
export function fetchDay({ date = null, tz }) {
  return get("/live/v1/matches", { date, tz });
}

// Only the matches in play, and those that ended in the last minutes.
export function fetchLive() {
  return get("/live/v1/matches/live");
}
