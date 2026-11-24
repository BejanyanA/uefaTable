// routes/update_group_knock_winner_team.js

import { jsonResponse, parseBody } from '../../utils/helper.js';
import { verifyToken } from '../../utils/jwt.js';

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

    if (!knockoutId || typeof knockoutId !== "number") {
        return jsonResponse({ success: false, error: "knockout_id_required" }, 400);
    }
    if (winner_team_id !== undefined && winner_team_id !== null && typeof winner_team_id !== "number") {
        return jsonResponse({ success: false, error: "winner_team_id_must_be_number_or_null" }, 400);
    }

    // 1) Load the edited leg + access (same as in score update)
    const leg = await env.core_data.prepare(`
    SELECT
      lk.id, lk.league_id, lk.round, lk.match_order, lk.match_type,
      lk.team1_id, lk.team2_id, lk.team1_score, lk.team2_score, lk.winner_team_id,
      l.created_by_user_id
    FROM league_knockouts lk
    JOIN leagues l ON l.id = lk.league_id
    WHERE lk.id = ?
  `).bind(knockoutId).first();

    if (!leg) return jsonResponse({ success: false, error: "knockout_not_found" }, 404);

    if (leg.created_by_user_id !== userId) {
        const access = await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(leg.league_id, userId).first();
        if (!access) return jsonResponse({ success: false, error: "access_denied" }, 403);
    }

    if (winner_team_id !== undefined && winner_team_id !== null &&
        winner_team_id !== leg.team1_id && winner_team_id !== leg.team2_id) {
        return jsonResponse({ success: false, error: "winner_team_id_not_in_tie" }, 400);
    }

    // 2) Load BOTH legs for THIS tie (same two teams) - identical filter style
    const pairBinds = [leg.team1_id, leg.team2_id, leg.team2_id, leg.team1_id];
    const tieLegsRes = await env.core_data.prepare(`
    SELECT id, match_type, team1_id, team2_id, team1_score, team2_score, winner_team_id
    FROM league_knockouts lk
    WHERE lk.league_id = ? AND lk.round = ? AND lk.match_order = ?
      AND ${pairWhereClauseSelect('lk')}
    ORDER BY CASE match_type WHEN 'home' THEN 0 ELSE 1 END, id ASC
  `).bind(leg.league_id, leg.round, leg.match_order, ...pairBinds).all();

    const tieLegs = tieLegsRes.results || [];

    // 3) Resolve final winner:
    //    - If client provided winner_team_id, use it (authoritative; may be null to clear)
    //    - Else compute aggregate like your score handler
    let finalWinner;
    if (winner_team_id !== undefined) {
        finalWinner = winner_team_id; // number or null
    } else {
        const agg = computeAggregate(tieLegs);
        if (!agg.complete || agg.draw) {
            // same behavior as score handler: clear winners + clear next round and signal tiebreak if draw
            await env.core_data.prepare(`
        UPDATE league_knockouts
        SET winner_team_id = NULL, updated_user_id = ?
        WHERE league_id = ? AND round = ? AND match_order = ?
          AND ${pairWhereClauseNoAlias()}
      `).bind(userId, leg.league_id, leg.round, leg.match_order, ...pairBinds).run();

            await upsertNextRoundSeed(env, {
                leagueId: leg.league_id,
                currentRound: leg.round,
                matchOrder: leg.match_order,
                tiePairKey: pairKeyOf(leg.team1_id, leg.team2_id),
                winnerTeamId: null,
                userId
            });

            return jsonResponse({
                success: true,
                data: { updated: true, winnerUpdated: false, propagated: "cleared", needsTiebreak: agg.draw }
            }, 200);
        }
        finalWinner = agg.winnerTeamId;
    }

    // 4) Persist same winner on BOTH legs for consistency (or clear if null)
    // If we only found one leg (unusual but possible), still update it; else update both.
    if (tieLegs.length > 0) {
        const ids = tieLegs.map(l => l.id);
        const qs = ids.map(() => "?").join(",");
        await env.core_data.prepare(`
      UPDATE league_knockouts
      SET winner_team_id = ?, updated_user_id = ?
      WHERE id IN (${qs})
    `).bind(finalWinner, userId, ...ids).run();
    } else {
        // Fallback: ensure at least current leg is updated
        await env.core_data.prepare(`
      UPDATE league_knockouts
      SET winner_team_id = ?, updated_user_id = ?
      WHERE id = ?
    `).bind(finalWinner, userId, leg.id).run();
    }

    // 5) Propagate to next round using the SAME helper/logic as score update
    const propagated = await upsertNextRoundSeed(env, {
        leagueId: leg.league_id,
        currentRound: leg.round,
        matchOrder: leg.match_order,
        tiePairKey: pairKeyOf(leg.team1_id, leg.team2_id),
        winnerTeamId: finalWinner, // number → seed; null → clear/delete if empty
        userId
    });

    return jsonResponse({
        success: true,
        data: { updated: true, winnerUpdated: true, propagated }
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
    FROM league_knockouts
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
    FROM league_knockouts
    WHERE league_id = ? AND round = 'final'
    ORDER BY id ASC
    LIMIT 1
  `).bind(leagueId).first();

        // 2) If none exists, create exactly one (home). We don't try to be clever with order; 9 is fine.
        if (!keep) {
            await env.core_data.prepare(`
      INSERT INTO league_knockouts (
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
      FROM league_knockouts
      WHERE league_id = ? AND round = 'final'
      ORDER BY id ASC
      LIMIT 1
    `).bind(leagueId).first();
        }

        // 3) Apply this semifinal winner to that single final row
        if (winnerTeamId == null) {
            await env.core_data.prepare(`
      UPDATE league_knockouts
      SET ${targetField} = NULL, updated_user_id = ?
      WHERE id = ?
    `).bind(userId, keep.id).run();
            return "cleared";
        }

        // Don't overwrite the other side; fill only our side if empty
        await env.core_data.prepare(`
    UPDATE league_knockouts
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
    FROM league_knockouts
    WHERE league_id = ? AND round = ? AND match_order = ?
  `).bind(leagueId, nextRound, nextOrder).all();

    const haveHome = existing.results.some(r => r.match_type === "home");
    const haveAway = existing.results.some(r => r.match_type === "away");

    if (winnerTeamId == null) {
        // clear our side on HOME and opposite on AWAY
        await env.core_data.prepare(`
      UPDATE league_knockouts
      SET ${targetField} = NULL, updated_user_id = ?
      WHERE league_id = ? AND round = ? AND match_order = ? AND match_type = 'home'
    `).bind(userId, leagueId, nextRound, nextOrder).run();

        await env.core_data.prepare(`
      UPDATE league_knockouts
      SET ${otherField} = NULL, updated_user_id = ?
      WHERE league_id = ? AND round = ? AND match_order = ? AND match_type = 'away'
    `).bind(userId, leagueId, nextRound, nextOrder).run();

        const refreshed = await env.core_data.prepare(`
      SELECT team1_id, team2_id, team1_score, team2_score, winner_team_id
      FROM league_knockouts
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
        DELETE FROM league_knockouts
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
      INSERT INTO league_knockouts (
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
    UPDATE league_knockouts
    SET ${targetField} = ?, tie_slot = ?, updated_user_id = ?
    WHERE league_id = ? AND round = ? AND match_order = ? AND match_type = 'home'
  `).bind(winnerTeamId, slot, userId, leagueId, nextRound, nextOrder).run();

    await env.core_data.prepare(`
    UPDATE league_knockouts
    SET ${otherField} = ?, tie_slot = ?, updated_user_id = ?
    WHERE league_id = ? AND round = ? AND match_order = ? AND match_type = 'away'
  `).bind(winnerTeamId, slot, userId, leagueId, nextRound, nextOrder).run();

    return "updated";
}