// routes/update_only_knock_winner_team.js

import { jsonResponse, parseBody } from '../../utils/helper.js';
import { verifyToken } from '../../utils/jwt.js';

export async function handleUpdateNationalOnlyKnockoutWinner(request, env) {
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
  const { knockoutId, winner_team_id } = await parseBody(request);

  if (!knockoutId || typeof knockoutId !== "number") {
    return jsonResponse({ success: false, error: "knockout_id_required" }, 400);
  }
  if (winner_team_id !== undefined && winner_team_id !== null && typeof winner_team_id !== "number") {
    return jsonResponse({ success: false, error: "winner_team_id_must_be_number_or_null" }, 400);
  }

  // 1) Load the match
  const match = await env.core_data.prepare(`
    SELECT
      nk.id, nk.league_id, nk.round, nk.match_order,
      nk.team1_id, nk.team2_id, nk.winner_team_id,
      l.created_by_user_id
    FROM national_round_knockouts nk
    JOIN leagues l ON l.id = nk.league_id
    WHERE nk.id = ?
  `).bind(knockoutId).first();

  if (!match) return jsonResponse({ success: false, error: "knockout_not_found" }, 404);

  // Access check
  if (match.created_by_user_id !== userId) {
    const access = await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(match.league_id, userId).first();
    if (!access) return jsonResponse({ success: false, error: "access_denied" }, 403);
  }

  // 2) Decide winner
  let finalWinner = winner_team_id ?? null;

  // 3) Persist directly on this row
  await env.core_data.prepare(`
    UPDATE national_round_knockouts
    SET winner_team_id = ?, updated_user_id = ?
    WHERE id = ?
  `).bind(finalWinner, userId, knockoutId).run();

  // 4) Propagate to next round (single-leg seeding)
  const propagated = await propagateNationalWinner(env, {
    leagueId: match.league_id,
    currentRound: match.round,
    matchOrder: match.match_order,
    winnerTeamId: finalWinner,
    userId
  });

  return jsonResponse({
    success: true,
    data: { updated: true, winnerUpdated: true, propagated }
  }, 200);
}

/* ---------- helper ---------- */

function nextRoundOf(round) {
  switch (String(round).toLowerCase()) {
    case "1/16": return "1/8";
    case "1/8":  return "1/4";
    case "1/4":  return "1/2";
    case "1/2":  return "final";
    default:     return null;
  }
}

async function propagateNationalWinner(env, { leagueId, currentRound, matchOrder, winnerTeamId, userId }) {
  const nextRound = nextRoundOf(currentRound);
  if (!nextRound) return false;

  const nextOrder = Math.ceil(Number(matchOrder) / 2);
  const slot = (Number(matchOrder) % 2 === 1) ? "team1_id" : "team2_id";

  // Ensure next-round row exists
  let nextRow = await env.core_data.prepare(`
    SELECT id FROM national_round_knockouts
    WHERE league_id = ? AND round = ? AND match_order = ?
  `).bind(leagueId, nextRound, nextOrder).first();

  if (!nextRow) {
    await env.core_data.prepare(`
      INSERT INTO national_round_knockouts (
        league_id, round, match_order,
        team1_id, team2_id, team1_score, team2_score,
        winner_team_id, updated_user_id
      ) VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?)
    `).bind(leagueId, nextRound, nextOrder, userId).run();

    nextRow = await env.core_data.prepare(`
      SELECT id FROM national_round_knockouts
      WHERE league_id = ? AND round = ? AND match_order = ?
    `).bind(leagueId, nextRound, nextOrder).first();
  }

  // Apply winner to correct slot
  await env.core_data.prepare(`
    UPDATE national_round_knockouts
    SET ${slot} = ?, updated_user_id = ?
    WHERE id = ?
  `).bind(winnerTeamId, userId, nextRow.id).run();

  return winnerTeamId ? "updated" : "cleared";
}