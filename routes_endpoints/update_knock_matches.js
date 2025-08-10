// routes/update_knock_matches.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleUpdateKnockoutMatches(request, env) {
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

  // Helpers
  const nextRoundOf = (round) => {
    switch (round) {
      case "1/16": return "1/8";
      case "1/8": return "1/4";
      case "1/4": return "1/2";
      case "1/2": return "final";
      default: return null;
    }
  };

  const computeAggregate = (legs) => {
    if (legs.length !== 2) return { complete: false, draw: false, winnerTeamId: null };
    const allScored = legs.every(l => l.team1_score !== null && l.team2_score !== null);
    if (!allScored) return { complete: false, draw: false, winnerTeamId: null };
    const tA = legs[0].team1_id, tB = legs[0].team2_id;
    if (tA == null || tB == null) return { complete: false, draw: false, winnerTeamId: null };

    let a = 0, b = 0;
    for (const l of legs) {
      a += (l.team1_id === tA) ? Number(l.team1_score) : (l.team2_id === tA ? Number(l.team2_score) : 0);
      b += (l.team1_id === tB) ? Number(l.team1_score) : (l.team2_id === tB ? Number(l.team2_score) : 0);
    }
    if (a === b) return { complete: true, draw: true, winnerTeamId: null };
    return { complete: true, draw: false, winnerTeamId: a > b ? tA : tB };
  };

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

  // 1) Load edited leg + access
  const leg = await env.core_data.prepare(`
    SELECT
      lk.id, lk.league_id, lk.round, lk.match_order, lk.match_type,
      lk.team1_id, lk.team2_id, lk.team1_score, lk.team2_score,
      l.created_by_user_id
    FROM league_knockouts lk
    JOIN leagues l ON l.id = lk.league_id
    WHERE lk.id = ?
  `).bind(matchId).first();
  if (!leg) return jsonResponse({ success: false, error: "knockout_not_found" }, 404);

  if (leg.created_by_user_id !== userId) {
    const access = await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(leg.league_id, userId).first();
    if (!access) return jsonResponse({ success: false, error: "access_denied" }, 403);
  }

  // 2) Update this leg (partial), clear per-row winner
  const newS1 = (team1_score === undefined) ? leg.team1_score : team1_score;
  const newS2 = (team2_score === undefined) ? leg.team2_score : team2_score;

  await env.core_data.prepare(`
    UPDATE league_knockouts
    SET team1_score = ?, team2_score = ?, winner_team_id = NULL, updated_user_id = ?
    WHERE id = ?
  `).bind(newS1, newS2, userId, matchId).run();

  // 3) Load BOTH legs for THIS tie (same two teams)
  const pairBinds = [leg.team1_id, leg.team2_id, leg.team2_id, leg.team1_id];
  const tieLegs = await env.core_data.prepare(`
    SELECT id, match_type, team1_id, team2_id, team1_score, team2_score, winner_team_id
    FROM league_knockouts lk
    WHERE lk.league_id = ? AND lk.round = ? AND lk.match_order = ?
      AND ${pairWhereClauseSelect('lk')}
  `).bind(leg.league_id, leg.round, leg.match_order, ...pairBinds).all();

  if (!tieLegs.results || tieLegs.results.length !== 2) {
    return jsonResponse({ success: true, data: { updated: true, winnerUpdated: false, propagated: false } }, 200);
  }

  // previous winner, if consistent
  let previousWinner = null;
  {
    const winners = new Set(tieLegs.results.map(r => r.winner_team_id).filter(v => v != null));
    previousWinner = (winners.size === 1) ? [...winners][0] : null;
  }

  // 4) Aggregate decision for THIS tie
  const agg = computeAggregate(tieLegs.results);

  if (!agg.complete || agg.draw) {
    // Clear winners on this tie only
    await env.core_data.prepare(`
      UPDATE league_knockouts
      SET winner_team_id = NULL, updated_user_id = ?
      WHERE league_id = ? AND round = ? AND match_order = ?
        AND ${pairWhereClauseNoAlias()}
    `).bind(userId, leg.league_id, leg.round, leg.match_order, ...pairBinds).run();

    // Clear this tie's slot in next round; delete legs if now empty
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

  // winner decided → set on both legs of THIS tie
  if (agg.winnerTeamId !== previousWinner) {
    await env.core_data.prepare(`
      UPDATE league_knockouts
      SET winner_team_id = ?, updated_user_id = ?
      WHERE league_id = ? AND round = ? AND match_order = ?
        AND ${pairWhereClauseNoAlias()}
    `).bind(agg.winnerTeamId, userId, leg.league_id, leg.round, leg.match_order, ...pairBinds).run();
  }

  // 5) Seed/update next round using tie-aware slotting
  const propagated = await upsertNextRoundSeed(env, {
    leagueId: leg.league_id,
    currentRound: leg.round,
    matchOrder: leg.match_order,
    tiePairKey: pairKeyOf(leg.team1_id, leg.team2_id),
    winnerTeamId: agg.winnerTeamId,
    userId
  });

  return jsonResponse({
    success: true,
    data: { updated: true, winnerUpdated: true, propagated }
  }, 200);
}

