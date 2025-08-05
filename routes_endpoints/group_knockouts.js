// routes/matches.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleGroupKnockoutMatches(request, env) {
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
    const { leagueId } = await parseBody(request);

    if (!leagueId || typeof leagueId !== 'number') {
        return jsonResponse({ success: false, error: "league_id_required" }, 400);
    }

    // Check access
    const owned = await env.core_data.prepare(`
    SELECT 1 FROM leagues WHERE id = ? AND created_by_user_id = ?
  `).bind(leagueId, userId).first();

    let accessType = "owner";
    if (!owned) {
        const access = await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(leagueId, userId).first();
        if (!access) {
            return jsonResponse({ success: false, error: "access_denied" }, 403);
        }
        accessType = "granted";
    }

    // Fetch knockout matches
    const knockouts = await env.core_data.prepare(`
  SELECT lk.*, 
         ac1.club_name AS team1_name, 
         ac2.club_name AS team2_name
  FROM league_knockouts lk
  LEFT JOIN all_clubs ac1 ON ac1.id = lk.team1_id
  LEFT JOIN all_clubs ac2 ON ac2.id = lk.team2_id
  WHERE lk.league_id = ?
  ORDER BY lk.round, lk.match_order
`).bind(leagueId).all();

    return jsonResponse({
        success: true,
        data: {
            leagueId,
            accessType,
            matches: knockouts.results
        }
    }, 200);
}