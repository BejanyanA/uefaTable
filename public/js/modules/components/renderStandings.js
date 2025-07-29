import { showToast } from '../../utils/toast.js';
import { apiPost } from '../../services/api.js';
import { renderLeagueInstances } from './renderTable.js';
import { langMap, currentLang } from '../LanguageManager.js';

export async function renderGroupStandingsPage(leagueId, groupId, groupName) {
  const wrapper = document.getElementById("leagueType1");
  const translation = langMap[currentLang];
  wrapper.innerHTML = `
  <button id="backBtn">⬅ Back</button>
    <div class="group-standings-header">
      <h2>${groupName}</h2>
    </div>
    <div class="group-tabs">
      <button class="tab-btn active" data-tab="standings">Standings</button>
      <button class="tab-btn" data-tab="matches">Matches</button>
    </div>
    <div class="tab-content" id="tabContent">Loading...</div>
  `;
  const backBtn = document.getElementById("backBtn");
  backBtn.textContent = translation.backButton;
  backBtn.addEventListener("click", async () => {
    try {
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

  loadTabContent("standings");

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
        const [matchesResponse, playersResponse] = await Promise.all([
          apiPost("/matches", { leagueId, groupId }),
          apiPost("/league-players", { leagueId }, { showLoading: false })
        ]);

        if (matchesResponse.success && playersResponse.success) {
          contentDiv.innerHTML = "";
          await renderMatchesTable(matchesResponse.data, contentDiv, leagueId, playersResponse.data.players);
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
  <div class="standings-wrapper">
<table class="standings-table desktop-only">
        <thead>
          <tr>
            <th>Teams</th>
            <th>P</th>
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
          ${standings.map((team, index) => `
            <tr>
              <td>${index + 1}. ${team.club_name}</td>
              <td>${team.played ?? 0}</td>
              <td>${team.wins ?? 0}</td>
              <td>${team.draws ?? 0}</td>
              <td>${team.losses ?? 0}</td>
              <td>${team.goals_for ?? 0}</td>
              <td>${team.goals_against ?? 0}</td>
              <td>${team.goal_difference ?? 0}</td>
              <td>${team.points ?? 0}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <!-- 📱 Mobile version -->
    <div class="mobile-standings-container">
  <div class="scroll-layout">
    <div class="fixed-clubs">
      <div class="club-header">Teams</div>
      ${standings.map((team, index) => `
        <div class="club-name">${index + 1}. ${team.club_name}</div>
      `).join("")}
    </div>

    <div class="stats-scroll-wrapper">
      <!-- Header row -->
      <div class="stats-scroll-row header-row">
        <div class="stat-head">P</div>
        <div class="stat-head">GD</div>
        <div class="stat-head">Pts</div>
        <div class="stat-head">W</div>
        <div class="stat-head">D</div>
        <div class="stat-head">L</div>
        <div class="stat-head">GF</div>
        <div class="stat-head">GA</div>
      </div>

      <!-- Club rows -->
      ${standings.map(team => `
        <div class="stats-scroll-row">
          <div class="stat-cell">${team.played ?? 0}</div>
          <div class="stat-cell">${team.goal_difference ?? 0}</div>
          <div class="stat-cell">${team.points ?? 0}</div>
          <div class="stat-cell">${team.wins ?? 0}</div>
          <div class="stat-cell">${team.draws ?? 0}</div>
          <div class="stat-cell">${team.losses ?? 0}</div>
          <div class="stat-cell">${team.goals_for ?? 0}</div>
          <div class="stat-cell">${team.goals_against ?? 0}</div>
        </div>
      `).join("")}
    </div>
  </div>
</div>
  `;
  }

  async function renderMatchesTable(matchesData, section, leagueId, players = []) {
    section.innerHTML = "";

    const { matches, accessType } = matchesData;
    const editable = accessType === "owner";
    const isMobile = window.innerWidth <= 475;

    if (!isMobile) {
      // === DESKTOP TABLE VIEW ===
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
              <select class="user-dropdown" name="team1_user" data-team-id="${match.team1_id}" data-initial-username="${match.team1_username || ''}" ${editable ? "" : "disabled"}>
                <option value="">${match.team1_username || "Select user"}</option>
              </select>
            </td>
            <td>${match.team1_name}</td>
            <td><input type="number" class="score-input" name="team1" value="${match.team1_score}" ${editable ? "" : "disabled"}></td>
            <td><input type="number" class="score-input" name="team2" value="${match.team2_score}" ${editable ? "" : "disabled"}></td>
            <td>${match.team2_name}</td>
            <td>
              <select class="user-dropdown" name="team2_user" data-team-id="${match.team2_id}" data-initial-username="${match.team2_username || ''}" ${editable ? "" : "disabled"}>
                <option value="">${match.team2_username || "Select user"}</option>
              </select>
            </td>
          </tr>
        `).join("")}
      </tbody>
    `;

      section.appendChild(table);
    } else {
      // === MOBILE STACKED VIEW ===
      const container = document.createElement("div");
      container.className = "matches-row-stack";

      matches.forEach(match => {
        const matchWrapper = document.createElement("div");
        matchWrapper.className = "match-block";
        matchWrapper.dataset.matchId = match.id;

        matchWrapper.innerHTML = `
        <div class="match-line">
          <select class="user-dropdown" name="team1_user" data-team-id="${match.team1_id}" data-initial-username="${match.team1_username || ''}" ${editable ? "" : "disabled"}>
            <option value="">${match.team1_username || "Select Player"}</option>
          </select>
          <div class="team-name">${match.team1_name}</div>
          <input type="number" class="score-input" name="team1" value="${match.team1_score}" ${editable ? "" : "disabled"}>
        </div>
        <div class="match-line">
          <select class="user-dropdown" name="team2_user" data-team-id="${match.team2_id}" data-initial-username="${match.team2_username || ''}" ${editable ? "" : "disabled"}>
            <option value="">${match.team2_username || "Select Player"}</option>
          </select>
          <div class="team-name">${match.team2_name}</div>
          <input type="number" class="score-input" name="team2" value="${match.team2_score}" ${editable ? "" : "disabled"}>
        </div>
      `;

        container.appendChild(matchWrapper);
      });

      section.appendChild(container);
    }

    section.style.display = "block";

    // === Shared logic for dropdowns & scores ===
    if (editable) {
      section.querySelectorAll(".score-input").forEach(input => {
        // Prevent typing negative numbers
        input.addEventListener("input", () => {
          if (parseInt(input.value) < 0) {
            input.value = "";
          }
        });

        // Save on blur if valid
        input.addEventListener("blur", async () => {
          const row = input.closest("[data-match-id]");
          const matchId = parseInt(row.dataset.matchId);
          const scoreValue = input.value;

          if (scoreValue === "" || isNaN(scoreValue) || parseInt(scoreValue) < 0) {
            input.value = ""; // Clear invalid values
            return;
          }

          const payload = { matchId };
          if (input.name === "team1") payload.team1_score = parseInt(scoreValue);
          if (input.name === "team2") payload.team2_score = parseInt(scoreValue);

          try {
            const updateResponse = await apiPost("/update-score", payload, { showLoading: false });
            if (updateResponse.success) {
              showToast(translation.score_updated || "Score Updated", "success");
            } else {
              showToast(translation.score_update_failed || `Failed to update score for match ${matchId}`, "error");
            }
          } catch (err) {
            console.error("⚠️ Error while updating score:", err);
          }
        });
      });

      section.querySelectorAll(".user-dropdown").forEach(dropdown => {
        const defaultOption = `<option value="">Select Player</option>`;
        const options = players.map(p => `<option value="${p.id}">${p.username}</option>`).join("");
        dropdown.innerHTML = defaultOption + options;

        const currentUsername = dropdown.dataset.initialUsername?.trim();
        if (currentUsername) {
          const found = [...dropdown.options].find(opt => opt.text.trim() === currentUsername);
          if (found) dropdown.value = found.value;
        }

        dropdown.addEventListener("change", async () => {
          const row = dropdown.closest("[data-match-id]");
          const matchId = parseInt(row.dataset.matchId);
          const teamId = parseInt(dropdown.dataset.teamId);
          const userId = parseInt(dropdown.value);

          if (!matchId || !teamId || !userId || !leagueId) {
            console.warn("⚠️ Missing values, cannot attach player");
            return;
          }

          try {
            const res = await apiPost("/attach-players", {
              matchId,
              teamId,
              userId,
              leagueId
            }, { showLoading: false });

            if (res.success) {
              showToast(translation.player_success_assigned || "User assigned successfully", "success");
            } else {
              showToast(translation.player_assign_failed || "Failed to attach user", "error");
            }
          } catch (err) {
            console.error("⚠️ Error while attaching user:", err);
          }
        });
      });
    }
  }
}