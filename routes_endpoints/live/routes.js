// HTTP for live data: addresses in, JSON out. Everything under /live/v1/.
//
// The contract for clients is docs/live-api.md. Inside v1 we only add:
// never remove or rename a field, never change what one means.
//
// No per-visitor rate limit here on purpose. These are public reads that
// clients repeat every few seconds, and counting them would cost a database
// write each. What protects the provider allowance instead is that every
// input is checked against a short fixed list (dates within a set range,
// real time zones, match ids we have listed), so no request can cause a
// provider call we did not plan.

import { jsonResponse } from "../../utils/helper.js";
import { isValidDate, isValidTimeZone } from "./day.js";
import { LiveError, getCompetitions, getDay, getLive, getMatch } from "./service.js";

const PREFIX = "/live/v1";

function ok({ data, meta }) {
  const response = jsonResponse({ success: true, data, meta });
  // Each answer says when to ask again (meta.refreshAfterSeconds); nothing in
  // between should keep an older copy.
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function fail(code, status) {
  const response = jsonResponse({ success: false, error: code }, status);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function isLivePath(pathname) {
  return pathname === PREFIX || pathname.startsWith(PREFIX + "/");
}

export async function handleLive(request, env, ctx) {
  if (request.method !== "GET") return fail("method_not_allowed", 405);

  const url = new URL(request.url);
  const path = url.pathname.slice(PREFIX.length).replace(/\/+$/, "");
  const now = Date.now();

  try {
    if (path === "/competitions") return ok(getCompetitions(now));

    if (path === "/matches") {
      const date = url.searchParams.get("date");
      const tz = url.searchParams.get("tz") || "UTC";
      if (date !== null && !isValidDate(date)) return fail("bad_request", 400);
      if (!isValidTimeZone(tz)) return fail("bad_request", 400);
      return ok(await getDay(env, ctx, { date, tz, now }));
    }

    if (path === "/matches/live") return ok(await getLive(env, ctx, { now }));

    // One match: /matches/{id}. Ids are opaque, but always short plain text.
    const one = /^\/matches\/([A-Za-z0-9_-]{1,40})$/.exec(path);
    if (one) return ok(await getMatch(env, ctx, { id: one[1], now }));

    return fail("not_found", 404);
  } catch (err) {
    if (err instanceof LiveError) return fail(err.code, err.status);
    console.error("live:", err?.message || err);
    return fail("unavailable", 503);
  }
}
