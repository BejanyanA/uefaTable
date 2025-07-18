// utils/helper.js

function handleCorsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(obj, status = 200, origin = "*") {
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