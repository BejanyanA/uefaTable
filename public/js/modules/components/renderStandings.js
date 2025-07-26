import { apiPost } from '../../services/api.js';

export async function renderGroupStandingsPage(leagueId, groupId, groupName) {
  const wrapper = document.getElementById("leagueType1");
  wrapper.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = `${groupName} - Standings`;

  const tabs = document.createElement("div");
  tabs.className = "tabs";

  const standingsBtn = document.createElement("button");
  standingsBtn.textContent = "Standings";
  standingsBtn.className = "tab-btn active";

  const matchesBtn = document.createElement("button");
  matchesBtn.textContent = "Matches";
  matchesBtn.className = "tab-btn";

  const standingsTab = document.createElement("div");
  standingsTab.className = "tab-content standings-tab";
  standingsTab.textContent = "Loading standings...";

  const matchesTab = document.createElement("div");
  matchesTab.className = "tab-content matches-tab hidden";
  matchesTab.textContent = "Matches coming soon...";

  tabs.appendChild(standingsBtn);
  tabs.appendChild(matchesBtn);
  wrapper.appendChild(title);
  wrapper.appendChild(tabs);
  wrapper.appendChild(standingsTab);
  wrapper.appendChild(matchesTab);

  // Tab switching
  standingsBtn.addEventListener("click", () => {
    standingsBtn.classList.add("active");
    matchesBtn.classList.remove("active");
    standingsTab.classList.remove("hidden");
    matchesTab.classList.add("hidden");
  });

  matchesBtn.addEventListener("click", () => {
    matchesBtn.classList.add("active");
    standingsBtn.classList.remove("active");
    standingsTab.classList.add("hidden");
    matchesTab.classList.remove("hidden");
  });

  // Fetch standings
  try {
    const res = await apiPost("/standings", { leagueId, groupId });
    if (res.success) {
      standingsTab.innerHTML = renderStandingsTable(res.data.standings);
    } else {
      standingsTab.textContent = "Failed to load standings.";
    }
  } catch (err) {
    standingsTab.textContent = "Error fetching standings.";
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