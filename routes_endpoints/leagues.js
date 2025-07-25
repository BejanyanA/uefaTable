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

  // Step 2: Get granted_by_user_ids from league_access
  const access = await env.core_data.prepare(`
  SELECT DISTINCT granted_by_user_id FROM league_access WHERE user_id = ?
`).bind(userId).all();

  // Step 3: Fetch shared leagues
  let sharedLeagues = [];
  for (const row of access.results) {
    const shared = await env.core_data.prepare(`
    SELECT * FROM leagues WHERE banner_id = ? AND created_by_user_id = ?
  `).bind(bannerId, row.granted_by_user_id).all();

    sharedLeagues.push(...shared.results);
  }

  // Step 4: Combine and deduplicate
  const leagueMap = new Map();
  for (const league of [...created.results, ...sharedLeagues]) {
    leagueMap.set(league.id, league); // avoids duplicates by league ID
  }

  // Step 5: Respond with combined data
  return jsonResponse({
    success: true,
    data: {
      leagues: Array.from(leagueMap.values())
        .sort((a, b) => b.id - a.id)
        .map(({ id, name, banner_id, created_by_user_id, created_at }) => ({
          id,
          name,
          banner_id,
          created_by_user_id,
          created_at
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

    for (let i = 0; i < groups.length; i++) {
      const groupName = `Group ${String.fromCharCode(65 + i)}`;
      const groupRes = await db.prepare(`
        INSERT INTO league_groups (league_instance_id, group_name)
        VALUES (?, ?)
        RETURNING id
      `).bind(instanceId, groupName).first();
      const groupId = groupRes.id;

      for (const teamId of groups[i]) {
        await db.prepare(`
          INSERT INTO group_standings (
            group_id, team_id, user_id,
            played, wins, wins_vs_computer, wins_vs_player, draws,
            losses, goals_for, goals_against, goal_difference, points
          ) VALUES (?, ?, NULL, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
        `).bind(groupId, teamId).run();
      }

      const pairs = generateAllPairs(groups[i]);
      for (const [team1, team2] of pairs) {
        for (const matchType of ['home', 'away']) {
          const [t1, t2] = matchType === 'home' ? [team1, team2] : [team2, team1];
          await db.prepare(`
            INSERT INTO league_matches (
              group_id, team1_id, team2_id,
              team1_user_id, team2_user_id,
              is_vs_computer, computer_team,
              team1_score, team2_score, winner_team_id,
              updated_user_id, match_type
            ) VALUES (?, ?, ?, NULL, NULL, 0, NULL, 0, 0, NULL, NULL, ?)
          `).bind(groupId, t1, t2, matchType).run();
        }
      }
    }

    if (Array.isArray(friendIds)) {
      for (const friendId of friendIds) {
        await db.prepare(`
          INSERT INTO league_access (league_id, user_id, granted_by_user_id)
          VALUES (?, ?, ?)
          ON CONFLICT DO NOTHING
        `).bind(leagueId, friendId, userId).run();
      }
    }

    return jsonResponse({
      success: true,
      data: {
        leagueId,
        instanceId,
        groupCount: groups.length,
        friendIds: Array.isArray(friendIds) ? friendIds : [],
      }
    }, 201);
  } catch (err) {
    return jsonResponse({ success: false, error: "creation_failed", details: err.message }, 500);
  }
}