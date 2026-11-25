// utils/helper.js

const ALLOWED_ORIGINS = new Set([
  "https://uefaresults.com",
  "https://www.uefaresults.com",
]);

// Extra origins for non-production deployments, set from the environment by
// configureAllowedOrigins(). Empty in production, so production only accepts
// the two origins above (plus localhost).
let extraOrigins = new Set();
let extraOriginSuffix = "";

// Call once per request with the Worker's `env`.
//   EXTRA_ALLOWED_ORIGINS        comma-separated full origins
//   EXTRA_ALLOWED_ORIGIN_SUFFIX  host suffix, e.g. ".uefatable.pages.dev",
//                                to accept every preview of the site
// Both are defined only in wrangler.dev.toml.
export function configureAllowedOrigins(env) {
  const list = (env?.EXTRA_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  extraOrigins = new Set(list);
  extraOriginSuffix = (env?.EXTRA_ALLOWED_ORIGIN_SUFFIX || "").trim();
}

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin) || extraOrigins.has(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    return Boolean(extraOriginSuffix) && protocol === "https:" && hostname.endsWith(extraOriginSuffix);
  } catch {
    return false;
  }
}

function handleCorsHeaders(origin) {
  const allowedOrigin = isAllowedOrigin(origin) ? origin : "https://uefaresults.com";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

function jsonResponse(obj, status = 200, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: new Headers({
      "Content-Type": "application/json",
      ...handleCorsHeaders(origin)
    }),
  });
}

async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function hashWithSalt(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export {
  handleCorsHeaders,
  jsonResponse,
  parseBody,
  hashWithSalt
};