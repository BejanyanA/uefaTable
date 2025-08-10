// routes/attach_player.js

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

    // Basic input validation
    if (!knockoutId || typeof knockoutId !== 'number') {
        return jsonResponse({ success: false, error: "knockout_id_required" }, 400);
    }
    // winner_team_id can be null (to clear), or a number
    if (winner_team_id !== null && winner_team_id !== undefined && typeof winner_team_id !== 'number') {
        return jsonResponse({ success: false, error: "winner_team_id_must_be_number_or_null" }, 400);
    }

    // Fetch the knockout row
    const row = await env.core_data.prepare(`
    SELECT id, league_id, team1_id, team2_id, winner_team_id
    FROM league_knockouts
    WHERE id = ?
  `).bind(knockoutId).first();

    if (!row) {
        return jsonResponse({ success: false, error: "knockout_not_found" }, 404);
    }

    // Access check (owner or granted)
    const owned = await env.core_data.prepare(`
    SELECT 1 FROM leagues WHERE id = ? AND created_by_user_id = ?
  `).bind(row.league_id, userId).first();

    if (!owned) {
        const access = await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(row.league_id, userId).first();

        if (!access) {
            return jsonResponse({ success: false, error: "access_denied" }, 403);
        }
    }

    // Ensure both teams are locked in (no placeholders)
    if (row.team1_id == null || row.team2_id == null) {
        return jsonResponse({ success: false, error: "teams_not_finalized" }, 409);
    }

    // If clearing winner (null) – allow and exit early
    if (winner_team_id === null || winner_team_id === undefined) {
        await env.core_data.prepare(`
      UPDATE league_knockouts
      SET winner_team_id = NULL, updated_user_id = ?
      WHERE id = ?
    `).bind(userId, knockoutId).run();

        return jsonResponse({ success: true, data: { id: knockoutId, winner_team_id: null } }, 200);
    }

    // Validate winner belongs to this match
    if (winner_team_id !== row.team1_id && winner_team_id !== row.team2_id) {
        return jsonResponse({ success: false, error: "invalid_winner_for_match" }, 422);
    }

    // Update winner
    await env.core_data.prepare(`
    UPDATE league_knockouts
    SET winner_team_id = ?, updated_user_id = ?
    WHERE id = ?
  `).bind(winner_team_id, userId, knockoutId).run();

    return jsonResponse({
        success: true,
        data: { id: knockoutId, winner_team_id }
    }, 200);
}