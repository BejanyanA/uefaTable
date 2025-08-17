// routes/update_group_matches.js

import { jsonResponse, parseBody } from '../../utils/helper.js';
import { verifyToken } from '../../utils/jwt.js';

export async function handleUpdateMatches(request, env) {
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

    if (!row) {
      return "1/8"; // safe fallback
    }

    const koTeams = Math.floor(Number(row.team_count) / 2); // e.g., 32->16, 64->32

    const labelMap = {
      32: "1/16",
      16: "1/8",
      8: "1/4",
      4: "1/2",
      2: "final",
    };

    return labelMap[koTeams] || "1/8";
  }

  const match = await env.core_data.prepare(`
    SELECT lm.*, li.league_id
    FROM league_matches lm
    JOIN league_groups lg ON lg.id = lm.group_id
    JOIN league_instances li ON li.id = lg.league_instance_id
    WHERE lm.id = ?
  `).bind(matchId).first();

  if (!match) {
    return jsonResponse({ success: false, error: "match_not_found" }, 404);
  }

  // access check (unchanged)
  const owned = await env.core_data.prepare(`
    SELECT 1 FROM leagues WHERE id = ? AND created_by_user_id = ?
  `).bind(match.league_id, userId).first();

  if (!owned) {
    const access = await env.core_data.prepare(`
      SELECT 1 FROM league_access WHERE league_id = ? AND user_id = ?
    `).bind(match.league_id, userId).first();
    if (!access) {
      return jsonResponse({ success: false, error: "access_denied" }, 403);
    }
  }

  const currentScores = await env.core_data.prepare(`
    SELECT team1_score, team2_score, winner_team_id, score_processed
    FROM league_matches
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
    UPDATE league_matches
    SET team1_score = ?, team2_score = ?, winner_team_id = ?, updated_user_id = ?
    WHERE id = ?
  `).bind(updated_team1_score, updated_team2_score, new_winner_team_id, userId, matchId).run();

  const scoresNowFilled = updated_team1_score !== null && updated_team2_score !== null;

  const updateTeamStats = async (team_id, played, win, win_vs_computer, win_vs_player, draw, loss, gf, ga, points) => {
    await env.core_data.prepare(`
      UPDATE group_standings
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

  const updateKnockoutStage = async () => {
    const allTeams = await env.core_data.prepare(`
      SELECT team_id, points, played, goal_difference, goals_for
      FROM group_standings
      WHERE group_id = ?
    `).bind(match.group_id).all();

    const groupIsComplete =
      allTeams.results.length >= 4 && allTeams.results.every(t => t.played === 6);
    if (!groupIsComplete) return;

    const sorted = allTeams.results.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
      return a.team_id - b.team_id;
    });

    const top2 = sorted.slice(0, 2);
    const matchOrder = Math.min(match.group_id, getPairedGroupId(match.group_id));

    // NEW: get dynamic round label
    const initialRound = await getInitialKnockoutRound(env, match.league_id);

    // wipe any previous slots for this pair in the initial round
    await env.core_data.prepare(`
      DELETE FROM league_knockouts
      WHERE round = ? AND league_id = ? AND match_order = ?
    `).bind(initialRound, match.league_id, matchOrder).run();

    // create home leg placeholders (A1 vs B2)
    await env.core_data.prepare(`
      INSERT INTO league_knockouts (
        league_id, round, match_order, team1_id, team2_id, match_type, tie_slot
      ) VALUES (?, ?, ?, ?, NULL, 'home', 1)
    `).bind(match.league_id, initialRound, matchOrder, top2[0].team_id).run();

    await env.core_data.prepare(`
      INSERT INTO league_knockouts (
        league_id, round, match_order, team1_id, team2_id, match_type, tie_slot
      ) VALUES (?, ?, ?, NULL, ?, 'home', 1)
    `).bind(match.league_id, initialRound, matchOrder, top2[1].team_id).run();

    // second leg placeholders (B1 vs A2 flipped)
    await env.core_data.prepare(`
      INSERT INTO league_knockouts (
        league_id, round, match_order, team1_id, team2_id, match_type, tie_slot
      ) VALUES (?, ?, ?, NULL, ?, 'away', 2)
    `).bind(match.league_id, initialRound, matchOrder, top2[0].team_id).run();

    await env.core_data.prepare(`
      INSERT INTO league_knockouts (
        league_id, round, match_order, team1_id, team2_id, match_type, tie_slot
      ) VALUES (?, ?, ?, ?, NULL, 'away', 2)
    `).bind(match.league_id, initialRound, matchOrder, top2[1].team_id).run();

    // if the paired group is also complete, fill the placeholders
    const pairedGroupId = getPairedGroupId(match.group_id);
    const pairedComplete = await env.core_data.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN played = 6 THEN 1 ELSE 0 END) as played_count
      FROM group_standings
      WHERE group_id = ?
    `).bind(pairedGroupId).first();

    const isPairedReady =
      pairedComplete && pairedComplete.total >= 4 && pairedComplete.played_count === pairedComplete.total;

    if (isPairedReady) {
      const pairedTeams = await env.core_data.prepare(`
        SELECT team_id, points, goal_difference, goals_for
        FROM group_standings
        WHERE group_id = ?
        ORDER BY points DESC, goal_difference DESC, goals_for DESC, team_id ASC
        LIMIT 2
      `).bind(pairedGroupId).all();

      const [p1, p2] = pairedTeams.results;

      // HOME leg: Group A team1 vs Group B team2
      await env.core_data.prepare(`
        UPDATE league_knockouts
        SET team2_id = ?
        WHERE league_id = ? AND round = ? AND match_order = ?
          AND match_type = 'home' AND tie_slot = 1 AND team2_id IS NULL
      `).bind(p2.team_id, match.league_id, initialRound, matchOrder).run();

      await env.core_data.prepare(`
        UPDATE league_knockouts
        SET team1_id = ?
        WHERE league_id = ? AND round = ? AND match_order = ?
          AND match_type = 'home' AND tie_slot = 1 AND team1_id IS NULL
      `).bind(p1.team_id, match.league_id, initialRound, matchOrder).run();

      // AWAY leg: Group B team1 vs Group A team2 (flipped)
      await env.core_data.prepare(`
        UPDATE league_knockouts
        SET team1_id = ?
        WHERE league_id = ? AND round = ? AND match_order = ?
          AND match_type = 'away' AND tie_slot = 2 AND team1_id IS NULL
      `).bind(p2.team_id, match.league_id, initialRound, matchOrder).run();

      await env.core_data.prepare(`
        UPDATE league_knockouts
        SET team2_id = ?
        WHERE league_id = ? AND round = ? AND match_order = ?
          AND match_type = 'away' AND tie_slot = 2 AND team2_id IS NULL
      `).bind(p1.team_id, match.league_id, initialRound, matchOrder).run();
    }
  };

  // process scores & standings (unchanged)
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
      UPDATE league_matches SET score_processed = 1 WHERE id = ?
    `).bind(matchId).run();
  }

  await updateKnockoutStage();
  return jsonResponse({ success: true, message: "Match score updated" }, 200);

}