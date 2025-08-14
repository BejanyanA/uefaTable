// routes/matches.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleOnlyKnockoutMatches(request, env) {
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

  // --- meta + access in ONE query ---
  const meta = await env.core_data.prepare(`
    SELECT
      l.team_count    AS teamCount,
      l.banner_id     AS leagueType,
      CASE WHEN l.created_by_user_id = ? THEN 1 ELSE 0 END AS isOwner,
      EXISTS(SELECT 1 FROM league_access la WHERE la.league_id = l.id AND la.user_id = ?) AS hasAccess
    FROM leagues l
    WHERE l.id = ?
  `).bind(userId, userId, leagueId).first();

  if (!meta) return jsonResponse({ success: false, error: "league_not_found" }, 404);
  if (!meta.isOwner && !meta.hasAccess) {
    return jsonResponse({ success: false, error: "access_denied" }, 403);
  }
  const accessType = meta.isOwner ? "owner" : "granted";

  // --- KO rows only (no group joins) ---
  const rows = await env.core_data.prepare(`
    SELECT
      lk.id,
      lk.round,
      lk.match_order,
      lk.match_type,
      lk.team1_id, lk.team2_id,
      lk.team1_user_id, lk.team2_user_id,
      lk.team1_score, lk.team2_score,
      lk.is_vs_computer, lk.computer_team,
      lk.updated_user_id, lk.updated_at,
      lk.winner_team_id,
      ac1.club_name AS team1_name,
      ac2.club_name AS team2_name
    FROM round_knockouts lk
    LEFT JOIN all_clubs ac1 ON ac1.id = lk.team1_id
    LEFT JOIN all_clubs ac2 ON ac2.id = lk.team2_id
    WHERE lk.league_id = ?
    ORDER BY lk.round, lk.match_order, lk.match_type
  `).bind(leagueId).all();

  // --- build ties (unchanged shape, minus group fields) ---
  const roundOrder = { "1/16": 1, "1/8": 2, "1/4": 3, "1/2": 4, "final": 5 };
  const tiesMap = new Map();

  for (const r of rows.results) {
    const leg = {
      id: r.id,
      matchType: r.match_type,
      team1: { id: r.team1_id, name: r.team1_name, userId: r.team1_user_id },
      team2: { id: r.team2_id, name: r.team2_name, userId: r.team2_user_id },
      score: { team1: r.team1_score, team2: r.team2_score },
      isVsComputer: r.is_vs_computer,
      computerTeam: r.computer_team,
      updatedUserId: r.updated_user_id,
      updatedAt: r.updated_at
    };

    const nonNullIds = [r.team1_id, r.team2_id].filter(v => v != null).map(Number).sort((a, b) => a - b);
    const seedKey = nonNullIds.length ? nonNullIds.join('-') : `seed-${r.match_type}-${r.id}`;
    const bucketKey = `${r.round}|${r.match_order}|${seedKey}`;

    if (!tiesMap.has(bucketKey)) {
      tiesMap.set(bucketKey, {
        round: r.round,
        matchOrder: r.match_order,
        home: null,
        away: null,
        winnerTeamId: r.winner_team_id ?? null,
        winnerTeamName: null,
        winnerUserId: null,
        _slotSeed: nonNullIds.length ? nonNullIds[0] : Number.MAX_SAFE_INTEGER
      });
    }
    const tie = tiesMap.get(bucketKey);
    if (r.winner_team_id != null && tie.winnerTeamId == null) tie.winnerTeamId = r.winner_team_id;
    if (r.match_type === "home") tie.home = leg; else if (r.match_type === "away") tie.away = leg;
  }

  // derive winner name
  for (const tie of tiesMap.values()) {
    const candidates = [tie.home?.team1, tie.home?.team2, tie.away?.team1, tie.away?.team2].filter(Boolean);
    if (tie.winnerTeamId != null) {
      const hit = candidates.find(c => c.id === tie.winnerTeamId);
      tie.winnerTeamName = hit ? hit.name : null;
      tie.winnerUserId = hit ? hit.userId : null;
    }
  }

  const matches = Array.from(tiesMap.values())
    .sort((a, b) => {
      const ro = (roundOrder[a.round] ?? 999) - (roundOrder[b.round] ?? 999);
      if (ro) return ro;
      if (a.matchOrder !== b.matchOrder) return a.matchOrder - b.matchOrder;
      return a._slotSeed - b._slotSeed;
    })
    .map(t => { delete t._slotSeed; return t; });

  return jsonResponse({
    success: true,
    data: {
      leagueId,
      teamCount: meta.teamCount,
      leagueType: meta.leagueType,
      accessType,
      matches
    }
  }, 200);
}