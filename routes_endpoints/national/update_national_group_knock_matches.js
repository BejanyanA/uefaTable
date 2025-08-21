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

  // ----- 1) Load match (single leg, neutral) + access
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
    const access = await env.core_data.prepare(
      `SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?`
    ).bind(leg.league_id, userId).first();
    if (!access) return jsonResponse({ success: false, error: "access_denied" }, 403);
  }

  // ----- 2) Update this single neutral leg (partial), clear per-row winner
  const newS1 = (team1_score === undefined) ? leg.team1_score : team1_score;
  const newS2 = (team2_score === undefined) ? leg.team2_score : team2_score;

  await env.core_data.prepare(`
    UPDATE national_knockouts
    SET team1_score = ?, team2_score = ?, winner_team_id = NULL, updated_user_id = ?
    WHERE id = ?
  `).bind(newS1, newS2, userId, matchId).run();

  // Helper: round transitions (case-insensitive input)
  function nextRoundOf(round) {
    if (!round) return null;
    const r = String(round).toLowerCase();
    switch (r) {
      case "1/16": return "1/8";
      case "1/8":  return "1/4";
      case "1/4":  return "1/2";
      case "1/2":  return "Final"; // keep capital F for consistency with reads
      default:     return null;
    }
  }

  // Decide winner (single leg) if both scores present and non-equal
  let winnerTeamId = null;
  let needsTiebreak = false;

  if (newS1 != null && newS2 != null) {
    const a = Number(newS1), b = Number(newS2);
    if (a > b) winnerTeamId = leg.team1_id ?? null;
    else if (b > a) winnerTeamId = leg.team2_id ?? null;
    else needsTiebreak = true; // equal scores: ET/Pens outside this endpoint
  }

  // Write per-row winner for this match (null when draw/unknown)
  await env.core_data.prepare(`
    UPDATE national_knockouts
    SET winner_team_id = ?, updated_user_id = ?
    WHERE id = ?
  `).bind(winnerTeamId, userId, matchId).run();

  // ----- 3) If FINAL, no propagation
  const isFinal = String(leg.round).toLowerCase() === "final";
  if (isFinal) {
    return jsonResponse({
      success: true,
      data: {
        updated: true,
        winnerUpdated: winnerTeamId != null,
        propagated: false,
        needsTiebreak
      }
    }, 200);
  }

  // ----- 4) Seed/clear the NEXT ROUND (single neutral row, no tie slots)
  const nextRound = nextRoundOf(leg.round);
  if (!nextRound) {
    // Unknown round label → treat as terminal
    return jsonResponse({
      success: true,
      data: {
        updated: true,
        winnerUpdated: winnerTeamId != null,
        propagated: false,
        needsTiebreak
      }
    }, 200);
  }

  const nextOrder = Math.ceil(Number(leg.match_order) / 2);
  const targetField = (Number(leg.match_order) % 2 === 1) ? "team1_id" : "team2_id";
  const otherField  = targetField === "team1_id" ? "team2_id" : "team1_id";

  // Ensure a single neutral row exists for the next round/order
  let nextRow = await env.core_data.prepare(`
    SELECT id, team1_id, team2_id, team1_score, team2_score, winner_team_id
    FROM national_knockouts
    WHERE league_id = ? AND round = ? AND match_order = ?
    LIMIT 1
  `).bind(leg.league_id, nextRound, nextOrder).first();

  if (!nextRow) {
    await env.core_data.prepare(`
      INSERT INTO national_knockouts
        (league_id, "round", match_order, match_type,
         team1_id, team2_id, team1_user_id, team2_user_id,
         team1_score, team2_score, winner_team_id,
         is_vs_computer, computer_team, updated_user_id)
      VALUES (?, ?, ?, 'neutral',
              NULL, NULL, NULL, NULL,
              NULL, NULL, NULL,
              0, NULL, ?)
    `).bind(leg.league_id, nextRound, nextOrder, userId).run();

    nextRow = await env.core_data.prepare(`
      SELECT id, team1_id, team2_id, team1_score, team2_score, winner_team_id
      FROM national_knockouts
      WHERE league_id = ? AND round = ? AND match_order = ?
      LIMIT 1
    `).bind(leg.league_id, nextRound, nextOrder).first();
  }

  // Apply propagation (set/clear one side)
  let propagated = "none";
  if (winnerTeamId == null) {
    // clear our side
    await env.core_data.prepare(`
      UPDATE national_knockouts
      SET ${targetField} = NULL, updated_user_id = ?
      WHERE id = ?
    `).bind(userId, nextRow.id).run();
    propagated = "cleared";

    // Optional cleanup: if row is now completely empty, delete it
    const refreshed = await env.core_data.prepare(`
      SELECT team1_id, team2_id, team1_score, team2_score, winner_team_id
      FROM national_knockouts
      WHERE id = ?
    `).bind(nextRow.id).first();

    const emptyRow = refreshed &&
      refreshed.team1_id == null && refreshed.team2_id == null &&
      refreshed.team1_score == null && refreshed.team2_score == null &&
      refreshed.winner_team_id == null;

    if (emptyRow) {
      await env.core_data.prepare(`DELETE FROM national_knockouts WHERE id = ?`)
        .bind(nextRow.id).run();
      propagated = "deleted";
    }

  } else {
    // set our side to winner
    await env.core_data.prepare(`
      UPDATE national_knockouts
      SET ${targetField} = ?, updated_user_id = ?
      WHERE id = ?
    `).bind(winnerTeamId, userId, nextRow.id).run();
    propagated = "updated";
  }

  return jsonResponse({
    success: true,
    data: {
      updated: true,
      winnerUpdated: true,     // we always wrote winner (possibly null) on the edited match
      propagated,
      needsTiebreak
    }
  }, 200);
}