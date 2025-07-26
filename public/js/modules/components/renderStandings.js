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
        section.innerHTML = `<p>Error loading instances</p>`;
      }
    } catch (err) {
      console.error("Failed to fetch league instances", err);
    }
  });

  // Initial load: Standings
  loadTabContent("standings");

  // Tab click logic
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadTabContent(btn.dataset.tab);
    });
  });

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
        const response = await apiPost("/matches", { leagueId, groupId }); // <-- replace with your real endpoint
        if (response.success) {
          contentDiv.innerHTML = renderMatchesTable(response.data.matches); // implement this
        } else {
          contentDiv.innerHTML = "Failed to load matches.";
        }
      }
    } catch (err) {
      contentDiv.innerHTML = "Error fetching data.";
    }
  }


  function renderStandingsTable(standings) {
    return `
      <table class="standings-table">
        <thead>
          <tr>
            <th>Club</th><th>MP</th><th>W</th><th>D</th><th>L</th>
            <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
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
    `;
  }

  function renderMatchesTable(matches) {
    if (!matches || matches.length === 0) return `<p>No matches available.</p>`;
    return `
      <ul class="match-list">
        ${matches.map(match => `<li>${match.team1} vs ${match.team2} - ${match.status}</li>`).join("")}
      </ul>
    `;
  }
}