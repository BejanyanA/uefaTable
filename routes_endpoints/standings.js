// routes/standings.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleLeagueStandings(request, env) {
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
    const { leagueId, groupId } = await parseBody(request);

    const errors = {};
    if (!leagueId) {
        errors.leagueId = "LeagueId is required";
    }
    if (!groupId) {
        errors.groupId = "GroupId is required";
    }

    if (Object.keys(errors).length > 0) {
        return jsonResponse({ success: false, errors }, 400);
    }

    // Step 1: Check access
    const owned = await env.core_data.prepare(`
  SELECT id FROM leagues WHERE id = ? AND created_by_user_id = ?
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

    // Step 2: Validate groupId
    const groupExists = await env.core_data.prepare(`
  SELECT id FROM league_groups WHERE id = ? AND league_instance_id IN (
    SELECT id FROM league_instances WHERE league_id = ?
  )
`).bind(groupId, leagueId).first();

    if (!groupExists) {
        return jsonResponse({ success: false, error: "invalid_group" }, 404);
    }

    // Step 3: Fetch standings for the group
    const standings = await env.core_data.prepare(`
  SELECT gs.*, ac.club_name
  FROM group_standings gs
  JOIN all_clubs ac ON ac.id = gs.team_id
  WHERE gs.group_id = ?
  ORDER BY gs.points DESC, gs.goal_difference DESC, gs.goals_for DESC
`).bind(groupId).all();

    return jsonResponse({
        success: true,
        data: {
            groupId,
            accessType,
            standings: standings.results
        }
    }, 200);
}