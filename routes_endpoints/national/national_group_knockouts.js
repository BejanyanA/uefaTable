// routes/Knockout Matches.js

import { jsonResponse, parseBody } from '../../utils/helper.js';
import { verifyToken } from '../../utils/jwt.js';

export async function handleNationalGroupKnockoutMatches(request, env) {
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

  // --- meta + access in one query ---
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

  // --- fetch KO rows, with group info ---
  const rows = await env.core_data.prepare(`
    WITH tg AS (
      SELECT
        gs.team_id,
        lg.id         AS group_id,
        lg.group_name AS group_name,
        ROW_NUMBER() OVER (
          PARTITION BY gs.team_id
          ORDER BY gs.played DESC, lg.id ASC
        ) AS rn
      FROM country_group_standings gs
      JOIN league_groups lg    ON lg.id = gs.group_id
      JOIN league_instances li ON li.id = lg.league_instance_id
      WHERE li.league_id = ?
    )
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
      ac2.logo_url AS team2_logo_url,

      tg1.group_id   AS team1_group_id,
      tg1.group_name AS team1_group_name,
      tg2.group_id   AS team2_group_id,
      tg2.group_name AS team2_group_name

    FROM national_knockouts nk
    LEFT JOIN all_countries ac1 ON ac1.id = nk.team1_id
    LEFT JOIN all_countries ac2 ON ac2.id = nk.team2_id
    LEFT JOIN tg tg1        ON tg1.team_id = nk.team1_id AND tg1.rn = 1
    LEFT JOIN tg tg2        ON tg2.team_id = nk.team2_id AND tg2.rn = 1
    WHERE nk.league_id = ?
    ORDER BY nk.round, nk.match_order
  `).bind(leagueId, leagueId).all();

  // --- flat matches, all neutral ---
  const roundOrder = { "1/16": 1, "1/8": 2, "1/4": 3, "1/2": 4, "Final": 5 };

  const matches = (rows.results || []).map(r => {
    const team1 = {
      id: r.team1_id, name: r.team1_name, logo_url: r.team1_logo_url, userId: r.team1_user_id,
      groupId: r.team1_group_id ?? null, groupName: r.team1_group_name ?? null
    };
    const team2 = {
      id: r.team2_id, name: r.team2_name, logo_url: r.team2_logo_url, userId: r.team2_user_id,
      groupId: r.team2_group_id ?? null, groupName: r.team2_group_name ?? null
    };

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
      matchType: "neutral", // always neutral
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
      matches // flat neutral matches with group info
    }
  }, 200);
}