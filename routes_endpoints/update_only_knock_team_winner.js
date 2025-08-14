// routes/update_only_knock_winner_team.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleUpdateOnlyKnockoutWinner(request, env) {
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

    // ---- input ----
    const { knockoutId, winner_team_id } = await parseBody(request);
    if (!knockoutId || typeof knockoutId !== "number") {
        return jsonResponse({ success: false, error: "knockout_id_required" }, 400);
    }
    if (winner_team_id !== undefined && winner_team_id !== null && typeof winner_team_id !== "number") {
        return jsonResponse({ success: false, error: "winner_team_id_must_be_number_or_null" }, 400);
    }

    // ---- load row + access ----
    const row = await env.core_data.prepare(`
    SELECT lk.id, lk.league_id, lk.round, lk.match_order, lk.match_type,
           lk.team1_id, lk.team2_id, lk.team1_score, lk.team2_score, lk.winner_team_id,
           l.created_by_user_id
    FROM round_knockouts lk
    JOIN leagues l ON l.id = lk.league_id
    WHERE lk.id = ?
  `).bind(knockoutId).first();
    if (!row) return jsonResponse({ success: false, error: "knockout_not_found" }, 404);

    if (row.created_by_user_id !== userId) {
        const access = await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(row.league_id, userId).first();
        if (!access) return jsonResponse({ success: false, error: "access_denied" }, 403);
    }

    // ---- load BOTH legs for THIS tie (same (league, round, match_order)) ----
    const legsRes = await env.core_data.prepare(`
    SELECT id, match_type, team1_id, team2_id, team1_score, team2_score, winner_team_id
    FROM round_knockouts
    WHERE league_id = ? AND round = ? AND match_order = ?
    ORDER BY CASE match_type WHEN 'home' THEN 0 ELSE 1 END, id ASC
  `).bind(row.league_id, row.round, row.match_order).all();

    const legs = legsRes.results || [];
    if (legs.length !== 2) {
        return jsonResponse({ success: false, error: "tie_legs_incomplete" }, 409);
    }

    // ---- identify teams in this tie (must be exactly 2) ----
    const collectIds = new Set();
    for (const l of legs) {
        if (l.team1_id != null) collectIds.add(Number(l.team1_id));
        if (l.team2_id != null) collectIds.add(Number(l.team2_id));
    }
    if (collectIds.size !== 2) {
        // tie not fully slotted yet
        if (winner_team_id == null) {
            return jsonResponse({ success: false, error: "teams_not_finalized" }, 409);
        }
    }
    const ids = [...collectIds];
    const tA = ids[0] ?? null;
    const tB = ids[1] ?? null;

    // ---- aggregate if possible; otherwise respect manual winner ----
    const fullyScored = legs.every(l =>
        l.team1_id != null && l.team2_id != null &&
        l.team1_score != null && l.team2_score != null
    );

    let decidedWinner = null;
    if (fullyScored && tA != null && tB != null) {
        const totals = new Map();
        totals.set(tA, 0);
        totals.set(tB, 0);
        for (const l of legs) {
            totals.set(l.team1_id, (totals.get(l.team1_id) || 0) + Number(l.team1_score));
            totals.set(l.team2_id, (totals.get(l.team2_id) || 0) + Number(l.team2_score));
        }
        const a = totals.get(tA) ?? 0;
        const b = totals.get(tB) ?? 0;
        if (a > b) decidedWinner = tA;
        else if (b > a) decidedWinner = tB;
        // if a === b → draw; require manual winner_team_id or allow clearing
    }

    // winner resolution:
    // - if aggregate decided → use decidedWinner
    // - else if manual provided → use manual (may be null to CLEAR)
    // - else → cannot decide
    let finalWinner = null;
    if (decidedWinner != null) {
        finalWinner = decidedWinner;
    } else if (winner_team_id !== undefined) {
        finalWinner = winner_team_id; // may be number or null (clear)
    } else {
        return jsonResponse({ success: false, error: "scores_incomplete_or_draw_needs_manual" }, 409);
    }

    // If finalWinner is a number, ensure it matches one of the two teams (when known)
    if (finalWinner != null && tA != null && tB != null && finalWinner !== tA && finalWinner !== tB) {
        return jsonResponse({ success: false, error: "invalid_winner_for_tie" }, 422);
    }

    // ---- persist winner on BOTH legs (or clear) ----
    // Use team-pair WHERE to avoid big IN (...) and be stable across edits
    const pairBinds = (tA != null && tB != null)
        ? [tA, tB, tB, tA]
        : [row.team1_id, row.team2_id, row.team2_id, row.team1_id]; // fallback if ids were partially null

    await env.core_data.prepare(`
    UPDATE round_knockouts
    SET winner_team_id = ?, updated_user_id = ?
    WHERE league_id = ? AND round = ? AND match_order = ?
      AND (
        (team1_id = ? AND team2_id = ?) OR
        (team1_id = ? AND team2_id = ?)
      )
  `).bind(finalWinner, userId, row.league_id, row.round, row.match_order, ...pairBinds).run();

    // ---- propagate to next round using your existing helper ----
    // tiePairKey is stable and order-insensitive
    const tiePairKey =
        (tA != null && tB != null) ? pairKeyOf(tA, tB)
            : pairKeyOf(row.team1_id, row.team2_id); // fallback

    const propagated = await upsertNextRoundSeed(env, {
        leagueId: row.league_id,
        currentRound: row.round,
        matchOrder: row.match_order,
        tiePairKey,
        winnerTeamId: finalWinner,  // may be null → will clear/delete as needed
        userId
    });

    return jsonResponse({
        success: true,
        data: {
            league_id: row.league_id,
            round: row.round,
            match_order: row.match_order,
            winner_team_id: finalWinner,
            propagated
        }
    }, 200);
}





