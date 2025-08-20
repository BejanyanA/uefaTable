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

    // Fallback if league missing (defensive)
    if (!row) return "1/8";

    const koTeams = Math.floor(Number(row.team_count) / 2); // e.g., 32 -> 16
    const labelMap = { 32: "1/16", 16: "1/8", 8: "1/4", 4: "1/2", 2: "Final" };
    return labelMap[koTeams] || "1/8";
  }

  // --- load the group match + league id
  const match = await env.core_data.prepare(`
    SELECT lm.*, li.league_id
    FROM country_matches lm
    JOIN league_groups lg ON lg.id = lm.group_id
    JOIN league_instances li ON li.id = lg.league_instance_id
    WHERE lm.id = ?
  `).bind(matchId).first();

  if (!match) {
    return jsonResponse({ success: false, error: "match_not_found" }, 404);
  }

  // access check
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

  // --- current scores and flags
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

  // --- standings helpers (unchanged)
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

  // ===================== UPDATED: single‑leg neutral knockout seeding =====================
  const updateKnockoutStage = async () => {
    // Fetch all teams of this group
    const allTeams = await env.core_data.prepare(`
      SELECT team_id, points, played, goal_difference, goals_for
      FROM country_group_standings
      WHERE group_id = ?
    `).bind(match.group_id).all();

    // Group is complete when each of 4 teams played all 3 matches vs 3 opponents twice? For single round‑robin: 3 matches.
    // Your schema used 6 earlier (home/away); for national single‑leg groups use 3.
    const groupIsComplete =
      allTeams.results.length >= 4 && allTeams.results.every(t => t.played === 3);
    if (!groupIsComplete) return;

    // Rank this group's top 2
    const sorted = allTeams.results.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
      return a.team_id - b.team_id;
    });

    const top2 = sorted.slice(0, 2); // [{team_id, ...}, {team_id, ...}]
    const pairedGroupId = getPairedGroupId(match.group_id);

    // Compute stable base order for this pair of groups
    const base = Math.min(match.group_id, pairedGroupId);
    const orderA1vB2 = base * 2 - 1; // odd
    const orderB1vA2 = base * 2;     // even

    // Dynamic initial knockout round (based on league team_count)
    const initialRound = await getInitialKnockoutRound(env, match.league_id);

    // Ensure both rows exist (neutral, single leg). We do not delete; we create if missing.
    async function ensureRow(order) {
      let row = await env.core_data.prepare(`
        SELECT id, team1_id, team2_id FROM national_knockouts
        WHERE league_id = ? AND round = ? AND match_order = ?
        LIMIT 1
      `).bind(match.league_id, initialRound, order).first();

      if (!row) {
        await env.core_data.prepare(`
          INSERT INTO national_knockouts (
            league_id, round, match_order, match_type,
            team1_id, team2_id, team1_user_id, team2_user_id,
            team1_score, team2_score, winner_team_id,
            is_vs_computer, computer_team, updated_user_id
          ) VALUES (?, ?, ?, 'neutral',
                    NULL, NULL, NULL, NULL,
                    NULL, NULL, NULL,
                    0, NULL, ?)
        `).bind(match.league_id, initialRound, order, userId).run();

        row = await env.core_data.prepare(`
          SELECT id, team1_id, team2_id FROM national_knockouts
          WHERE league_id = ? AND round = ? AND match_order = ?
          LIMIT 1
        `).bind(match.league_id, initialRound, order).first();
      }
      return row;
    }

    // Write only our side based on whether this group's id is lower (A) or higher (B)
    const thisIsLower = match.group_id === base;

    // If paired group is also complete, fetch its top2 for immediate fill
    const paired = await env.core_data.prepare(`
      SELECT team_id, points, played, goal_difference, goals_for
      FROM country_group_standings
      WHERE group_id = ?
    `).bind(pairedGroupId).all();

    const pairedComplete =
      paired.results.length >= 4 && paired.results.every(t => t.played === 3);

    let p1 = null, p2 = null;
    if (pairedComplete) {
      const ps = paired.results.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
        if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
        return a.team_id - b.team_id;
      }).slice(0, 2);
      p1 = ps[0]?.team_id ?? null;
      p2 = ps[1]?.team_id ?? null;
    }

    // Ensure rows exist
    const row1 = await ensureRow(orderA1vB2); // A1 vs B2
    const row2 = await ensureRow(orderB1vA2); // B1 vs A2

    const A1 = top2[0]?.team_id ?? null;
    const A2 = top2[1]?.team_id ?? null;

    // Update our side(s) only:
    if (thisIsLower) {
      // We are A. Row1: team1 = A1. Row2: team2 = A2.
      if (A1 != null) {
        await env.core_data.prepare(`
          UPDATE national_knockouts
          SET team1_id = ?, updated_user_id = ?
          WHERE id = ?
        `).bind(A1, userId, row1.id).run();
      }
      if (A2 != null) {
        await env.core_data.prepare(`
          UPDATE national_knockouts
          SET team2_id = ?, updated_user_id = ?
          WHERE id = ?
        `).bind(A2, userId, row2.id).run();
      }
    } else {
      // We are B. Row1: team2 = B2. Row2: team1 = B1.
      if (A2 != null) { // A2 variable holds "our group's #2" (since we used top2)
        await env.core_data.prepare(`
          UPDATE national_knockouts
          SET team2_id = ?, updated_user_id = ?
          WHERE id = ?
        `).bind(A2, userId, row1.id).run();
      }
      if (A1 != null) { // A1 variable holds "our group's #1"
        await env.core_data.prepare(`
          UPDATE national_knockouts
          SET team1_id = ?, updated_user_id = ?
          WHERE id = ?
        `).bind(A1, userId, row2.id).run();
      }
    }

    // If paired group is complete, fill the other sides too
    if (pairedComplete) {
      if (thisIsLower) {
        // Row1 other side = B2 (p2), Row2 other side = B1 (p1)
        if (p2 != null) {
          await env.core_data.prepare(`
            UPDATE national_knockouts
            SET team2_id = ?, updated_user_id = ?
            WHERE id = ?
          `).bind(p2, userId, row1.id).run();
        }
        if (p1 != null) {
          await env.core_data.prepare(`
            UPDATE national_knockouts
            SET team1_id = ?, updated_user_id = ?
            WHERE id = ?
          `).bind(p1, userId, row2.id).run();
        }
      } else {
        // We are B; other side are A seeds from the lower group
        if (top2[0]?.team_id != null) {
          await env.core_data.prepare(`
            UPDATE national_knockouts
            SET team2_id = ?, updated_user_id = ?
            WHERE id = ?
          `).bind(top2[0].team_id, userId, row2.id).run(); // A2 side on row2
        }
        if (top2[1]?.team_id != null) {
          await env.core_data.prepare(`
            UPDATE national_knockouts
            SET team1_id = ?, updated_user_id = ?
            WHERE id = ?
          `).bind(top2[1].team_id, userId, row1.id).run(); // A1 side on row1
        }
      }
    }
  };
  // ===================== /UPDATED single‑leg seeding =====================

  // --- process standings (unchanged logic)
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