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

  // --- Input ---
  const { matchId, team1_score, team2_score } = await parseBody(request);
  if (!matchId || typeof matchId !== 'number') {
    return jsonResponse({ success: false, error: "knockout_id_required" }, 400);
  }
  const s1ok = team1_score === null || typeof team1_score === 'number' || team1_score === undefined;
  const s2ok = team2_score === null || typeof team2_score === 'number' || team2_score === undefined;
  if (!s1ok || !s2ok) {
    return jsonResponse({ success: false, error: "scores_must_be_number_or_null" }, 400);
  }

  // --- Helpers ---
  const nextRoundOf = (round) => {
    switch (round) {
      case "1/16": return "1/8";
      case "1/8": return "1/4";
      case "1/4": return "1/2";
      case "1/2": return "final";
      default: return null; // final has no next round
    }
  };

  const computeAggregate = (legs) => {
    // legs: the TWO rows (home & away) for the *same two teams*
    if (legs.length !== 2) return { complete: false, draw: false, winnerTeamId: null };

    const allScored = legs.every(l => l.team1_score !== null && l.team2_score !== null);
    if (!allScored) return { complete: false, draw: false, winnerTeamId: null };

    const tA = legs[0].team1_id;
    const tB = legs[0].team2_id;
    if (tA == null || tB == null) return { complete: false, draw: false, winnerTeamId: null };

    let goalsA = 0, goalsB = 0;
    for (const leg of legs) {
      if (leg.team1_id === tA) goalsA += Number(leg.team1_score);
      if (leg.team2_id === tA) goalsA += Number(leg.team2_score);
      if (leg.team1_id === tB) goalsB += Number(leg.team1_score);
      if (leg.team2_id === tB) goalsB += Number(leg.team2_score);
    }

    if (goalsA === goalsB) return { complete: true, draw: true, winnerTeamId: null };
    return { complete: true, draw: false, winnerTeamId: goalsA > goalsB ? tA : tB };
  };

  // where-clause helpers (SELECT uses alias, UPDATE does not)
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

  // --- 1) Load the leg being edited + access check in one go ---
  const leg = await env.core_data.prepare(`
    SELECT
      lk.id, lk.league_id, lk.round, lk.match_order, lk.match_type,
      lk.team1_id, lk.team2_id, lk.team1_score, lk.team2_score,
      l.created_by_user_id
    FROM league_knockouts lk
    JOIN leagues l ON l.id = lk.league_id
    WHERE lk.id = ?
  `).bind(matchId).first();

  if (!leg) {
    return jsonResponse({ success: false, error: "knockout_not_found" }, 404);
  }

  // access: owner or granted
  if (leg.created_by_user_id !== userId) {
    const access = await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(leg.league_id, userId).first();
    if (!access) return jsonResponse({ success: false, error: "access_denied" }, 403);
  }

  // --- 2) Update ONLY this leg's scores; also clear its per-row winner (winner is tie-level) ---
  const newS1 = (team1_score === undefined) ? leg.team1_score : team1_score;
  const newS2 = (team2_score === undefined) ? leg.team2_score : team2_score;

  await env.core_data.prepare(`
    UPDATE league_knockouts
    SET team1_score = ?, team2_score = ?, winner_team_id = NULL, updated_user_id = ?
    WHERE id = ?
  `).bind(newS1, newS2, userId, matchId).run();

  // --- 3) Load BOTH legs for THIS tie (same league, round, match_order AND same two teams) ---
  const pairBinds = [leg.team1_id, leg.team2_id, leg.team2_id, leg.team1_id];

  const legs = await env.core_data.prepare(`
    SELECT id, match_type, team1_id, team2_id, team1_score, team2_score, winner_team_id
    FROM league_knockouts lk
    WHERE lk.league_id = ? AND lk.round = ? AND lk.match_order = ?
      AND ${pairWhereClauseSelect('lk')}
  `).bind(leg.league_id, leg.round, leg.match_order, ...pairBinds).all();

  if (!legs.results || legs.results.length !== 2) {
    // tie not fully formed yet—don’t try to decide a winner
    return jsonResponse({ success: true, data: { updated: true, winnerUpdated: false, propagated: false } }, 200);
  }

  // Track the previous winner (if both legs had it set the same)
  let previousWinner = null;
  {
    const winners = new Set(legs.results.map(r => r.winner_team_id).filter(v => v != null));
    previousWinner = (winners.size === 1) ? [...winners][0] : null;
  }

  // --- 4) Recompute aggregate and set/clear winners on THESE TWO legs only ---
  const agg = computeAggregate(legs.results);

  if (!agg.complete) {
    // Not enough scores to decide: clear winners on this tie only
    await env.core_data.prepare(`
      UPDATE league_knockouts
      SET winner_team_id = NULL, updated_user_id = ?
      WHERE league_id = ? AND round = ? AND match_order = ?
        AND ${pairWhereClauseNoAlias()}
    `).bind(userId, leg.league_id, leg.round, leg.match_order, ...pairBinds).run();

    // Also unseed the next round slot if we previously had a winner
    if (previousWinner != null) {
      await upsertNextRoundSeed(env, {
        leagueId: leg.league_id,
        currentRound: leg.round,
        matchOrder: leg.match_order,
        winnerTeamId: null,
        userId
      });
    }

    return jsonResponse({
      success: true,
      data: {
        updated: true,
        winnerUpdated: false,
        propagated: previousWinner != null ? "cleared" : false,
        needsTiebreak: false
      }
    }, 200);
  }

  if (agg.draw) {
    // Aggregate draw: clear winners now and unseed next round (manual endpoint will set later)
    await env.core_data.prepare(`
      UPDATE league_knockouts
      SET winner_team_id = NULL, updated_user_id = ?
      WHERE league_id = ? AND round = ? AND match_order = ?
        AND ${pairWhereClauseNoAlias()}
    `).bind(userId, leg.league_id, leg.round, leg.match_order, ...pairBinds).run();

    if (previousWinner != null) {
      await upsertNextRoundSeed(env, {
        leagueId: leg.league_id,
        currentRound: leg.round,
        matchOrder: leg.match_order,
        winnerTeamId: null,
        userId
      });
    }

    return jsonResponse({
      success: true,
      data: { updated: true, winnerUpdated: false, propagated: "cleared", needsTiebreak: true }
    }, 200);
  }

  // Aggregate has a winner → set on both legs for THIS tie
  if (agg.winnerTeamId !== previousWinner) {
    await env.core_data.prepare(`
      UPDATE league_knockouts
      SET winner_team_id = ?, updated_user_id = ?
      WHERE league_id = ? AND round = ? AND match_order = ?
        AND ${pairWhereClauseNoAlias()}
    `).bind(agg.winnerTeamId, userId, leg.league_id, leg.round, leg.match_order, ...pairBinds).run();
  }

  // --- 5) Upsert the next round seed (create rows if missing, or update if exist) ---
  const propagated = await upsertNextRoundSeed(env, {
    leagueId: leg.league_id,
    currentRound: leg.round,
    matchOrder: leg.match_order,
    winnerTeamId: agg.winnerTeamId,
    userId
  });

  return jsonResponse({
    success: true,
    data: {
      updated: true,
      winnerUpdated: true,
      propagated
    }
  }, 200);
}

