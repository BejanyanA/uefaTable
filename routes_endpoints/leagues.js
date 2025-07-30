// routes/leagues.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';
import { shuffleArray, chunkArray, generateAllPairs } from '../utils/shuffle.js';

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
  const { bannerId } = await parseBody(request);

  // Step 1: Get created leagues
  const created = await env.core_data.prepare(`
  SELECT * FROM leagues WHERE banner_id = ? AND created_by_user_id = ?
`).bind(bannerId, userId).all();

  // Step 2: Get granted leagues
  const granted = await env.core_data.prepare(`
  SELECT l.*
  FROM league_access la
  JOIN leagues l ON la.league_id = l.id
  WHERE la.user_id = ? AND l.banner_id = ?
`).bind(userId, bannerId).all();

  // Step 3: Combine with access type
  const leagueMap = new Map();
  for (const league of created.results) {
    leagueMap.set(league.id, { ...league, accessType: "owner" });
  }
  for (const league of granted.results) {
    if (!leagueMap.has(league.id)) {
      leagueMap.set(league.id, { ...league, accessType: "granted" });
    }
  }

  // Step 4: Respond with combined data
  return jsonResponse({
    success: true,
    data: {
      leagues: Array.from(leagueMap.values())
        .sort((a, b) => b.id - a.id)
        .map(({ id, name, banner_id, created_by_user_id, created_at, accessType }) => ({
          id,
          name,
          banner_id,
          created_by_user_id,
          created_at,
          accessType
        }))
    }
  }, 200);
}


export async function handleLeaguesCreate(request, env) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, message: "Unauthorized" }, 401);
  }

  const token = authHeader.split(" ")[1];
  const payload = await verifyToken(token, env.JWT_SECRET);

  if (!payload) {
    return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
  }


  const { name, bannerId, clubIds, teamCount, friendIds } = await request.json();

  const errors = {};
  if (!bannerId) {
    errors.bannerId = "Banner ID is required";
  }
  if (typeof bannerId !== 'number') {
    errors.bannerId = "Banner ID must be a number";
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.name = "League name is required";
  }
  if (name.length > 30) {
    errors.name = "League Name must not exceed 30 characters";
  }

  if (!clubIds) {
    errors.clubIds = "Club IDs is required";
  }
  if (!Array.isArray(clubIds) || clubIds.length === 0 || !clubIds.every(id => typeof id === 'number')) {
    errors.clubIds = "Club IDs must be a non-empty array of numbers";
  }

  if (!teamCount) {
    errors.teamCount = "Team count is required";
  }
  if (typeof teamCount !== 'number' || teamCount <= 0) {
    errors.teamCount = "Team count must be a positive number";
  }
  if (clubIds && teamCount && clubIds.length !== teamCount) {
    errors.teamCountMatch = "Team count must match the number of provided club IDs";
  }

  if (Object.keys(errors).length > 0) {
    return jsonResponse({ success: false, errors }, 400);
  }

  const userId = payload.id;
  const db = env.core_data;
  const groupSize = 4;
  const shuffled = shuffleArray(clubIds);
  const groups = chunkArray(shuffled, groupSize);

  try {
    const league = await db.prepare(`
      INSERT INTO leagues (name, banner_id, created_by_user_id)
      VALUES (?, ?, ?)
      RETURNING id
    `).bind(name, bannerId, userId).first();
    const leagueId = league.id;

    const instance = await db.prepare(`
      INSERT INTO league_instances (league_id, name, created_by_user_id)
      VALUES (?, ?, ?)
      RETURNING id
    `).bind(leagueId, name, userId).first();
    const instanceId = instance.id;

    const groupInsertValues = groups.map((_, i) => `('${instanceId}', 'Group ${String.fromCharCode(65 + i)}')`).join(', ');
    await db.exec(`INSERT INTO league_groups (league_instance_id, group_name) VALUES ${groupInsertValues}`);

    const groupQuery = await db.prepare(`SELECT id, group_name FROM league_groups WHERE league_instance_id = ?`).bind(instanceId).all();
    const groupIds = groupQuery.results.map(r => r.id);

    const standingValues = [];
    const matchValues = [];

    groups.forEach((group, i) => {
      const groupId = groupIds[i];
      standingValues.push(...group.map(teamId => `(${groupId}, ${teamId}, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`));
      const pairs = generateAllPairs(group);
      for (const [team1, team2] of pairs) {
        for (const matchType of ['home', 'away']) {
          const [t1, t2] = matchType === 'home' ? [team1, team2] : [team2, team1];
          matchValues.push(`(${groupId}, ${t1}, ${t2}, null, null, 0, null, null, null, null, null, '${matchType}')`);
        }
      }
    });

    if (standingValues.length > 0) {
      await db.exec(`INSERT INTO group_standings (group_id, team_id, user_id, played, wins, wins_vs_computer, wins_vs_player, draws, losses, goals_for, goals_against, goal_difference, points) VALUES ${standingValues.join(', ')}`);
    }
    if (matchValues.length > 0) {
      await db.exec(`INSERT INTO league_matches (group_id, team1_id, team2_id, team1_user_id, team2_user_id, is_vs_computer, computer_team, team1_score, team2_score, winner_team_id, updated_user_id, match_type) VALUES ${matchValues.join(', ')}`);
    }

    let friendResponse = [];
    if (Array.isArray(friendIds) && friendIds.length > 0) {
      const accessValues = friendIds.map(id => {
        friendResponse.push({ id });
        return `(${leagueId}, ${id}, ${userId})`;
      }).join(', ');
      await db.exec(`INSERT INTO league_access (league_id, user_id, granted_by_user_id) VALUES ${accessValues} ON CONFLICT DO NOTHING`);
    }

    return jsonResponse({
      success: true,
      data: {
        leagueId,
        instanceId,
        groupCount: groups.length,
        friendIds: friendResponse
      }
    }, 201);
  } catch (err) {
    return jsonResponse({ success: false, error: "creation_failed", details: err.message }, 500);
  }
}


export async function handleLeaguesDelete(request, env) {
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

  // Step 1: Check if user is owner or granted access
  const league = await env.core_data.prepare(`
  SELECT created_by_user_id FROM leagues WHERE id = ?
`).bind(leagueId).first();

  if (!league) {
    return jsonResponse({ success: false, error: "league_not_found" }, 404);
  }

  const isOwner = league.created_by_user_id === userId;

  if (!isOwner) {
    return jsonResponse({ success: false, error: "access_denied" }, 403);
  }

  // Step 2: Delete only the league
  try {
    await env.core_data.prepare(`
    DELETE FROM leagues WHERE id = ?
  `).bind(leagueId).run();

    return jsonResponse({ success: true, message: "League deleted successfully" }, 200);
  } catch (error) {
    return jsonResponse({ success: false, error: "deletion_failed", details: error.message }, 500);
  }
}