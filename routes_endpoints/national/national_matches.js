// routes/matches.js

import { jsonResponse, parseBody } from '../../utils/helper.js';
import { verifyToken } from '../../utils/jwt.js';

export async function handleNationalMatches(request, env) {
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

    // Step 3: Fetch matches for the group with user names
    const matches = await env.core_data.prepare(`
  SELECT lm.*, 
         ac1.country_name AS team1_name, 
         ac2.country_name AS team2_name, 
         ac1.logo_url AS team1_logo, 
         ac2.logo_url AS team2_logo,
         u1.username AS team1_username,
         u2.username AS team2_username
  FROM country_matches lm
  JOIN all_countries ac1 ON ac1.id = lm.team1_id
  JOIN all_countries ac2 ON ac2.id = lm.team2_id
  LEFT JOIN users u1 ON u1.id = lm.team1_user_id
  LEFT JOIN users u2 ON u2.id = lm.team2_user_id
  WHERE lm.group_id = ?
  ORDER BY lm.id ASC
`).bind(groupId).all();

    return jsonResponse({
        success: true,
        data: {
            groupId,
            accessType,
            userId: userId,
            matches: matches.results
        }
    }, 200);
}