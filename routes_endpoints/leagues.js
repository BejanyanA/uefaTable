// routes/leagues.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';
// import { shuffleArray, chunkArray, generateAllPairs } from '../utils/shuffle.js';

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

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function generateAllPairs(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) out.push([arr[i], arr[j]]);
  }
  return out;
}
const toInt = v => (Number.isFinite(v) ? Math.trunc(v) : 0);

// Approved (bidirectional) friend ids for a user — used to gate who can be granted league_access
async function getApprovedFriendIds(env, userId) {
  const approvedFriends = await env.core_data.prepare(`
    SELECT friend_id AS id FROM friends WHERE user_id = ? AND status = 'approved'
    UNION
    SELECT user_id AS id FROM friends WHERE friend_id = ? AND status = 'approved'
  `).bind(userId, userId).all();
  return new Set(approvedFriends.results.map(row => row.id));
}

// Build and exec INSERT ... VALUES (...) in small literal chunks (no placeholders)
async function execInsertValuesChunks(db, { table, columns, tuples, chunkSize = 80, suffix = "" }) {
  if (!tuples || tuples.length === 0) return;
  for (let i = 0; i < tuples.length; i += chunkSize) {
    const part = tuples.slice(i, i + chunkSize);
    if (part.length === 0) continue; // guard
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${part.join(", ")}${suffix}`;
    await db.exec(sql);
  }
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

  const db = env.core_data;
  const userId = payload.id;

  if (Array.isArray(friendIds) && friendIds.length > 0) {
    const approvedIds = await getApprovedFriendIds(env, userId);
    const invalid = friendIds.some(id => !approvedIds.has(toInt(id)));
    if (invalid) {
      return jsonResponse({ success: false, error: "invalid_friends", message: "All provided friend IDs must be approved friends." }, 400);
    }
  }

  // National-team tournaments: single-leg neutral matches
  const isNational = bannerId === 3 || bannerId === 4;

  // groups of 4 (last group may be <4 if not divisible)
  const groupSize = 4;
  const shuffled = shuffleArray(clubIds.map(toInt));
  const groups = chunkArray(shuffled, groupSize);

  try {
    // 1) Create league
    const league = await db.prepare(
      `INSERT INTO leagues (name, banner_id, created_by_user_id, is_group, team_count)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id`
    ).bind(name, bannerId, userId, isGroup, teamCount).first();
    const leagueId = league.id;

    // 2) Create league instance
    const instance = await db.prepare(
      `INSERT INTO league_instances (league_id, name, created_by_user_id)
       VALUES (?, ?, ?)
       RETURNING id`
    ).bind(leagueId, name, userId).first();
    const instanceId = instance.id;

    // 3) Create groups (RETURNING to preserve order A,B,C,...)
    const groupNames = groups.map((_, i) => `Group ${String.fromCharCode(65 + i)}`);
    let groupIds = [];
    if (groupNames.length > 0) {
      const placeholders = groupNames.map(() => `(?, ?)`).join(", ");
      const res = await db.prepare(
        `INSERT INTO league_groups (league_instance_id, group_name)
         VALUES ${placeholders}
         RETURNING id, group_name`
      ).bind(...groupNames.flatMap(n => [instanceId, n])).all();
      const byName = new Map(res.results.map(r => [r.group_name, r.id]));
      groupIds = groupNames.map(n => byName.get(n));
    }

    // ===== Build ALL STANDINGS tuples (literals) and insert in small chunks =====
    const standingsColumns = [
      "group_id", "team_id", "user_id", "played", "wins", "wins_vs_computer", "wins_vs_player",
      "draws", "losses", "goals_for", "goals_against", "goal_difference", "points"
    ];
    const standingsTuples = [];
    for (let i = 0; i < groups.length; i++) {
      const gid = toInt(groupIds[i]);
      const teams = groups[i] || [];
      if (!gid || teams.length === 0) continue;
      for (const t of teams) {
        standingsTuples.push(`(${gid}, ${toInt(t)}, NULL, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`);
      }
    }
    if (standingsTuples.length > 0) {
      await execInsertValuesChunks(db, {
        table: isNational ? "country_group_standings" : "group_standings",
        columns: standingsColumns,
        tuples: standingsTuples,
        chunkSize: 80, // keep SQL short to avoid parser stress
      });
    }

    // ===== Build ALL MATCHES tuples (literals) and insert in small chunks =====
    if (isNational) {
      // Single leg neutral
      const matchColumns = [
        "group_id", "team1_id", "team2_id",
        "team1_user_id", "team2_user_id", "is_vs_computer", "computer_team",
        "team1_score", "team2_score", "winner_team_id", "updated_user_id", "match_type"
      ];
      const matchTuples = [];
      for (let i = 0; i < groups.length; i++) {
        const gid = toInt(groupIds[i]);
        const teams = groups[i] || [];
        if (!gid || teams.length < 2) continue;
        for (const [t1, t2] of generateAllPairs(teams)) {
          matchTuples.push(
            `(${gid}, ${toInt(t1)}, ${toInt(t2)}, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, 'neutral')`
          );
        }
      }
      if (matchTuples.length > 0) {
        await execInsertValuesChunks(db, {
          table: "country_matches",
          columns: matchColumns,
          tuples: matchTuples,
          chunkSize: 80,
        });
      }
    } else {
      // Clubs: two legs (home/away)
      const matchColumns = [
        "group_id", "team1_id", "team2_id",
        "team1_user_id", "team2_user_id", "is_vs_computer", "computer_team",
        "team1_score", "team2_score", "winner_team_id", "updated_user_id", "match_type"
      ];
      const matchTuples = [];
      for (let i = 0; i < groups.length; i++) {
        const gid = toInt(groupIds[i]);
        const teams = groups[i] || [];
        if (!gid || teams.length < 2) continue;
        for (const [t1, t2] of generateAllPairs(teams)) {
          matchTuples.push(
            `(${gid}, ${toInt(t1)}, ${toInt(t2)}, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, 'home')`,
            `(${gid}, ${toInt(t2)}, ${toInt(t1)}, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, 'away')`
          );
        }
      }
      if (matchTuples.length > 0) {
        await execInsertValuesChunks(db, {
          table: "league_matches",
          columns: matchColumns,
          tuples: matchTuples,
          chunkSize: 80,
        });
      }
    }

    // ===== league_access in small literal chunks =====
    let friendResponse = [];
    if (Array.isArray(friendIds) && friendIds.length > 0) {
      friendResponse = friendIds.map(id => ({ id: toInt(id) }));
      const accessColumns = ["league_id", "user_id", "granted_by_user_id"];
      const accessTuples = friendIds.map(fid => `(${leagueId}, ${toInt(fid)}, ${userId})`);
      await execInsertValuesChunks(db, {
        table: "league_access",
        columns: accessColumns,
        tuples: accessTuples,
        chunkSize: 120,
        suffix: " ON CONFLICT DO NOTHING"
      });
    }

    return jsonResponse({
      success: true,
      data: {
        leagueId,
        instanceId,
        groupCount: groups.length,
        friendIds: friendResponse
      },
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

  if (Array.isArray(friendIds) && friendIds.length > 0) {
    const approvedIds = await getApprovedFriendIds(env, userId);
    const invalid = friendIds.some(id => !approvedIds.has(toInt(id)));
    if (invalid) {
      return jsonResponse({ success: false, error: "invalid_friends", message: "All provided friend IDs must be approved friends." }, 400);
    }
  }

  const isNational = bannerId === 3 || bannerId === 4;

  const roundLabel = (n) =>
    n === 32 ? "1/16" :
      n === 16 ? "1/8" :
        n === 8 ? "1/4" :
          n === 4 ? "1/2" :
            n === 2 ? "Final" : "Knockout";

  const shuffleArray = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const makePairs = (ids) => {
    const base = shuffle ? shuffleArray([...ids]) : [...ids];
    const out = [];
    for (let i = 0; i < base.length; i += 2) out.push([base[i], base[i + 1]]);
    return out;
  };

  // ---- helper: chunking with very low var count ----
  const MAX_VARS = 500; // conservative for D1

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

    // 3) knockouts (clubs vs national)
    let insertedTies = 0;
    let firstRoundOut = null;

    if (isGroup === false) {
      const firstRound = roundLabel(teamCount);
      firstRoundOut = firstRound;

      const pairs = makePairs(clubIds);
      insertedTies = pairs.length;

      if (pairs.length > 0) {
        if (isNational) {
          // NATIONAL TEAMS: single neutral match, table: national_round_knockouts
          // Columns: (league_id, "round", match_order, team1_id, team2_id, match_type)
          // Bind only (team1_id, team2_id) → 2 vars/row
          const varsPerRow = 2;
          const maxRows = Math.max(1, Math.floor(MAX_VARS / varsPerRow));

          let order = 1;
          for (const batch of chunk(pairs, maxRows)) {
            const valuesSql = [];
            const binds = [];
            for (const [t1, t2] of batch) {
              valuesSql.push(`(${leagueId}, '${firstRound}', ${order}, ?, ?, 'neutral')`);
              binds.push(t1, t2);
              order++;
            }

            const sql = `
              INSERT INTO national_round_knockouts
                (league_id, "round", match_order, team1_id, team2_id, match_type)
              VALUES ${valuesSql.join(", ")}
            `;
            await db.prepare(sql).bind(...binds).run();
          }
        } else {
          // CLUBS: two legs (home/away), table: round_knockouts (with tie_slot)
          // Bind only team ids → 2 vars/row; 2 rows per pair (4 vars/pair)
          const varsPerPair = 4;
          const maxPairs = Math.max(1, Math.floor(MAX_VARS / varsPerPair));

          let order = 1;
          for (const batch of chunk(pairs, maxPairs)) {
            const valuesSql = [];
            const binds = [];
            for (const [t1, t2] of batch) {
              // home leg
              valuesSql.push(`(${leagueId}, '${firstRound}', ${order}, ?, ?, 'home', 1)`);
              binds.push(t1, t2);
              // away leg
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

  await env.core_data.prepare(`
  UPDATE league_instances SET name = ? WHERE league_id = ?
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