// Talks to the API-Sports football API. The only file that knows its host,
// its key header and how it reports limits and errors.

const HOST = "https://v3.football.api-sports.io";
const TIMEOUT_MS = 12000;

export class ProviderError extends Error {
  constructor(code, detail) {
    super(`${code}${detail ? `: ${detail}` : ""}`);
    this.name = "ProviderError";
    this.code = code;
  }
}

function readQuota(headers) {
  const limit = Number(headers.get("x-ratelimit-requests-limit"));
  const remaining = Number(headers.get("x-ratelimit-requests-remaining"));
  if (!Number.isFinite(limit) || !Number.isFinite(remaining) || limit <= 0) return null;
  return { limitPerDay: limit, remainingToday: remaining };
}

// The provider refuses a share of the calls that come from Cloudflare's
// network with "too many requests per minute", although we are far below our
// own limit (measured on 2026-11-25: about four in ten, while the same calls
// from another network all passed). A refused call asked again a moment later
// usually passes, so those are retried a few times before giving up.
const RETRY_WAITS_MS = [300, 700, 1500];

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// GET one endpoint. Returns the "response" array and what is left of the
// day's allowance.
export async function request(env, path, params = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce(env, path, params);
    } catch (err) {
      const retry = err instanceof ProviderError && err.code === "rate_limited" && attempt < RETRY_WAITS_MS.length;
      if (!retry) throw err;
      await pause(RETRY_WAITS_MS[attempt] + Math.floor(Math.random() * 200));
    }
  }
}

async function requestOnce(env, path, params) {
  const key = env.LIVE_PROVIDER_KEY;
  if (!key) throw new ProviderError("not_configured", "LIVE_PROVIDER_KEY is not set");

  const url = new URL(HOST + path);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));

  let res;
  try {
    res = await fetch(url, {
      headers: { "x-apisports-key": key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ProviderError("unreachable", err?.name);
  }
  if (!res.ok) throw new ProviderError("http_error", String(res.status));

  let body;
  try {
    body = await res.json();
  } catch {
    throw new ProviderError("bad_answer", "not JSON");
  }

  // Problems (bad key, limit reached, bad parameter) arrive with status 200
  // and a filled "errors" field: an object, or an empty array when all is well.
  const errors = body?.errors;
  const hasErrors = Array.isArray(errors) ? errors.length > 0 : errors && Object.keys(errors).length > 0;
  if (hasErrors) {
    const names = Array.isArray(errors) ? [] : Object.keys(errors);
    // "rateLimit" is the per-minute refusal (worth asking again); "requests"
    // means the day's allowance is used up (asking again cannot help).
    const code = names.includes("rateLimit") ? "rate_limited" : names.includes("requests") ? "day_limit_reached" : "refused";
    // Their wording goes to our log only, never to a client.
    throw new ProviderError(code, JSON.stringify(errors).slice(0, 300));
  }
  if (!Array.isArray(body?.response)) throw new ProviderError("bad_answer", "no response list");

  return { items: body.response, quota: readQuota(res.headers) };
}
