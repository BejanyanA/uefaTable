// routes/update_group_matches.js

import { jsonResponse, parseBody } from '../../utils/helper.js';
import { verifyToken } from '../../utils/jwt.js';

export async function handleUpdateNationalMatches(request, env) {
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
  const { matchId, team1_score, team2_score } = await parseBody(request);
  if (!matchId || (team1_score === undefined && team2_score === undefined)) {
    return jsonResponse({ success: false, error: "At least one score must be provided" }, 400);
  }

  // --- helper: map team_count -> initial knockout round label
  async function getInitialKnockoutRound(env, leagueId) {
    const row = await env.core_data
      .prepare(`SELECT team_count FROM leagues WHERE id = ?`)
      .bind(leagueId)
      .first();
    if (!row) return "1/8";
    const koTeams = Math.floor(Number(row.team_count) / 2);
    const labelMap = { 32: "1/16", 16: "1/8", 8: "1/4", 4: "1/2", 2: "final" };
    return labelMap[koTeams] || "1/8";
  }

  // NOTE: national group stage uses country_* tables
  const match = await env.core_data.prepare(`
    SELECT cm.*,
           lg.league_instance_id,   -- NEW
           li.league_id
    FROM country_matches cm
    JOIN league_groups lg ON lg.id = cm.group_id
    JOIN league_instances li ON li.id = lg.league_instance_id
    WHERE cm.id = ?
  `).bind(matchId).first();

  if (!match) return jsonResponse({ success: false, error: "match_not_found" }, 404);

  // access check (unchanged)
  const owned = await env.core_data.prepare(`
    SELECT 1 FROM leagues WHERE id = ? AND created_by_user_id = ?
  `).bind(match.league_id, userId).first();

  if (!owned) {
    const access = await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(match.league_id, userId).first();
    if (!access) return jsonResponse({ success: false, error: "access_denied" }, 403);
  }

  const currentScores = await env.core_data.prepare(`
    SELECT team1_score, team2_score, winner_team_id, score_processed
    FROM country_matches
    WHERE id = ?
  `).bind(matchId).first();

  const updated_team1_score = team1_score !== undefined ? team1_score : currentScores.team1_score;
  const updated_team2_score = team2_score !== undefined ? team2_score : currentScores.team2_score;

  const new_winner_team_id =
    updated_team1_score > updated_team2_score
      ? match.team1_id
      : updated_team1_score < updated_team2_score
        ? match.team2_id
        : null;

  await env.core_data.prepare(`
    UPDATE country_matches
    SET team1_score = ?, team2_score = ?, winner_team_id = ?, updated_user_id = ?
    WHERE id = ?
  `).bind(updated_team1_score, updated_team2_score, new_winner_team_id, userId, matchId).run();

  const scoresNowFilled = updated_team1_score !== null && updated_team2_score !== null;

  // standings helpers (same logic, national table)
  const updateTeamStats = async (team_id, played, win, win_vs_computer, win_vs_player, draw, loss, gf, ga, points) => {
    await env.core_data.prepare(`
      UPDATE country_group_standings
      SET played = played + ?,
          wins = wins + ?,
          wins_vs_computer = wins_vs_computer + ?,
          wins_vs_player = wins_vs_player + ?,
          draws = draws + ?,
          losses = losses + ?,
          goals_for = goals_for + ?,
          goals_against = goals_against + ?,
          goal_difference = goal_difference + ?,
          points = points + ?
      WHERE group_id = ? AND team_id = ?
    `).bind(
      played, win, win_vs_computer, win_vs_player, draw, loss, gf, ga, gf - ga, points, match.group_id, team_id
    ).run();
  };

  const rollbackStats = async (team_id, gf, ga, outcome, vs_computer) => {
    const win = outcome === 'win' ? -1 : 0;
    const draw = outcome === 'draw' ? -1 : 0;
    const loss = outcome === 'loss' ? -1 : 0;
    const win_vs_computer = (outcome === 'win' && vs_computer) ? -1 : 0;
    const win_vs_player = (outcome === 'win' && !vs_computer) ? -1 : 0;
    await updateTeamStats(team_id, -1, win, win_vs_computer, win_vs_player, draw, loss, -gf, -ga, win ? -3 : draw ? -1 : 0);
  };

  const getPairedGroupId = (groupId) => (groupId % 2 === 0 ? groupId - 1 : groupId + 1);

  // 🔹 NEW: get index of a group inside its league_instance (A..H == 0..7)
  async function getGroupIndex(env, leagueInstanceId, groupId) {
    const rows = await env.core_data.prepare(`
      SELECT id
      FROM league_groups
      WHERE league_instance_id = ?
      ORDER BY id ASC           -- swap to ORDER BY sort_order ASC if you have it
    `).bind(leagueInstanceId).all();

    const ids = rows.results.map(r => r.id);
    return ids.findIndex(id => id === groupId); // 0-based
  }

  // ====== KO seeding (1-leg neutral, national tables) ======
  const updateKnockoutStage = async () => {
    const allTeams = await env.core_data.prepare(`
      SELECT team_id, points, played, goal_difference, goals_for
      FROM country_group_standings
      WHERE group_id = ?
    `).bind(match.group_id).all();

    // Single‑leg groups: 3 matches per team in a 4‑team group
    const groupIsComplete =
      allTeams.results.length >= 4 && allTeams.results.every(t => t.played === 3);
    if (!groupIsComplete) return;

    const sorted = allTeams.results.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
      return a.team_id - b.team_id;
    });

    const top2 = sorted.slice(0, 2); // this group's top 2
    const pairedGroupId = getPairedGroupId(match.group_id);
    const base = Math.min(match.group_id, pairedGroupId);

    const initialRound = await getInitialKnockoutRound(env, match.league_id);

    // Helper to ensure a placeholder row exists for (round, order)
    async function ensureRow(order) {
      const exists = await env.core_data.prepare(`
        SELECT id FROM national_knockouts
        WHERE league_id = ? AND round = ? AND match_order = ?
        LIMIT 1
      `).bind(match.league_id, initialRound, order).first();
      if (!exists) {
        await env.core_data.prepare(`
          INSERT INTO national_knockouts
            (league_id, round, match_order, match_type,
             team1_id, team2_id, team1_user_id, team2_user_id,
             team1_score, team2_score, winner_team_id,
             is_vs_computer, computer_team, updated_user_id)
          VALUES (?, ?, ?, 'neutral', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, ?)
        `).bind(match.league_id, initialRound, order, userId).run();
      }
    }

    // 🔧 ——— DETerministic match_order for 1/8 by group blocks (A/B, C/D, E/F, G/H) ———
    let orderA1vB2, orderB1vA2;

    if (initialRound === "1/8") {
      // Indices for this group and its pair inside the league_instance
      const idxThis = await getGroupIndex(env, match.league_instance_id, match.group_id);
      const idxPair = await getGroupIndex(env, match.league_instance_id, pairedGroupId);

      // Pair index block: [0,1]->0, [2,3]->1, [4,5]->2, [6,7]->3
      const pairIdx = Math.floor(Math.min(idxThis, idxPair) / 2);

      // Each pair contributes 2 matches; blocks map to:
      // 0 -> orders 1,2 (A/B), 1 -> 3,4 (C/D), 2 -> 5,6 (E/F), 3 -> 7,8 (G/H)
      const baseOrder = pairIdx * 2 + 1;
      orderA1vB2 = baseOrder;       // odd
      orderB1vA2 = baseOrder + 1;   // even

      // Optional cleanup: remove any stray orders for these groups that don't match the two we just computed
      const groupTeamIdsRes = await env.core_data.prepare(`
        SELECT team_id FROM country_group_standings
        WHERE group_id IN (?, ?)
      `).bind(match.group_id, pairedGroupId).all();
      const groupTeamIds = groupTeamIdsRes.results.map(r => r.team_id);
      if (groupTeamIds.length) {
        const placeholders = groupTeamIds.map(() => "?").join(",");
        await env.core_data.prepare(`
          DELETE FROM national_knockouts
          WHERE league_id = ? AND round = ?
            AND (team1_id IN (${placeholders}) OR team2_id IN (${placeholders}))
            AND match_order NOT IN (?, ?)
        `).bind(match.league_id, initialRound, ...groupTeamIds, ...groupTeamIds, orderA1vB2, orderB1vA2).run();
      }

      // Ensure both rows exist
      await ensureRow(orderA1vB2);
      await ensureRow(orderB1vA2);

    } else {
      // deterministic orders for 1/4, 1/2 (unchanged)
      orderA1vB2 = base * 2 - 1; // odd
      orderB1vA2 = base * 2;     // even

      await env.core_data.prepare(`
        DELETE FROM national_knockouts
        WHERE league_id = ? AND round = ? AND match_order IN (?, ?)
      `).bind(match.league_id, initialRound, orderA1vB2, orderB1vA2).run();

      await ensureRow(orderA1vB2);
      await ensureRow(orderB1vA2);
    }

    // If the paired group is also complete, get its top2 now
    const pairedCompleteRow = await env.core_data.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN played = 3 THEN 1 ELSE 0 END) AS played_count
      FROM country_group_standings
      WHERE group_id = ?
    `).bind(pairedGroupId).first();

    const isPairedReady =
      pairedCompleteRow && pairedCompleteRow.total >= 4 && Number(pairedCompleteRow.played_count) === Number(pairedCompleteRow.total);

    let p1 = null, p2 = null;
    if (isPairedReady) {
      const pairedTeams = await env.core_data.prepare(`
        SELECT team_id, points, goal_difference, goals_for
        FROM country_group_standings
        WHERE group_id = ?
        ORDER BY points DESC, goal_difference DESC, goals_for DESC, team_id ASC
        LIMIT 2
      `).bind(pairedGroupId).all();

      p1 = pairedTeams.results[0]?.team_id ?? null; // paired group's #1
      p2 = pairedTeams.results[1]?.team_id ?? null; // paired group's #2
    }

    // Desired seeds for this group
    const G1 = top2[0]?.team_id ?? null; // this group's #1
    const G2 = top2[1]?.team_id ?? null; // this group's #2

    // Always overwrite with current seeds (no COALESCE), per fixed orders above
    await env.core_data.prepare(`
      UPDATE national_knockouts
      SET team1_id = ?, team2_id = ?, updated_user_id = ?
      WHERE league_id = ? AND round = ? AND match_order = ?
    `).bind(G1, p2, userId, match.league_id, initialRound, orderA1vB2).run();

    await env.core_data.prepare(`
      UPDATE national_knockouts
      SET team1_id = ?, team2_id = ?, updated_user_id = ?
      WHERE league_id = ? AND round = ? AND match_order = ?
    `).bind(p1, G2, userId, match.league_id, initialRound, orderB1vA2).run();
  };

  // process scores & standings (unchanged, but on national tables)
  if (scoresNowFilled) {
    if (currentScores.score_processed === 1) {
      const oldIsDraw = currentScores.team1_score === currentScores.team2_score;
      const oldWinnerId = currentScores.winner_team_id;
      const oldLoserId = oldWinnerId === match.team1_id ? match.team2_id : match.team1_id;
      const oldWinnerGoals = oldWinnerId === match.team1_id ? currentScores.team1_score : currentScores.team2_score;
      const oldLoserGoals = oldWinnerId === match.team1_id ? currentScores.team2_score : currentScores.team1_score;
      const isVsComputer = match.is_vs_computer;

      if (oldIsDraw) {
        await rollbackStats(match.team1_id, currentScores.team1_score, currentScores.team2_score, 'draw', false);
        await rollbackStats(match.team2_id, currentScores.team2_score, currentScores.team1_score, 'draw', false);
      } else {
        await rollbackStats(oldWinnerId, oldWinnerGoals, oldLoserGoals, 'win', isVsComputer);
        await rollbackStats(oldLoserId, oldLoserGoals, oldWinnerGoals, 'loss', false);
      }
    }

    const isDraw = updated_team1_score === updated_team2_score;
    if (isDraw) {
      await updateTeamStats(match.team1_id, 1, 0, 0, 0, 1, 0, updated_team1_score, updated_team2_score, 1);
      await updateTeamStats(match.team2_id, 1, 0, 0, 0, 1, 0, updated_team2_score, updated_team1_score, 1);
    } else {
      const winnerId = new_winner_team_id;
      const loserId = winnerId === match.team1_id ? match.team2_id : match.team1_id;
      const winnerGoals = winnerId === match.team1_id ? updated_team1_score : updated_team2_score;
      const loserGoals = winnerId === match.team1_id ? updated_team2_score : updated_team1_score;
      const win_vs_computer = match.is_vs_computer ? 1 : 0;
      const win_vs_player = match.is_vs_computer ? 0 : 1;

      await updateTeamStats(winnerId, 1, 1, win_vs_computer, win_vs_player, 0, 0, winnerGoals, loserGoals, 3);
      await updateTeamStats(loserId, 1, 0, 0, 0, 0, 1, loserGoals, winnerGoals, 0);
    }

    await env.core_data.prepare(`
      UPDATE country_matches SET score_processed = 1 WHERE id = ?
    `).bind(matchId).run();
  }

  await updateKnockoutStage();
  return jsonResponse({ success: true, message: "Match score updated" }, 200);
}