/* ---------- helpers ---------- */

function nextRoundOf(round) {
    switch (round) {
        case "1/16": return "1/8";
        case "1/8": return "1/4";
        case "1/4": return "1/2";
        case "1/2": return "final";
        default: return null;
    }
}

function computeAggregate(legs) {
    // Must have exactly 2 legs with both scores present
    if (!Array.isArray(legs) || legs.length !== 2) {
        return { complete: false, draw: false, winnerTeamId: null };
    }

    const scored = legs.every(l =>
        l != null &&
        l.team1_id != null && l.team2_id != null &&
        l.team1_score != null && l.team2_score != null
    );
    if (!scored) return { complete: false, draw: false, winnerTeamId: null };

    // Sum per team id, independent of which side they appear on in each leg
    const totals = new Map(); // teamId -> total goals
    for (const l of legs) {
        totals.set(l.team1_id, (totals.get(l.team1_id) || 0) + Number(l.team1_score));
        totals.set(l.team2_id, (totals.get(l.team2_id) || 0) + Number(l.team2_score));
    }

    const ids = [...totals.keys()];
    if (ids.length !== 2) {
        // data anomaly; refuse to pick a winner
        return { complete: false, draw: false, winnerTeamId: null };
    }

    const [A, B] = ids;
    const a = totals.get(A);
    const b = totals.get(B);

    if (a === b) return { complete: true, draw: true, winnerTeamId: null };
    return { complete: true, draw: false, winnerTeamId: a > b ? A : B };
}

const pairWhereClauseSelect = (alias) => `(
  (${alias}.team1_id = ? AND ${alias}.team2_id = ?)
  OR
  (${alias}.team1_id = ? AND ${alias}.team2_id = ?)
)`;
const pairWhereClauseNoAlias = () => `(
  (team1_id = ? AND team2_id = ?)
  OR
  (team1_id = ? AND team2_id = ?)
)`;

// stable key for a tie's two teams (order-insensitive)
function pairKeyOf(a, b) {
    if (a == null || b == null) return null;
    const x = Number(a), y = Number(b);
    return (x < y) ? `${x}-${y}` : `${y}-${x}`;
}

