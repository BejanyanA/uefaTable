// routes/leagues.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleLeagues(request, env) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, message: "Unauthorized" }, 401);
  }

  const token = authHeader.split(" ")[1];
  const payload = await verifyToken(token, env.JWT_SECRET);

  if (!payload) {
    return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
  }

  const userId = payload.id;

  const { bannerId, password } = await parseBody(request);
  const errors = {};
  if (!bannerId) errors.bannerId = "BannerId is required";
  if (!password) errors.password = "Password is required";

  if (Object.keys(errors).length > 0) {
    return jsonResponse({ success: false, errors }, 400);
  }

  const league = await env.core_data.prepare(`
    SELECT * FROM leagues
    WHERE banner_id = ? AND access_password = ? AND created_by_user_id = ?
  `).bind(bannerId, password, userId).first();

  if (!league) {
    return jsonResponse({ success: false, message: "invalid_table_password" }, 400);
  }

  const leagueInstances = await env.core_data.prepare(`
    SELECT li.*, l.name AS league_type
    FROM league_instances li
    JOIN leagues l ON li.league_id = l.id
    WHERE li.created_by_user_id = ?
  `).bind(userId).all();

  return jsonResponse({
    success: true,
    data: {
      league: {
        id: league.id,
        name: league.name,
        created_at: league.league_created_at
      },
      leagueInstances: leagueInstances.results
    }
  }, 200);
}