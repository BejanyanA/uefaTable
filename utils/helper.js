// utils/helper.js

const ALLOWED_ORIGINS = new Set([
  "https://uefaresults.com",
  "https://www.uefaresults.com",
]);

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
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