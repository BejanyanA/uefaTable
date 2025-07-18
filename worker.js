import { handleCorsHeaders, jsonResponse } from './utils/helper.js';
import { handleRegister } from './routes/register.js';
import { handleLogin } from './routes/login.js';
import { handleMe } from './routes/me.js';
import { handleLeagues } from './routes/leagues.js';
// import additional route handlers as needed

const routes = {
  "POST /register": handleRegister,
  "POST /leagues": handleLeagues,
  "POST /login": handleLogin,
  "GET /me": handleMe,
  // Add more routes here
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: handleCorsHeaders(request.headers.get("Origin")),
    });
  }

  // Route dispatch using route key
  const routeKey = `${method} ${pathname}`;
  const handler = routes[routeKey];

  let response;

  if (handler) {
    try {
      response = await handler(request, env);
    } catch (err) {
      console.error("❗ Unexpected error:", err);
      response = jsonResponse({ success: false, message: "something_went_wrong" }, 500);
    }
  } else {
    response = jsonResponse({ success: false, message: "Not Found" }, 404);
  }

  // Append CORS headers to all responses
  const corsHeaders = handleCorsHeaders(request.headers.get("Origin"));
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));

  return response;
}

export default {
  fetch(request, env, ctx) {
    return onRequest({ request, env, ctx });
  }
};