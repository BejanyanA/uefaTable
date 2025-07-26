import { apiPost } from '../../services/api.js';
import { renderLeagueInstances } from './renderTable.js';

export async function renderGroupStandingsPage(leagueId, groupId, groupName) {
  const wrapper = document.getElementById("leagueType1");
  wrapper.innerHTML = `
    <div class="group-standings-header">
      <button id="backBtn">⬅ Back</button>
      <h2>${groupName}</h2>
    </div>
    <div class="group-tabs">
      <button class="tab-btn active" data-tab="standings">Standings</button>
      <button class="tab-btn" data-tab="matches">Matches</button>
    </div>
    <div class="tab-content" id="tabContent">Loading...</div>
  `;

  // Back button logic
  document.getElementById("backBtn").addEventListener("click", async () => {
    try {
      const leagueId = parseInt(localStorage.getItem("leagueId"));
      const response = await apiPost("/league-instances", { leagueId });
      if (response.success) {
        renderLeagueInstances(response.data);
      } else {
        wrapper.innerHTML = `<p>Error loading instances</p>`;
      }
    } catch (err) {
      console.error("Failed to fetch league instances", err);
    }
  });

  // Initial tab
  loadTabContent("standings");

  // Tab click logic
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadTabContent(btn.dataset.tab);
    });
  });

  // Tab content loader
  async function loadTabContent(tab) {
    const contentDiv = document.getElementById("tabContent");
    contentDiv.innerHTML = "Loading...";

    try {
      if (tab === "standings") {
        const response = await apiPost("/standings", { leagueId, groupId });
        if (response.success) {
          contentDiv.innerHTML = renderStandingsTable(response.data.standings);
        } else {
          contentDiv.innerHTML = "Failed to load standings.";
        }
      } else if (tab === "matches") {
        const response = await apiPost("/matches", { leagueId, groupId });
        if (response.success) {
          contentDiv.innerHTML = ""; // Clear before rendering
          await renderMatchesTable(response.data, contentDiv, leagueId);
        } else {
          contentDiv.innerHTML = "Failed to load matches.";
        }
      }
    } catch (err) {
      contentDiv.innerHTML = "Error fetching data.";
    }
  }

  // Render Standings
  function renderStandingsTable(standings) {
    return `
    <div class="standings-wrapper">
      <table class="standings-table">
        <thead>
          <tr>
            <th>Club</th>
            <th>MP</th>
            <th>W</th>
            <th>D</th>
            <th>L</th>
            <th>GF</th>
            <th>GA</th>
            <th>GD</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map(team => `
            <tr>
              <td>${team.club_name}</td>
              <td>${team.played}</td>
              <td>${team.wins}</td>
              <td>${team.draws}</td>
              <td>${team.losses}</td>
              <td>${team.goals_for}</td>
              <td>${team.goals_against}</td>
              <td>${team.goal_difference}</td>
              <td>${team.points}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
  }

  // Render Matches Table
  async function renderMatchesTable(matchesData, leagueId, groupId) {
    const section = document.getElementById("tabContent");
    section.innerHTML = "";

    const { matches, accessType } = matchesData;
    const editable = accessType === "owner";

    // Create table
    const table = document.createElement("table");
    table.className = "matches-table";

    table.innerHTML = `
    <thead>
      <tr>
        <th>Player</th>
        <th>Team</th>
        <th></th>
        <th></th>
        <th>Team</th>
        <th>Player</th>
      </tr>
    </thead>
    <tbody>
      ${matches.map(match => `
        <tr data-match-id="${match.id}">
          <td>
            <select class="user-dropdown" name="team1_user" ${editable ? "" : "disabled"}>
              <option value="">Select</option>
            </select>
          </td>
          <td>${match.team1_name}</td>
          <td><input type="number" class="score-input" name="team1" value="${match.team1_score}" ${editable ? "" : "disabled"}></td>
          <td><input type="number" class="score-input" name="team2" value="${match.team2_score}" ${editable ? "" : "disabled"}></td>
          <td>${match.team2_name}</td>
          <td>
            <select class="user-dropdown" name="team2_user" ${editable ? "" : "disabled"}>
              <option value="">Select</option>
            </select>
          </td>
        </tr>
      `).join("")}
    </tbody>
  `;

    section.appendChild(table);
    section.style.display = "block";

    // Fetch league players and populate dropdowns
    try {
      const response = await apiPost("/league-players", { leagueId }, { showLoading: false });
      if (response.success) {
        const players = response.data.players || [];

        const optionsHtml = ['<option value="">Select user</option>']
          .concat(players.map(p => `<option value="${p.user_id}">${p.username}</option>`))
          .join("");

        matches.forEach(match => {
          const row = section.querySelector(`tr[data-match-id="${match.id}"]`);
          if (!row) return;

          const team1Select = row.querySelector(`select[name="team1_user"]`);
          const team2Select = row.querySelector(`select[name="team2_user"]`);

          team1Select.innerHTML = optionsHtml;
          team2Select.innerHTML = optionsHtml;
        });
      }
    } catch (err) {
      console.error("Error loading league players", err);
    }

    // ✅ Auto-save on blur
    if (editable) {
      section.querySelectorAll(".score-input").forEach(input => {
        input.addEventListener("blur", async () => {
          const row = input.closest("tr");
          const matchId = parseInt(row.dataset.matchId);
          const scoreValue = input.value;

          // Skip empty or invalid values
          if (scoreValue === "" || isNaN(scoreValue)) return;

          const payload = { matchId };

          if (input.name === "team1") {
            payload.team1_score = parseInt(scoreValue);
          } else if (input.name === "team2") {
            payload.team2_score = parseInt(scoreValue);
          }

          try {
            const updateResponse = await apiPost("/update-score", payload, { showLoading: false });

            if (!updateResponse.success) {
              console.warn(`⚠️ Failed to update score for match ${matchId}`);
            }
          } catch (err) {
            console.error("⚠️ Error while updating score:", err);
          }
        });
      });
    }
  }
}