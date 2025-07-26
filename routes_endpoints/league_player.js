// routes/league_player.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleGetLeaguePlayers(request, env) {
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

    // Check if user is league owner or has access
    const leagueOwner = await env.core_data.prepare(`
  SELECT created_by_user_id FROM leagues WHERE id = ?
`).bind(leagueId).first();

    if (!leagueOwner) {
        return jsonResponse({ success: false, error: "league_not_found" }, 404);
    }

    const access = userId === leagueOwner.created_by_user_id
        ? true
        : await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(leagueId, userId).first();

    if (!access) {
        return jsonResponse({ success: false, error: "access_denied" }, 403);
    }

    // Get user_ids from league_access
    const grantedUsers = await env.core_data.prepare(`
  SELECT user_id FROM league_access WHERE league_id = ?
`).bind(leagueId).all();

    // Get user_ids from group_standings of teams in this league
    const participants = await env.core_data.prepare(`
  SELECT DISTINCT gs.user_id
  FROM group_standings gs
  JOIN league_groups lg ON gs.group_id = lg.id
  JOIN league_instances li ON li.id = lg.league_instance_id
  WHERE li.league_id = ? AND gs.user_id IS NOT NULL
`).bind(leagueId).all();

    const userIdsSet = new Set([
        ...participants.results.map(p => p.user_id),
        ...grantedUsers.results.map(g => g.user_id),
        leagueOwner.created_by_user_id
    ]);

    const userIds = Array.from(userIdsSet);

    if (userIds.length === 0) {
        return jsonResponse({ success: true, data: { players: [] } }, 200);
    }

    // Get usernames for those userIds
    const placeholders = userIds.map(() => '?').join(',');
    const userRows = await env.core_data.prepare(`
  SELECT id, username FROM users WHERE id IN (${placeholders})
`).bind(...userIds).all();

    return jsonResponse({
        success: true,
        data: {
            players: userRows.results
        }
    }, 200);
}