/**
 * Upsert the winner into the next round slots (both home/away rows).
 * - If winnerTeamId is null → only clear the slot in existing rows; do NOT create new rows.
 * - If winnerTeamId is set → update existing rows and INSERT any missing legs (home/away).
 * Uses fixed placeholders (safe for D1).
 */
async function upsertNextRoundSeed(env, { leagueId, currentRound, matchOrder, winnerTeamId, userId }) {
  const nextRound = nextRoundOf(currentRound);
  if (!nextRound) return false; // final → no next

  const nextOrder = Math.ceil(Number(matchOrder) / 2);
  const seedToTeam1 = (Number(matchOrder) % 2 === 1); // odd -> team1, even -> team2
  const targetField = seedToTeam1 ? 'team1_id' : 'team2_id';

  // 1) UPDATE existing next-round rows (both legs) to set/clear the slot
  const updateRes = await env.core_data.prepare(`
    UPDATE league_knockouts
    SET ${targetField} = ?, updated_user_id = ?
    WHERE league_id = ? AND round = ? AND match_order = ?
  `).bind(winnerTeamId, userId, leagueId, nextRound, nextOrder).run();

  // 2) Which legs exist now?
  const existing = await env.core_data.prepare(`
    SELECT match_type FROM league_knockouts
    WHERE league_id = ? AND round = ? AND match_order = ?
  `).bind(leagueId, nextRound, nextOrder).all();

  const haveHome = existing.results.some(r => r.match_type === 'home');
  const haveAway = existing.results.some(r => r.match_type === 'away');

  if (winnerTeamId == null) {
    // No winner → don't create rows; we just cleared or ensured it's clear.
    return (haveHome || haveAway) ? "cleared" : "none";
  }

  // 3) Winner present → ensure both legs exist; insert any missing
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
  if (!haveHome) { await insertLeg('home'); inserted = true; }
  if (!haveAway) { await insertLeg('away'); inserted = true; }

  return inserted ? "inserted" : "updated";
}

// Keep helper local
function nextRoundOf(round) {
  switch (round) {
    case "1/16": return "1/8";
    case "1/8": return "1/4";
    case "1/4": return "1/2";
    case "1/2": return "final";
    default: return null;
  }
}