// const oppositeField = (f) => (f === "team1_id" ? "team2_id" : "team1_id");

/**
 * Decide & upsert the next-round slot for THIS tie (with tie_slot),
 * mirror home/away legs (home uses slot side, away uses opposite),
 * and delete empty next-round legs when cleared.
 *
 * tie_slot: 1 => this tie seeds team1 side (home leg)
 *           2 => this tie seeds team2 side (home leg)
 */
const oppositeField = (f) => (f === "team1_id" ? "team2_id" : "team1_id");

async function upsertNextRoundSeed(env, { leagueId, currentRound, matchOrder, tiePairKey, winnerTeamId, userId }) {
    const nextRound = nextRoundOf(currentRound);
    if (!nextRound) return false;

    const nextOrder = Math.ceil(Number(matchOrder) / 2);

    // decide our slot among pairs inside THIS (round, match_order)
    const rows = await env.core_data.prepare(`
    SELECT team1_id, team2_id
    FROM round_knockouts
    WHERE league_id = ? AND round = ? AND match_order = ?
      AND team1_id IS NOT NULL AND team2_id IS NOT NULL
  `).bind(leagueId, currentRound, matchOrder).all();

    const pairKeys = Array.from(new Set(rows.results
        .map(r => pairKeyOf(r.team1_id, r.team2_id))
        .filter(Boolean))).sort();

    // default slot by pair index when there are 2 pairs; otherwise by order parity
    let slot = 1;
    if (tiePairKey && pairKeys.length > 1) {
        const idx = pairKeys.indexOf(tiePairKey); // 0 or 1
        slot = (idx <= 0) ? 1 : 2;
    } else if (pairKeys.length <= 1) {
        const firstOrder = nextOrder * 2 - 1;
        const secondOrder = nextOrder * 2;
        if (Number(matchOrder) === secondOrder) slot = 2; // else 1
    }
    const targetField = slot === 1 ? "team1_id" : "team2_id";
    const otherField = oppositeField(targetField);

    // ---------- FINAL: single leg only ----------
    if (nextRound === "final") {
        // Map SF order to slot without relying on nextOrder
        const slot = (Number(matchOrder) % 2 === 0) ? 1 : 2; // even SF -> team1, odd SF -> team2
        const targetField = slot === 1 ? "team1_id" : "team2_id";

        // 1) Find a canonical final row (oldest) if any
        let keep = await env.core_data.prepare(`
    SELECT id, match_order
    FROM round_knockouts
    WHERE league_id = ? AND round = 'final'
    ORDER BY id ASC
    LIMIT 1
  `).bind(leagueId).first();

        // 2) If none exists, create exactly one (home). We don't try to be clever with order; 9 is fine.
        if (!keep) {
            await env.core_data.prepare(`
      INSERT INTO round_knockouts (
        league_id, round, match_order, match_type,
        team1_id, team2_id,
        team1_user_id, team2_user_id,
        team1_score, team2_score, winner_team_id,
        is_vs_computer, computer_team, tie_slot, updated_user_id
      ) VALUES (?, 'final', 9, 'home',
                NULL, NULL, NULL, NULL,
                NULL, NULL, NULL,
                0, NULL, NULL, ?)
    `).bind(leagueId, userId).run();

            keep = await env.core_data.prepare(`
      SELECT id, match_order
      FROM round_knockouts
      WHERE league_id = ? AND round = 'final'
      ORDER BY id ASC
      LIMIT 1
    `).bind(leagueId).first();
        }

        // 3) Apply this semifinal winner to that single final row
        if (winnerTeamId == null) {
            await env.core_data.prepare(`
      UPDATE round_knockouts
      SET ${targetField} = NULL, updated_user_id = ?
      WHERE id = ?
    `).bind(userId, keep.id).run();
            return "cleared";
        }

        // Don't overwrite the other side; fill only our side if empty
        await env.core_data.prepare(`
    UPDATE round_knockouts
    SET ${targetField} = ?, tie_slot = ?, updated_user_id = ?
    WHERE id = ?
  `).bind(winnerTeamId, slot, userId, keep.id).run();

        // NOTE: If there are extra final rows (legacy), we ignore them—no deletes, no schema changes.
        return "updated";
    }

    // ---------- NON-FINAL: 2 legs (home/away) with mirroring ----------

    // What exists now?
    const existing = await env.core_data.prepare(`
    SELECT id, match_type, team1_id, team2_id, team1_score, team2_score, winner_team_id, tie_slot
    FROM round_knockouts
    WHERE league_id = ? AND round = ? AND match_order = ?
  `).bind(leagueId, nextRound, nextOrder).all();

    const haveHome = existing.results.some(r => r.match_type === "home");
    const haveAway = existing.results.some(r => r.match_type === "away");

    if (winnerTeamId == null) {
        // clear our side on HOME and opposite on AWAY
        await env.core_data.prepare(`
      UPDATE round_knockouts
      SET ${targetField} = NULL, updated_user_id = ?
      WHERE league_id = ? AND round = ? AND match_order = ? AND match_type = 'home'
    `).bind(userId, leagueId, nextRound, nextOrder).run();

        await env.core_data.prepare(`
      UPDATE round_knockouts
      SET ${otherField} = NULL, updated_user_id = ?
      WHERE league_id = ? AND round = ? AND match_order = ? AND match_type = 'away'
    `).bind(userId, leagueId, nextRound, nextOrder).run();

        const refreshed = await env.core_data.prepare(`
      SELECT team1_id, team2_id, team1_score, team2_score, winner_team_id
      FROM round_knockouts
      WHERE league_id = ? AND round = ? AND match_order = ?
    `).bind(leagueId, nextRound, nextOrder).all();

        const bothEmpty = refreshed.results.length >= 2 &&
            refreshed.results.every(r =>
                r.team1_id == null && r.team2_id == null &&
                r.team1_score == null && r.team2_score == null &&
                r.winner_team_id == null
            );

        if (bothEmpty) {
            await env.core_data.prepare(`
        DELETE FROM round_knockouts
        WHERE league_id = ? AND round = ? AND match_order = ?
      `).bind(leagueId, nextRound, nextOrder).run();
            return "deleted";
        }
        return (haveHome || haveAway) ? "cleared" : "none";
    }

    // Winner present → ensure both legs exist; insert missing ones with mirrored sides
    async function insertLeg(matchType, putOnTargetSide) {
        const placeField = putOnTargetSide ? targetField : otherField;
        const t1 = placeField === "team1_id" ? winnerTeamId : null;
        const t2 = placeField === "team2_id" ? winnerTeamId : null;

        await env.core_data.prepare(`
      INSERT INTO round_knockouts (
        league_id, round, match_order, match_type,
        team1_id, team2_id,
        team1_user_id, team2_user_id,
        team1_score, team2_score,
        winner_team_id,
        is_vs_computer, computer_team,
        tie_slot,
        updated_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 0, NULL, ?, ?)
    `).bind(leagueId, nextRound, nextOrder, matchType, t1, t2, slot, userId).run();
    }

    // HOME first, then AWAY — deterministic order
    if (!haveHome) await insertLeg("home", true);
    if (!haveAway) await insertLeg("away", false);

    await env.core_data.prepare(`
    UPDATE round_knockouts
    SET ${targetField} = ?, tie_slot = ?, updated_user_id = ?
    WHERE league_id = ? AND round = ? AND match_order = ? AND match_type = 'home'
  `).bind(winnerTeamId, slot, userId, leagueId, nextRound, nextOrder).run();

    await env.core_data.prepare(`
    UPDATE round_knockouts
    SET ${otherField} = ?, tie_slot = ?, updated_user_id = ?
    WHERE league_id = ? AND round = ? AND match_order = ? AND match_type = 'away'
  `).bind(winnerTeamId, slot, userId, leagueId, nextRound, nextOrder).run();

    return "updated";
}