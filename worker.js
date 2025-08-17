import { handleCorsHeaders, jsonResponse } from './utils/helper.js';
import { handleRegister } from './routes_endpoints/register.js';
import { handleLogin } from './routes_endpoints/login.js';
import { handleMe } from './routes_endpoints/me.js';
import { handleGetApprovedFriends } from './routes_endpoints/get_friends.js';
import { handleLeagues, handleLeaguesCreate, handleCreateRoundKnockouts, handleLeaguesEdit, handleLeaguesDelete } from './routes_endpoints/leagues.js';

import { handleAttachPlayers, handleAttachKnockPlayers, handleAttachOnlyKnockPlayers } from './routes_endpoints/leagues/attach_player.js';
import { handleGetAllClubs, handleSearchClubs } from './routes_endpoints/leagues/get_clubs.js';
import { handleGroupKnockoutMatches } from './routes_endpoints/leagues/group_knockouts.js';
import { handleLeagueInstances } from './routes_endpoints/leagues/league_instances.js';
import { handleLeagueMatches } from './routes_endpoints/leagues/league_matches.js';
import { handleGetLeaguePlayers } from './routes_endpoints/leagues/league_player.js';
import { handleLeagueStandings } from './routes_endpoints/leagues/league_standings.js';
import { handleOnlyKnockoutMatches } from './routes_endpoints/leagues/round_knockouts.js';
import { handleUpdateKnockoutMatches } from './routes_endpoints/leagues/update_group_knock_matches.js';
import { handleUpdateMatches } from './routes_endpoints/leagues/update_group_matches.js';
import { handleUpdateKnockoutWinner } from './routes_endpoints/leagues/update_knock_team_winner.js';
import { handleUpdateOnlyKnockoutMatches } from './routes_endpoints/leagues/update_only_knock_matches.js';
import { handleUpdateOnlyKnockoutWinner } from './routes_endpoints/leagues/update_only_knock_team_winner.js';

import { handleGetAllWorldCountries, handleSearchWorldCountries, handleGetAllEuropeCountries, handleSearchEuropeCountries } from './routes_endpoints/national/get_countries.js';
import { handleNationalInstances } from './routes_endpoints/national/national_instances.js';
import { handleNationalStandings } from './routes_endpoints/national/national_standings.js';
import { handleNationalMatches } from './routes_endpoints/national/national_matches.js';
import { handleNationalGroupKnockoutMatches } from './routes_endpoints/national/national_group_knockouts.js';
import { handleNationalOnlyKnockoutMatches } from './routes_endpoints/national/national_round_knockouts.js';

import { handleGetNationalPlayers } from './routes_endpoints/national/national_player.js';
import { handleAttachNationalPlayers, handleAttachNationalKnockPlayers, handleAttachNationalOnlyKnockPlayers } from './routes_endpoints/national/attach_national_player.js';


// Route registry with path as key and allowed methods as subkeys
const routeRegistry = {
  "/register": { POST: handleRegister },
  "/login": { POST: handleLogin },
  "/me": { GET: handleMe },
  "/friends": { POST: handleGetApprovedFriends },

  "/leagues": { POST: handleLeagues },
  "/create-leagues": { POST: handleLeaguesCreate },
  "/create-knockouts": { POST: handleCreateRoundKnockouts },
  "/update-leagues": { POST: handleLeaguesEdit },
  "/delete-league": { POST: handleLeaguesDelete },

  // Clubs
  "/clubs": { GET: handleGetAllClubs },
  "/search-clubs": { POST: handleSearchClubs },
  "/league-instances": { POST: handleLeagueInstances },
  "/standings": { POST: handleLeagueStandings },
  "/matches": { POST: handleLeagueMatches },
  "/update-score": { POST: handleUpdateMatches },
  "/league-players": { POST: handleGetLeaguePlayers },
  "/attach-players": { POST: handleAttachPlayers },
  "/group-knockouts": { POST: handleGroupKnockoutMatches },
  "/round-knockouts": { POST: handleOnlyKnockoutMatches },
  "/update-knock-matches": { POST: handleUpdateKnockoutMatches },
  "/update-round-knock-matches": { POST: handleUpdateOnlyKnockoutMatches },
  "/attach-knock-players": { POST: handleAttachKnockPlayers },
  "/attach-round-knock-players": { POST: handleAttachOnlyKnockPlayers },
  "/update-knock-winner": { POST: handleUpdateKnockoutWinner },
  "/update-round-knock-winner": { POST: handleUpdateOnlyKnockoutWinner },

  // National  
  "/world-countries": { GET: handleGetAllWorldCountries },
  "/search-world-countries": { POST: handleSearchWorldCountries },
  "/europe-countries": { GET: handleGetAllEuropeCountries },
  "/search-europe-countries": { POST: handleSearchEuropeCountries },
  "/national-instances": { POST: handleNationalInstances },
  "/national-standings": { POST: handleNationalStandings },
  "/national-matches": { POST: handleNationalMatches },
  "/national-group-knockouts": { POST: handleNationalGroupKnockoutMatches },
  "/national-round-knockouts": { POST: handleNationalOnlyKnockoutMatches },


  "/national-players": { POST: handleGetNationalPlayers },
  "/attach-national-players": { POST: handleAttachNationalPlayers },
  "/attach-national-knock-players": { POST: handleAttachNationalKnockPlayers },
  "/attach-national-round-knock-players": { POST: handleAttachNationalOnlyKnockPlayers },

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