/* ---------- helpers ---------- */

// stable key for a tie's two teams (order-insensitive)
function pairKeyOf(a, b) {
  if (a == null || b == null) return null;
  const x = Number(a), y = Number(b);
  return (x < y) ? `${x}-${y}` : `${y}-${x}`;
}

// Decide & upsert the correct next-round slot for THIS tie,
// with deletion if both slots are empty after clearing.
async function upsertNextRoundSeed(env, { leagueId, currentRound, matchOrder, tiePairKey, winnerTeamId, userId }) {
  const nextRound = nextRoundOf(currentRound);
  if (!nextRound) return false;

  const nextOrder = Math.ceil(Number(matchOrder) / 2);

  // Find **all distinct pairs** that share this (round, match_order), so we can place THIS tie into team1 or team2
  const rows = await env.core_data.prepare(`
    SELECT team1_id, team2_id
    FROM league_knockouts
    WHERE league_id = ? AND round = ? AND match_order = ?
      AND team1_id IS NOT NULL AND team2_id IS NOT NULL
  `).bind(leagueId, currentRound, matchOrder).all();

  const pairKeys = Array.from(new Set(rows.results.map(r => pairKeyOf(r.team1_id, r.team2_id)).filter(Boolean)))
    .sort(); // deterministic

  // Determine slot: first pair -> team1, second pair -> team2
  let seedToTeam1 = true; // default
  if (tiePairKey && pairKeys.length) {
    const idx = pairKeys.indexOf(tiePairKey);
    seedToTeam1 = (idx <= 0); // idx 0 => team1, idx 1 => team2
  }

  const targetField = seedToTeam1 ? "team1_id" : "team2_id";

  // Update existing next-round legs (set or clear only our side)
  const updateRes = await env.core_data.prepare(`
    UPDATE league_knockouts
    SET ${targetField} = ?, updated_user_id = ?
    WHERE league_id = ? AND round = ? AND match_order = ?
  `).bind(winnerTeamId, userId, leagueId, nextRound, nextOrder).run();

  // What exists now?
  const existing = await env.core_data.prepare(`
    SELECT match_type, team1_id, team2_id, team1_score, team2_score, winner_team_id
    FROM league_knockouts
    WHERE league_id = ? AND round = ? AND match_order = ?
  `).bind(leagueId, nextRound, nextOrder).all();

  const haveHome = existing.results.some(r => r.match_type === "home");
  const haveAway = existing.results.some(r => r.match_type === "away");

  if (winnerTeamId == null) {
    // if both slots empty and nothing played/won -> delete both legs
    const bothEmpty = existing.results.length >= 2 &&
      existing.results.every(r =>
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
    // otherwise we cleared our side only
    return (haveHome || haveAway) ? "cleared" : "none";
  }

  // Winner present → ensure both legs exist; insert missing ones with fixed placeholders
  const t1Val = seedToTeam1 ? winnerTeamId : null;
  const t2Val = seedToTeam1 ? null : winnerTeamId;

  async function insertLeg(matchType) {
    await env.core_data.prepare(`
      INSERT INTO league_knockouts (
        league_id, round, match_order, match_type,
        team1_id, team2_id,
        team1_user_id, team2_user_id,
        team1_score, team2_score,
        winner_team_id,
        is_vs_computer, computer_team,
        updated_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, 0, NULL, ?)
    `).bind(leagueId, nextRound, nextOrder, matchType, t1Val, t2Val, userId).run();
  }

  let inserted = false;
  if (!haveHome) { await insertLeg("home"); inserted = true; }
  if (!haveAway) { await insertLeg("away"); inserted = true; }

  return inserted ? "inserted" : (updateRes.meta.changes > 0 ? "updated" : "noop");
}

// same as above
function nextRoundOf(round) {
  switch (round) {
    case "1/16": return "1/8";
    case "1/8": return "1/4";
    case "1/4": return "1/2";
    case "1/2": return "final";
    default: return null;
  }
}