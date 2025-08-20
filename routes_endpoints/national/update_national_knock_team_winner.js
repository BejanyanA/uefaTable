// routes/update_group_knock_winner_team.js

import { jsonResponse, parseBody } from '../../utils/helper.js';
import { verifyToken } from '../../utils/jwt.js';

export async function handleUpdateNationalKnockoutWinner(request, env) {
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

  // 1) Load the edited match + access
  const leg = await env.core_data.prepare(`
    SELECT
      nk.id, nk.league_id, nk.round, nk.match_order, nk.match_type,
      nk.team1_id, nk.team2_id, nk.team1_score, nk.team2_score, nk.winner_team_id,
      l.created_by_user_id
    FROM national_knockouts nk
    JOIN leagues l ON l.id = nk.league_id
    WHERE nk.id = ?
  `).bind(knockoutId).first();

  if (!leg) return jsonResponse({ success: false, error: "knockout_not_found" }, 404);

  if (leg.created_by_user_id !== userId) {
    const access = await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(leg.league_id, userId).first();
    if (!access) return jsonResponse({ success: false, error: "access_denied" }, 403);
  }

  // 2) Resolve winner for this SINGLE leg
  //    - If client provides winner_team_id, use it (may be null to clear)
  //    - Else decide from scores if possible; draw => needsTiebreak
  let finalWinner;
  let needsTiebreak = false;

  if (winner_team_id !== undefined) {
    finalWinner = winner_team_id; // number or null
  } else {
    const s1 = leg.team1_score;
    const s2 = leg.team2_score;
    if (s1 == null || s2 == null) {
      finalWinner = null; // can't decide yet
    } else if (Number(s1) > Number(s2)) {
      finalWinner = leg.team1_id ?? null;
    } else if (Number(s2) > Number(s1)) {
      finalWinner = leg.team2_id ?? null;
    } else {
      finalWinner = null; // draw → leave null, UI handles ET/Pens
      needsTiebreak = true;
    }
  }

  // 3) Persist winner on THIS match (single row)
  await env.core_data.prepare(`
    UPDATE national_knockouts
    SET winner_team_id = ?, updated_user_id = ?
    WHERE id = ?
  `).bind(finalWinner, userId, leg.id).run();

  // 4) Final round doesn't propagate
  if (String(leg.round).toLowerCase() === "final") {
    return jsonResponse({
      success: true,
      data: { updated: true, winnerUpdated: true, propagated: false, needsTiebreak }
    }, 200);
  }

  // 5) Propagate to next round (single‑leg, neutral; no tie_slot)
  const propagated = await upsertNextRoundSeedSingle(env, {
    leagueId: leg.league_id,
    currentRound: leg.round,
    matchOrder: leg.match_order,
    winnerTeamId: finalWinner,   // number → seed; null → clear/delete if empty
    userId
  });

  return jsonResponse({
    success: true,
    data: { updated: true, winnerUpdated: true, propagated, needsTiebreak }
  }, 200);
}

/* ---------- helpers (only what’s needed for 1‑leg) ---------- */

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
 * Single‑leg propagation rules:
 * - nextOrder = ceil(matchOrder / 2)
 * - odd current match_order → put winner in next.team1_id
 *   even current match_order → put winner in next.team2_id
 * - create next round row if missing (as 'neutral')
 * - if clearing (winnerTeamId = null): null only our slot; delete the next row if both sides empty & no scores/winner
 */
async function upsertNextRoundSeedSingle(env, { leagueId, currentRound, matchOrder, winnerTeamId, userId }) {
  const nextRound = nextRoundOf(currentRound);
  if (!nextRound) return false;

  const nextOrder = Math.ceil(Number(matchOrder) / 2);
  const targetField = (Number(matchOrder) % 2 === 1) ? "team1_id" : "team2_id";

  // Ensure next-round row exists (single neutral leg)
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
                NULL, NULL,
                NULL, NULL,
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

    // Delete the next row if fully empty
    const r = await env.core_data.prepare(`
      SELECT team1_id, team2_id, team1_score, team2_score, winner_team_id
      FROM national_knockouts
      WHERE id = ?
    `).bind(nextRow.id).first();

    const empty = r &&
      r.team1_id == null && r.team2_id == null &&
      r.team1_score == null && r.team2_score == null &&
      r.winner_team_id == null;

    if (empty) {
      await env.core_data.prepare(`DELETE FROM national_knockouts WHERE id = ?`)
        .bind(nextRow.id).run();
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