import { handleCorsHeaders, jsonResponse } from './utils/helper.js';
import { handleRegister } from './routes_endpoints/register.js';
import { handleLogin } from './routes_endpoints/login.js';
import { handleMe } from './routes_endpoints/me.js';
import { handleLeagues } from './routes_endpoints/leagues.js';
import { handleLeagueInstances } from './routes_endpoints/league_instances.js';
import { handleGetApprovedFriends } from './routes_endpoints/get_friends.js';
import { handleGetAllClubs } from './routes_endpoints/get_clubs.js';

// import additional route handlers as needed

// Route registry with path as key and allowed methods as subkeys
const routeRegistry = {
  "/register": { POST: handleRegister },
  "/login": { POST: handleLogin },
  "/me": { GET: handleMe },
  "/leagues": { POST: handleLeagues },
  "/league-instances": { POST: handleLeagueInstances },
  "/friends": { GET: handleGetApprovedFriends },
  "/clubs": { GET: handleGetAllClubs },
  // Add more routes here  league_instances
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: handleCorsHeaders(request.headers.get("Origin")),
    });
  }

  const route = routeRegistry[path];
  let response;

  if (route) {
    const handler = route[method];
    if (handler) {
      try {
        response = await handler(request, env);
      } catch (err) {
        console.error("❗ Unexpected error:", err);
        response = jsonResponse({ success: false, message: "something_went_wrong" }, 500);
      }
    } else {
      const allowedMethods = Object.keys(route).join(", ");
      response = new Response(JSON.stringify({
        success: false,
        message: "Method Not Allowed"
      }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Allow": allowedMethods,
          ...handleCorsHeaders(request.headers.get("Origin")),
        }
      });
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