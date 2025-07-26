// routes/attach_player.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleAttachPlayers(request, env) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token, env.JWT_SECRET);

    if (!payload) {
        return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
    }

    const loggedInUserId = payload.id;
    const { leagueId, matchId, teamId, userId } = await parseBody(request);

    if (!leagueId || typeof leagueId !== 'number') {
        return jsonResponse({ success: false, error: "league_id_required" }, 400);
    }
    if (!matchId || typeof matchId !== 'number') {
        return jsonResponse({ success: false, error: "match_id_required" }, 400);
    }
    if (!teamId || typeof teamId !== 'number') {
        return jsonResponse({ success: false, error: "team_id_required" }, 400);
    }
    if (!userId || typeof userId !== 'number') {
        return jsonResponse({ success: false, error: "user_id_required" }, 400);
    }

    // Check if logged-in user is league owner or has access
    const leagueOwner = await env.core_data.prepare(`
  SELECT created_by_user_id FROM leagues WHERE id = ?
`).bind(leagueId).first();

    if (!leagueOwner) {
        return jsonResponse({ success: false, error: "league_not_found" }, 404);
    }

    const access = loggedInUserId === leagueOwner.created_by_user_id
        ? true
        : await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(leagueId, loggedInUserId).first();

    if (!access) {
        return jsonResponse({ success: false, error: "access_denied" }, 403);
    }

    // Also check if the userId to be assigned has access or is the league owner
    const targetAccess = userId === leagueOwner.created_by_user_id
        ? true
        : await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(leagueId, userId).first();

    if (!targetAccess) {
        return jsonResponse({ success: false, error: "target_user_has_no_access" }, 403);
    }

    // Validate match and team belongs to the league
    const matchData = await env.core_data.prepare(`
  SELECT lm.id, lm.group_id, lm.team1_id, lm.team2_id
  FROM league_matches lm
  JOIN league_groups lg ON lg.id = lm.group_id
  JOIN league_instances li ON li.id = lg.league_instance_id
  WHERE lm.id = ? AND li.league_id = ?
`).bind(matchId, leagueId).first();

    if (!matchData) {
        return jsonResponse({ success: false, error: "match_not_found_in_league" }, 404);
    }
    if (matchData.team1_id !== teamId && matchData.team2_id !== teamId) {
        return jsonResponse({ success: false, error: "team_not_in_match" }, 400);
    }

    // Determine column to update
    const columnToUpdate = matchData.team1_id === teamId ? 'team1_user_id' : 'team2_user_id';
    await env.core_data.prepare(
        `UPDATE league_matches SET ${columnToUpdate} = ?, updated_user_id = ? WHERE id = ?`
    ).bind(userId, loggedInUserId, matchId).run();

    // Also update group_standings if not already set
    await env.core_data.prepare(`
  UPDATE group_standings
  SET user_id = ?
  WHERE group_id = ? AND team_id = ? AND user_id IS NULL
`).bind(userId, matchData.group_id, teamId).run();

    return jsonResponse({ success: true, message: "User assigned to match and team" }, 200);
}