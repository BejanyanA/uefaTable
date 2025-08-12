// routes/update_group_knock_winner_team.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleUpdateKnockoutWinner(request, env) {
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

    if (!knockoutId || typeof knockoutId !== 'number') {
        return jsonResponse({ success: false, error: "knockout_id_required" }, 400);
    }
    if (winner_team_id !== undefined && winner_team_id !== null && typeof winner_team_id !== 'number') {
        return jsonResponse({ success: false, error: "winner_team_id_must_be_number_or_null" }, 400);
    }

    // 1) Find the row and access
    const row = await env.core_data.prepare(`
    SELECT id, league_id, round, match_order, match_type,
           team1_id, team2_id, team1_score, team2_score, winner_team_id
    FROM league_knockouts
    WHERE id = ?
  `).bind(knockoutId).first();

    if (!row) return jsonResponse({ success: false, error: "knockout_not_found" }, 404);

    const owned = await env.core_data.prepare(`
    SELECT 1 FROM leagues WHERE id = ? AND created_by_user_id = ?
  `).bind(row.league_id, userId).first();

    if (!owned) {
        const access = await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(row.league_id, userId).first();
        if (!access) return jsonResponse({ success: false, error: "access_denied" }, 403);
    }

    // 2) Load BOTH legs for this tie
    const legs = await env.core_data.prepare(`
    SELECT id, match_type, team1_id, team2_id, team1_score, team2_score, winner_team_id
    FROM league_knockouts
    WHERE league_id = ? AND round = ? AND match_order = ?
  `).bind(row.league_id, row.round, row.match_order).all();

    if (!legs.results || legs.results.length !== 2) {
        return jsonResponse({ success: false, error: "tie_legs_incomplete" }, 409);
    }

    // Identify unique teams in the tie (should be exactly 2)
    const tA = legs.results[0].team1_id ?? legs.results[0].team2_id;
    const tB = (legs.results[0].team1_id === tA)
        ? legs.results[0].team2_id
        : legs.results[0].team1_id;

    if (tA == null || tB == null) {
        return jsonResponse({ success: false, error: "teams_not_finalized" }, 409);
    }

    // Helper to sum goals for a given team across both legs,
    // considering that team might be on team1 side in one leg and team2 in the other.
    const sumGoalsFor = (teamId) => {
        let goals = 0;
        for (const leg of legs.results) {
            if (leg.team1_id == null || leg.team2_id == null) return null; // placeholder exists
            if (leg.team1_score == null || leg.team2_score == null) return null; // not all scored yet

            goals += (leg.team1_id === teamId) ? Number(leg.team1_score) : (leg.team2_id === teamId) ? Number(leg.team2_score) : 0;
        }
        return goals;
    };

    const goalsA = sumGoalsFor(tA);
    const goalsB = sumGoalsFor(tB);

    // 3) Decide winner
    let decidedWinner = null;
    if (goalsA == null || goalsB == null) {
        // Not all scores present yet; require explicit manual winner (e.g., admin after penalties),
        // or just tell client that aggregate cannot be computed.
        if (winner_team_id == null) {
            return jsonResponse({ success: false, error: "scores_incomplete" }, 409);
        }
    } else if (goalsA > goalsB) {
        decidedWinner = tA;
    } else if (goalsB > goalsA) {
        decidedWinner = tB;
    } else {
        // Aggregate draw
        if (winner_team_id == null) {
            return jsonResponse({
                success: false,
                error: "needs_tiebreak",
                data: { aggregate: { [tA]: goalsA, [tB]: goalsB } }
            }, 409);
        }
    }

    // Validate provided manual winner if any
    const finalWinner = decidedWinner ?? winner_team_id;
    if (finalWinner !== tA && finalWinner !== tB) {
        return jsonResponse({ success: false, error: "invalid_winner_for_tie" }, 422);
    }

    // 4) Persist same winner on BOTH legs for consistency
    const legIds = legs.results.map(l => l.id);
    const placeholders = legIds.map(() => '?').join(',');
    await env.core_data.prepare(`
    UPDATE league_knockouts
    SET winner_team_id = ?, updated_user_id = ?
    WHERE id IN (${placeholders})
  `).bind(finalWinner, userId, ...legIds).run();

    return jsonResponse({
        success: true,
        data: {
            league_id: row.league_id,
            round: row.round,
            match_order: row.match_order,
            winner_team_id: finalWinner
        }
    }, 200);
}