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

  if (!leagueId || typeof leagueId !== "number") {
    return jsonResponse({ success: false, error: "league_id_required" }, 400);
  }

  // Access check
  const owned = await env.core_data
    .prepare(`SELECT 1 FROM leagues WHERE id = ? AND created_by_user_id = ?`)
    .bind(leagueId, userId)
    .first();

  let accessType = "owner";
  if (!owned) {
    const access = await env.core_data
      .prepare(`SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?`)
      .bind(leagueId, userId)
      .first();
    if (!access) return jsonResponse({ success: false, error: "access_denied" }, 403);
    accessType = "granted";
  }

  // League meta
  const leagueRow = await env.core_data
    .prepare(`SELECT team_count, banner_id FROM leagues WHERE id = ?`)
    .bind(leagueId)
    .first();

  const teamCount  = leagueRow?.team_count ?? 0;
  const leagueType = leagueRow?.banner_id ?? 0;

  // Get all KO rows for this league
  const rows = await env.core_data.prepare(`
    SELECT
      lk.*,
      ac1.club_name AS team1_name,
      ac2.club_name AS team2_name
    FROM league_knockouts lk
    LEFT JOIN all_clubs ac1 ON ac1.id = lk.team1_id
    LEFT JOIN all_clubs ac2 ON ac2.id = lk.team2_id
    WHERE lk.league_id = ?
    ORDER BY lk.round, lk.match_order, lk.match_type
  `).bind(leagueId).all();

  // Utility: order rounds for stable sorting
  const roundOrder = { "1/16": 1, "1/8": 2, "1/4": 3, "1/2": 4, "final": 5 };

  // Group by (round, match_order, tieSlotKey)
  // tieSlotKey is based on the unique, non-null team ids across both legs of a tie.
  const tiesMap = new Map();

  for (const r of rows.results) {
    // Build a leg object
    const leg = {
      id: r.id,
      matchType: r.match_type, // "home" | "away"
      team1: { id: r.team1_id, name: r.team1_name, userId: r.team1_user_id },
      team2: { id: r.team2_id, name: r.team2_name, userId: r.team2_user_id },
      score: { team1: r.team1_score, team2: r.team2_score },
      isVsComputer: r.is_vs_computer,
      computerTeam: r.computer_team,
      updatedUserId: r.updated_user_id,
      updatedAt: r.updated_at
    };

    // Derive a slot key that distinguishes the two ties under the same match_order.
    // Use the set of non-null team ids from this row; will be merged across legs below.
    const nonNullIds = [r.team1_id, r.team2_id].filter(v => v != null).map(Number).sort((a, b) => a - b);
    const seedKey = nonNullIds.length ? nonNullIds.join('-') : `seed-${r.match_type}-${r.id}`;
    const baseKey = `${r.round}|${r.match_order}`;

    // If we already have a tie for this baseKey whose slotKey matches after merge, reuse it;
    // else create/merge a new bucket per slotKey.
    const bucketKey = `${baseKey}|${seedKey}`;
    if (!tiesMap.has(bucketKey)) {
      tiesMap.set(bucketKey, {
        round: r.round,
        matchOrder: r.match_order,
        home: null,
        away: null,
        // winner may be set on either/both legs; keep one consistent value
        winnerTeamId: r.winner_team_id ?? null,
        winnerTeamName: null,
        // for stable sorting inside the same (round, match_order)
        _slotSeed: nonNullIds.length ? nonNullIds[0] : Number.MAX_SAFE_INTEGER
      });
    }

    const tie = tiesMap.get(bucketKey);

    if (r.winner_team_id != null) {
      // if both legs had different manual winners, keep the first but you may flag if needed
      if (tie.winnerTeamId == null) tie.winnerTeamId = r.winner_team_id;
    }

    if (r.match_type === "home") tie.home = leg;
    else if (r.match_type === "away") tie.away = leg;
  }

  // Derive winnerTeamName from the legs
  for (const tie of tiesMap.values()) {
    const candidates = [
      tie.home?.team1, tie.home?.team2,
      tie.away?.team1, tie.away?.team2
    ].filter(Boolean);
    if (tie.winnerTeamId != null) {
      const hit = candidates.find(c => c.id === tie.winnerTeamId);
      tie.winnerTeamName = hit ? hit.name : null;
    }
  }

  // Build final sorted list
  const ties = Array
    .from(tiesMap.values())
    .sort((a, b) => {
      const ro = (roundOrder[a.round] ?? 999) - (roundOrder[b.round] ?? 999);
      if (ro !== 0) return ro;
      if (a.matchOrder !== b.matchOrder) return a.matchOrder - b.matchOrder;
      return a._slotSeed - b._slotSeed; // keep the two ties in a consistent order
    })
    .map(t => {
      delete t._slotSeed;
      return t;
    });

  return jsonResponse({
    success: true,
    data: {
      leagueId,
      teamCount,
      leagueType,
      accessType,
      matches: ties
    }
  }, 200);
}