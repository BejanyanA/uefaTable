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
  const { bannerId, isGroup } = await parseBody(request);

  // Step 1: Get created leagues with filter
  const created = await env.core_data.prepare(`
    SELECT * FROM leagues 
    WHERE banner_id = ? AND created_by_user_id = ? AND is_group = ?
  `).bind(bannerId, userId, isGroup).all();

  // Step 2: Get granted leagues with filter
  const granted = await env.core_data.prepare(`
    SELECT l.*
    FROM league_access la
    JOIN leagues l ON la.league_id = l.id
    WHERE la.user_id = ? AND l.banner_id = ? AND l.is_group = ?
  `).bind(userId, bannerId, isGroup).all();

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
        .map(({ id, name, banner_id, created_by_user_id, created_at, accessType, is_group }) => ({
          id,
          name,
          banner_id,
          created_by_user_id,
          created_at,
          is_group,
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


  const { name, bannerId, clubIds, teamCount, friendIds, isGroup } = await request.json();

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

  if (typeof isGroup !== 'boolean') {
    errors.isGroup = "Stage is required";
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
      INSERT INTO leagues (name, banner_id, created_by_user_id, is_group, team_count)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `).bind(name, bannerId, userId, isGroup, teamCount).first();
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

export async function handleCreateRoundKnockouts(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, message: "Unauthorized" }, 401);
  }
  const token = authHeader.split(" ")[1];
  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload) {
    return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
  }

  const db = env.core_data;
  const userId = payload.id;

  const {
    name,
    bannerId,
    clubIds,
    teamCount,
    friendIds,
    isGroup,
    shuffle = false,
  } = await request.json();

  // ---- validations (unchanged) ----
  const errors = {};
  if (!bannerId) errors.bannerId = "Banner ID is required";
  if (typeof bannerId !== "number") errors.bannerId = "Banner ID must be a number";

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    errors.name = "League name is required";
  } else if (name.length > 30) {
    errors.name = "League Name must not exceed 30 characters";
  }

  if (!Array.isArray(clubIds) || clubIds.length === 0 || !clubIds.every(id => typeof id === "number")) {
    errors.clubIds = "Club IDs must be a non-empty array of numbers";
  }

  if (typeof isGroup !== "boolean") {
    errors.isGroup = "Stage is required";
  }

  if (!teamCount) {
    errors.teamCount = "Team count is required";
  } else if (typeof teamCount !== "number" || teamCount <= 0) {
    errors.teamCount = "Team count must be a positive number";
  } else if (clubIds && clubIds.length !== teamCount) {
    errors.teamCountMatch = "Team count must match the number of provided club IDs";
  }

  if (Object.keys(errors).length > 0) {
    return jsonResponse({ success: false, errors }, 400);
  }

  const roundLabel = (n) =>
    n === 32 ? "1/16" :
    n === 16 ? "1/8"  :
    n === 8  ? "1/4"  :
    n === 4  ? "1/2"  :
    n === 2  ? "Final": "Knockout";

  const makePairs = (ids) => {
    const base = shuffle ? shuffleArray([...ids]) : [...ids];
    const out = [];
    for (let i = 0; i < base.length; i += 2) out.push([base[i], base[i + 1]]);
    return out;
  };

  // ---- helper: chunking with very low var count ----
  // Be conservative; some D1 plans show errors far below 999.
  const MAX_VARS = 500;

  function* chunk(arr, size) {
    for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
  }

  try {
    // 1) leagues
    const league = await db.prepare(`
      INSERT INTO leagues (name, banner_id, created_by_user_id, is_group, team_count)
      VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `).bind(name, bannerId, userId, isGroup, teamCount).first();
    const leagueId = league.id;

    // 2) league_access — inline constants, bind only friendId (1 var/row)
    let friendResponse = [];
    if (Array.isArray(friendIds) && friendIds.length > 0) {
      friendResponse = friendIds.map(id => ({ id }));

      const maxRows = Math.max(1, Math.floor(MAX_VARS / 1)); // 1 var/row
      for (const idsChunk of chunk(friendIds, maxRows)) {
        const placeholders = idsChunk.map(() =>
          `(${leagueId}, ?, ${userId})`
        ).join(", ");
        const sql = `
          INSERT INTO league_access (league_id, user_id, granted_by_user_id)
          VALUES ${placeholders}
          ON CONFLICT DO NOTHING
        `;
        await db.prepare(sql).bind(...idsChunk).run();
      }
    }

    // 3) round_knockouts — inline constants, bind only team ids (2 vars/row)
    let insertedTies = 0;
    let firstRoundOut = null;

    if (isGroup === false) {
      const firstRound = roundLabel(teamCount); // limited to known literals
      firstRoundOut = firstRound;

      const pairs = makePairs(clubIds);
      insertedTies = pairs.length;

      if (pairs.length > 0) {
        // two rows per pair; each row binds (team1_id, team2_id) only
        // → 2 vars/row, 4 vars/pair
        const varsPerPair = 4;
        const maxPairs = Math.max(1, Math.floor(MAX_VARS / varsPerPair));

        let order = 1;
        for (const batch of chunk(pairs, maxPairs)) {
          const valuesSql = [];
          const binds = [];
          for (const [t1, t2] of batch) {
            // home leg (bind t1, t2)
            valuesSql.push(`(${leagueId}, '${firstRound}', ${order}, ?, ?, 'home', 1)`);
            binds.push(t1, t2);
            // away leg (bind t2, t1)
            valuesSql.push(`(${leagueId}, '${firstRound}', ${order}, ?, ?, 'away', 2)`);
            binds.push(t2, t1);
            order++;
          }

          const sql = `
            INSERT INTO round_knockouts
              (league_id, "round", match_order, team1_id, team2_id, match_type, tie_slot)
            VALUES ${valuesSql.join(", ")}
          `;
          await db.prepare(sql).bind(...binds).run();
        }
      }
    }

    return jsonResponse({
      success: true,
      data: {
        leagueId,
        isGroup,
        stage: isGroup ? "group" : "knockout",
        ...(isGroup === false ? { round: firstRoundOut, ties: insertedTies } : {}),
        friendIds: friendResponse
      }
    }, 201);

  } catch (err) {
    return jsonResponse({ success: false, error: "creation_failed", details: err.message }, 500);
  }
}

export async function handleLeaguesEdit(request, env) {
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
  const { leagueId, name, friendIds, denyFriendIds } = await parseBody(request);

  const errors = {};
  if (!leagueId || typeof leagueId !== 'number') {
    errors.leagueId = "League ID is required and must be a number";
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.name = "League name is required and must be a non-empty string";
  }
  if (Object.keys(errors).length > 0) {
    return jsonResponse({ success: false, errors }, 400);
  }

  // Step 1: Verify league ownership
  const league = await env.core_data.prepare(`
  SELECT created_by_user_id FROM leagues WHERE id = ?
`).bind(leagueId).first();

  if (!league) {
    return jsonResponse({ success: false, error: "league_not_found" }, 404);
  }
  if (league.created_by_user_id !== loggedInUserId) {
    return jsonResponse({ success: false, error: "access_denied" }, 403);
  }

  // Step 2: Fetch approved friend IDs once
  const approvedFriends = await env.core_data.prepare(`
  SELECT friend_id AS id FROM friends WHERE user_id = ? AND status = 'approved'
  UNION
  SELECT user_id AS id FROM friends WHERE friend_id = ? AND status = 'approved'
`).bind(loggedInUserId, loggedInUserId).all();
  const approvedIds = approvedFriends.results.map(row => row.id);

  // Step 2.1: Validate friendIds
  let flatFriendIds = [];
  if (Array.isArray(friendIds)) {
    flatFriendIds = friendIds.map(f => typeof f === 'object' ? f.id : f);
    const allValid = flatFriendIds.every(id => approvedIds.includes(id));
    if (!allValid) {
      return jsonResponse({ success: false, error: "invalid_friends", message: "All provided friend IDs must be approved friends." }, 400);
    }
  }

  // Step 2.2: Validate denyFriendIds only for presence in league_access
  let flatDenyIds = [];
  if (Array.isArray(denyFriendIds)) {
    flatDenyIds = denyFriendIds.map(f => typeof f === 'object' ? f.id : f);

    // Batch check denyFriendIds in league_access
    const denyPlaceholders = flatDenyIds.map(() => '?').join(',');
    const denyAccessRows = await env.core_data.prepare(`
    SELECT user_id FROM league_access WHERE league_id = ? AND user_id IN (${denyPlaceholders})
  `).bind(leagueId, ...flatDenyIds).all();
    const denyAccessIds = denyAccessRows.results.map(r => r.user_id);

    for (const denyId of flatDenyIds) {
      if (!denyAccessIds.includes(denyId)) {
        return jsonResponse({ success: false, error: "deny_id_not_found", message: `User ID ${denyId} not found in league access.` }, 400);
      }
    }
  }

  // Step 3: Update league name
  await env.core_data.prepare(`
  UPDATE leagues SET name = ? WHERE id = ?
`).bind(name, leagueId).run();

  // Step 4: Update league access (add new)
  if (flatFriendIds.length > 0) {
    const existingAccess = await env.core_data.prepare(`
    SELECT user_id FROM league_access WHERE league_id = ?
  `).bind(leagueId).all();
    const existingIds = new Set(existingAccess.results.map(row => row.user_id));
    const newAccessIds = flatFriendIds.filter(id => !existingIds.has(id));

    if (newAccessIds.length > 0) {
      const values = newAccessIds.map(id => `(${leagueId}, ${id}, ${loggedInUserId})`).join(',');
      await env.core_data.exec(`
      INSERT INTO league_access (league_id, user_id, granted_by_user_id) VALUES ${values}
    `);
    }
  }

  // Step 5: Remove access for denyFriendIds
  if (flatDenyIds.length > 0) {
    const denyPlaceholders = flatDenyIds.map(() => '?').join(',');
    await env.core_data.prepare(`
    DELETE FROM league_access WHERE league_id = ? AND user_id IN (${denyPlaceholders})
  `).bind(leagueId, ...flatDenyIds).run();
  }

  return jsonResponse({
    success: true,
    message: "League updated successfully",
    data: {
      leagueId,
      name,
      friendIds: flatFriendIds
    }
  }, 200);
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