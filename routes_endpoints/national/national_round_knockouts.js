// routes/matches.js

import { jsonResponse, parseBody } from '../../utils/helper.js';
import { verifyToken } from '../../utils/jwt.js';

export async function handleNationalOnlyKnockoutMatches(request, env) {
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

  // meta + access in one query
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

  // fetch national knockout rows (single-leg neutral)
  const rows = await env.core_data.prepare(`
    SELECT
      nk.id,
      nk.round,
      nk.match_order,
      nk.match_type,
      nk.team1_id, nk.team2_id,
      nk.team1_user_id, nk.team2_user_id,
      nk.team1_score, nk.team2_score,
      nk.is_vs_computer, nk.computer_team,
      nk.updated_user_id, nk.updated_at,
      nk.winner_team_id,
      ac1.country_name AS team1_name,
      ac1.logo_url AS team1_logo_url,
      ac2.country_name AS team2_name,
      ac2.logo_url AS team2_logo_url
    FROM national_round_knockouts nk
    LEFT JOIN all_countries ac1 ON ac1.id = nk.team1_id
    LEFT JOIN all_countries ac2 ON ac2.id = nk.team2_id
    WHERE nk.league_id = ?
    ORDER BY nk.round, nk.match_order
  `).bind(leagueId).all();

  // round sort order
  const roundOrder = { "1/16": 1, "1/8": 2, "1/4": 3, "1/2": 4, "Final": 5 };

  // flat list of single-leg neutral matches (no tie grouping)
  const matches = (rows.results || []).map(r => {
    const team1 = { id: r.team1_id, name: r.team1_name, logo_url: r.team1_logo_url, userId: r.team1_user_id };
    const team2 = { id: r.team2_id, name: r.team2_name, logo_url: r.team2_logo_url, userId: r.team2_user_id };

    let winnerTeamName = null;
    let winnerUserId = null;
    if (r.winner_team_id != null) {
      if (r.winner_team_id === r.team1_id) { winnerTeamName = team1.name; winnerUserId = team1.userId; }
      else if (r.winner_team_id === r.team2_id) { winnerTeamName = team2.name; winnerUserId = team2.userId; }
    }

    return {
      id: r.id,
      round: r.round,
      matchOrder: r.match_order,
      matchType: "neutral", // force neutral for nationals
      team1,
      team2,
      score: { team1: r.team1_score, team2: r.team2_score },
      isVsComputer: r.is_vs_computer,
      computerTeam: r.computer_team,
      updatedUserId: r.updated_user_id,
      updatedAt: r.updated_at,
      winnerTeamId: r.winner_team_id ?? null,
      winnerTeamName,
      winnerUserId,
    };
  }).sort((a, b) => {
    const ro = (roundOrder[a.round] ?? 999) - (roundOrder[b.round] ?? 999);
    if (ro) return ro;
    return (a.matchOrder ?? 0) - (b.matchOrder ?? 0);
  });

  return jsonResponse({
    success: true,
    data: {
      leagueId,
      teamCount: meta.teamCount,
      leagueType: meta.leagueType,
      accessType,
      matches // flat list; no ties
    }
  }, 200);
}