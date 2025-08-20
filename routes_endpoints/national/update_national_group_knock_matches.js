// routes/update_group_knock_matches.js

import { jsonResponse, parseBody } from '../../utils/helper.js';
import { verifyToken } from '../../utils/jwt.js';

export async function handleUpdateNationalKnockoutMatches(request, env) {
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

  // Input
  const { matchId, team1_score, team2_score } = await parseBody(request);
  if (!matchId || typeof matchId !== "number") {
    return jsonResponse({ success: false, error: "knockout_id_required" }, 400);
  }
  const s1ok = team1_score === undefined || team1_score === null || typeof team1_score === "number";
  const s2ok = team2_score === undefined || team2_score === null || typeof team2_score === "number";
  if (!s1ok || !s2ok) {
    return jsonResponse({ success: false, error: "scores_must_be_number_or_null" }, 400);
  }

  // 1) Load edited match + access
  const leg = await env.core_data.prepare(`
    SELECT
      nk.id, nk.league_id, nk.round, nk.match_order, nk.match_type,
      nk.team1_id, nk.team2_id, nk.team1_score, nk.team2_score, nk.winner_team_id,
      l.created_by_user_id
    FROM national_knockouts nk
    JOIN leagues l ON l.id = nk.league_id
    WHERE nk.id = ?
  `).bind(matchId).first();
  if (!leg) return jsonResponse({ success: false, error: "knockout_not_found" }, 404);

  if (leg.created_by_user_id !== userId) {
    const access = await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(leg.league_id, userId).first();
    if (!access) return jsonResponse({ success: false, error: "access_denied" }, 403);
  }

  // 2) Update this match (partial), clear per-row winner first
  const newS1 = (team1_score === undefined) ? leg.team1_score : team1_score;
  const newS2 = (team2_score === undefined) ? leg.team2_score : team2_score;

  await env.core_data.prepare(`
    UPDATE national_knockouts
    SET team1_score = ?, team2_score = ?, winner_team_id = NULL, updated_user_id = ?
    WHERE id = ?
  `).bind(newS1, newS2, userId, matchId).run();

  // Decide winner for this single leg (if possible)
  let decidedWinner = null;
  let needsTiebreak = false;
  if (newS1 != null && newS2 != null) {
    if (Number(newS1) > Number(newS2)) decidedWinner = leg.team1_id ?? null;
    else if (Number(newS2) > Number(newS1)) decidedWinner = leg.team2_id ?? null;
    else needsTiebreak = true; // draw in single leg → ET/Pens externally
  }

  if (decidedWinner != null) {
    await env.core_data.prepare(`
      UPDATE national_knockouts
      SET winner_team_id = ?, updated_user_id = ?
      WHERE id = ?
    `).bind(decidedWinner, userId, matchId).run();
  }

  // ---------- FINAL: single match (no propagation beyond final) ----------
  if (String(leg.round).toLowerCase() === "final") {
    return jsonResponse({
      success: true,
      data: {
        updated: true,
        winnerUpdated: decidedWinner != null,
        propagated: false,
        needsTiebreak
      }
    }, 200);
  }

  // 3) Propagate to next round (single-leg)
  const propagated = await upsertNextRoundSeedSingle(env, {
    leagueId: leg.league_id,
    currentRound: leg.round,
    matchOrder: leg.match_order,
    winnerTeamId: decidedWinner,  // may be null on draw/unknown
    userId
  });

  return jsonResponse({
    success: true,
    data: { updated: true, winnerUpdated: decidedWinner != null, propagated, needsTiebreak }
  }, 200);
}

/* ---------- helpers (trimmed for 1-leg) ---------- */

function nextRoundOf(round) {
  switch (String(round).toLowerCase()) {
    case "1/16": return "1/8";
    case "1/8":  return "1/4";
    case "1/4":  return "1/2";
    case "1/2":  return "final";
    default:     return null;
  }
}

/**
 * Single-leg propagation:
 * - nextOrder = ceil(matchOrder / 2)
 * - if current matchOrder is ODD → winner goes to next.team1_id
 *   if EVEN → winner goes to next.team2_id
 * - create the next-round row if missing as a 'neutral' match
 * - if clearing (winnerTeamId = null), null only that slot; delete the row if both sides empty & no scores/winner
 */
async function upsertNextRoundSeedSingle(env, { leagueId, currentRound, matchOrder, winnerTeamId, userId }) {
  const nextRound = nextRoundOf(currentRound);
  if (!nextRound) return false;

  const nextOrder = Math.ceil(Number(matchOrder) / 2);
  const targetField = (Number(matchOrder) % 2 === 1) ? "team1_id" : "team2_id";

  // Ensure next-round row exists
  let nextRow = await env.core_data.prepare(`
    SELECT id, team1_id, team2_id, team1_score, team2_score, winner_team_id
    FROM national_knockouts
    WHERE league_id = ? AND round = ? AND match_order = ?
    LIMIT 1
  `).bind(leagueId, nextRound, nextOrder).first();

  if (!nextRow) {
    await env.core_data.prepare(`
      INSERT INTO national_knockouts (
        league_id, round, match_order, match_type,
        team1_id, team2_id,
        team1_user_id, team2_user_id,
        team1_score, team2_score, winner_team_id,
        is_vs_computer, computer_team, updated_user_id
      ) VALUES (?, ?, ?, 'neutral',
                NULL, NULL, NULL, NULL,
                NULL, NULL, NULL,
                0, NULL, ?)
    `).bind(leagueId, nextRound, nextOrder, userId).run();

    nextRow = await env.core_data.prepare(`
      SELECT id, team1_id, team2_id, team1_score, team2_score, winner_team_id
      FROM national_knockouts
      WHERE league_id = ? AND round = ? AND match_order = ?
      LIMIT 1
    `).bind(leagueId, nextRound, nextOrder).first();
  }

  if (winnerTeamId == null) {
    // Clear only our slot
    await env.core_data.prepare(`
      UPDATE national_knockouts
      SET ${targetField} = NULL, updated_user_id = ?
      WHERE id = ?
    `).bind(userId, nextRow.id).run();

    // If the next row is fully empty (no teams, no scores, no winner), delete it
    const refreshed = await env.core_data.prepare(`
      SELECT team1_id, team2_id, team1_score, team2_score, winner_team_id
      FROM national_knockouts
      WHERE id = ?
    `).bind(nextRow.id).first();

    const empty =
      refreshed &&
      refreshed.team1_id == null && refreshed.team2_id == null &&
      refreshed.team1_score == null && refreshed.team2_score == null &&
      refreshed.winner_team_id == null;

    if (empty) {
      await env.core_data.prepare(`
        DELETE FROM national_knockouts
        WHERE id = ?
      `).bind(nextRow.id).run();
      return "deleted";
    }
    return "cleared";
  }

  // Winner present → set our slot
  await env.core_data.prepare(`
    UPDATE national_knockouts
    SET ${targetField} = ?, updated_user_id = ?
    WHERE id = ?
  `).bind(winnerTeamId, userId, nextRow.id).run();

  return "updated";
}