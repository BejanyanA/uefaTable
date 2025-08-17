// routes/league_instances.js

import { jsonResponse, parseBody } from '../../utils/helper.js';
import { verifyToken } from '../../utils/jwt.js';

export async function handleLeagueInstances(request, env) {
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

  if (!leagueId) {
    return jsonResponse({ success: false, error: "LeagueId is required" }, 400);
  }

  // Step 1: Check access
  const owned = await env.core_data.prepare(`
  SELECT id, name, created_at AS league_created_at
  FROM leagues
  WHERE id = ? AND created_by_user_id = ?
`).bind(leagueId, userId).first();

  let accessType = "owner";
  let leagueInfo = owned;

  if (!owned) {
    const access = await env.core_data.prepare(`
    SELECT 1 FROM league_access
    WHERE league_id = ? AND user_id = ?
  `).bind(leagueId, userId).first();
    if (!access) {
      return jsonResponse({ success: false, error: "access_denied" }, 403);
    }
    accessType = "granted";
    leagueInfo = await env.core_data.prepare(`
    SELECT id, name, created_at AS league_created_at
    FROM leagues
    WHERE id = ?
  `).bind(leagueId).first();
  }

  // Step 2: Get league instances
  const instances = await env.core_data.prepare(`
  SELECT id AS instanceId, name, created_at
  FROM league_instances
  WHERE league_id = ?
`).bind(leagueId).all();

  const instanceIds = instances.results.map(r => r.instanceId);
  let groupData = {};

  if (instanceIds.length > 0) {
    const placeholders = instanceIds.map(() => '?').join(', ');
    const groupRows = await env.core_data.prepare(`
    SELECT lg.league_instance_id, lg.id AS group_id, lg.group_name, gs.team_id, ac.club_name
    FROM league_groups lg
    JOIN group_standings gs ON gs.group_id = lg.id
    JOIN all_clubs ac ON ac.id = gs.team_id
    WHERE lg.league_instance_id IN (${placeholders})
    ORDER BY lg.group_name ASC, gs.points DESC, gs.goal_difference DESC, gs.goals_for DESC, team_id ASC
  `).bind(...instanceIds).all();

    groupRows.results.forEach(row => {
      if (!groupData[row.league_instance_id]) {
        groupData[row.league_instance_id] = {};
      }
      if (!groupData[row.league_instance_id][row.group_name]) {
        groupData[row.league_instance_id][row.group_name] = {
          groupId: row.group_id,
          clubs: []
        };
      }
      groupData[row.league_instance_id][row.group_name].clubs.push({ id: row.team_id, name: row.club_name });
    });
  }

  return jsonResponse({
    success: true,
    data: {
      league: {
        id: leagueInfo.id,
        name: leagueInfo.name,
        created_at: leagueInfo.league_created_at
      },
      accessType,
      leagueInstances: instances.results.map(inst => ({
        id: inst.instanceId,
        name: inst.name,
        created_at: inst.created_at,
        groups: groupData[inst.instanceId] || {}
      }))
    }
  }, 200);
}