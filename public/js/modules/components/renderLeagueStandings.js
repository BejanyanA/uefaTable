import { showToast } from '../../utils/toast.js';
import { apiPost } from '../../services/api.js';
import { renderLeagueInstances } from './renderLeagueTable.js';
import { langMap, currentLang } from '../LanguageManager.js';

export async function renderLeagueGroupStandingsPage(leagueId, groupId, groupName) {
  const wrapper = document.getElementById("leagueType1");
  const translation = langMap[currentLang];
  wrapper.innerHTML = `
  <button class="backButtn" id="backBtn">⬅ Back</button>
    <div class="group-tabs">
      <button class="tab-btn active" data-tab="standings" id="standingsTabBtn"></button>
      <button class="tab-btn" data-tab="matches" id="matchesTabBtn"></button>
    </div>
    <div class="group-standings-header">
      <h2>${groupName}</h2>
    </div>
    <div class="tab-content" id="tabContent">Loading...</div>
  `;

  //Translations
  document.getElementById("standingsTabBtn").innerText = translation.standings || "Standings";
  document.getElementById("matchesTabBtn").innerText = translation.matches || "Matches";

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

    try {
      if (tab === "standings") {
        const response = await apiPost("/standings", { leagueId, groupId });

        if (response.success) {
          contentDiv.innerHTML = renderLeagueStandingsTable(response.data.standings);
        } else {
          contentDiv.innerHTML = "Failed to load standings.";
        }
      } else if (tab === "matches") {
        // ✅ Show loading message immediately
        contentDiv.innerHTML = `<div style="padding: 20px; font-size: 16px;"></div>`;

        const [matchesResponse, playersResponse] = await Promise.all([
          apiPost("/matches", { leagueId, groupId }),
          apiPost("/league-players", { leagueId }, { showLoading: false })
        ]);

        if (matchesResponse.success && playersResponse.success) {
          // ✅ Force a repaint before rendering heavy UI
          await new Promise(resolve => requestAnimationFrame(resolve));

          contentDiv.innerHTML = ""; // Now clear and render
          await renderLeagueMatchesTable(matchesResponse.data, contentDiv, leagueId, playersResponse.data.players);
        } else {
          contentDiv.innerHTML = "Failed to load matches.";
        }
      }
    } catch (err) {
      contentDiv.innerHTML = "Error fetching data.";
    }
  }

  function renderLeagueStandingsTable(standings) {
    const translation = langMap[currentLang];
    return `
  <div class="standings-wrapper">
<table class="standings-table desktop-only">
        <thead>
          <tr>
            <th id="teamDesk">${translation.teams || "Teams"}</th>
            <th id="playedDesk">${translation.played || "P"}</th>
            <th id="winDesk">${translation.win || "W"}</th>
            <th id="drawDesk">${translation.draw || "D"}</th>
            <th id="loseDesk">${translation.lose || "L"}</th>
            <th id="goalForDesk">${translation.goalFor || "GF"}</th>
            <th id="goalAgainstDesk">${translation.goalAgainst || "GA"}</th>
            <th id="goalDifferDesk">${translation.goalDiffer || "GD"}</th>
            <th id="pointsDesk">${translation.points || "Pts"}</th>
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
      <div class="club-header" id="teamMobile">${translation.teams || "Teams"}</div>
      ${standings.map((team, index) => `
        <div class="club-name">${index + 1}. ${team.club_name}</div>
      `).join("")}
    </div>

    <div class="stats-scroll-wrapper">
      <!-- Header row -->
      <div class="stats-scroll-row header-row">
        <div class="stat-head" id="playedMob">${translation.played || "P"}</div>
        <div class="stat-head" id="goalDifferMob">${translation.goalDiffer || "GD"}</div>
        <div class="stat-head" id="pointsMob">${translation.points || "Pts"}</div>
        <div class="stat-head" id="winMob">${translation.win || "W"}</div>
        <div class="stat-head" id="drawMob">${translation.draw || "D"}</div>
        <div class="stat-head" id="loseMob">${translation.lose || "L"}</div>
        <div class="stat-head" id="goalForMob">${translation.goalFor || "GF"}</div>
        <div class="stat-head" id="goalAgainstMob">${translation.goalAgainst || "GA"}</div>
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

  async function renderLeagueMatchesTable(matchesData, section, leagueId, players = []) {
    section.innerHTML = "";

    const { matches, accessType } = matchesData;
    const editable = accessType === "owner";
    const isMobile = window.innerWidth <= 475;

    if (!isMobile) {
      // === DESKTOP TABLE VIEW ===
      const table = document.createElement("table");
      table.className = "matches-table";

      const translation = langMap[currentLang];

      table.innerHTML = `
      <thead>
        <tr>
          <th id="playerDesk">${translation.player || "Player"}</th>
          <th id="teamDesk">${translation.team || "Team"}</th>
          <th></th>
          <th></th>
          <th id="teamDesk2">${translation.team || "Team"}</th>
          <th id="playerDesk2">${translation.player || "Player"}</th>
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
      // --- SCORE INPUTS ---
      section.querySelectorAll(".score-input").forEach(input => {
        // set the initial baseline once (use current value)
        if (input.dataset.initial === undefined) {
          input.dataset.initial = (input.value ?? "").trim();
        }

        // also track value at focus time (covers quick edits & reverts)
        input.addEventListener("focus", () => {
          input.dataset.focusInitial = (input.value ?? "").trim();
        });

        // Prevent typing negative numbers
        input.addEventListener("input", () => {
          if (input.value !== "" && Number(input.value) < 0) input.value = "";
        });

        // Save on blur if valid AND changed
        input.addEventListener("blur", async () => {
          const row = input.closest("[data-match-id]");
          const matchId = parseInt(row?.dataset.matchId);
          const raw = (input.value ?? "").trim();

          // invalid => clear & bail
          if (raw === "" || Number.isNaN(Number(raw)) || Number(raw) < 0) {
            input.value = "";
            return;
          }

          const newVal = String(Number(raw)); // normalize "02" -> "2"
          const base = input.dataset.initial ?? "";         // baseline since last success
          const baseAtFocus = input.dataset.focusInitial ?? base;

          // if not changed vs baseline (or the value you had on focus), skip
          if (newVal === base || newVal === baseAtFocus) return;

          const payload = { matchId };
          if (input.name === "team1") payload.team1_score = Number(newVal);
          if (input.name === "team2") payload.team2_score = Number(newVal);

          if (!matchId || (!payload.team1_score && payload.team1_score !== 0) &&
            (!payload.team2_score && payload.team2_score !== 0)) {
            return;
          }

          try {
            const translation = langMap[currentLang];
            const res = await apiPost("/update-score", payload);
            if (res.success) {
              // update baseline so future blurs don't re-send the same value
              input.dataset.initial = newVal;
              showToast(translation.score_updated || "Score Updated", "success");
            } else {
              showToast(translation.score_update_failed || `Failed to update score for match ${matchId}`, "error");
            }
          } catch (err) {
            console.error("⚠️ Error while updating score:", err);
          }
        });
      });

      // --- PLAYER DROPDOWNS ---
      section.querySelectorAll(".user-dropdown").forEach(dropdown => {
        const translation = langMap[currentLang];

        // build options once
        if (!dropdown.dataset.optionsBuilt) {
          const defaultOption = `<option value="" id="selectUserDesk">${translation.selectUser || "Select Player"}</option>`;
          const options = players.map(p => `<option value="${p.id}">${p.username}</option>`).join("");
          dropdown.innerHTML = defaultOption + options;
          dropdown.dataset.optionsBuilt = "1";
        }

        // set initial selected by username (if provided) or keep existing value
        if (dropdown.dataset.initial === undefined) {
          const currentUsername = dropdown.dataset.initialUsername?.trim();
          if (currentUsername) {
            const found = [...dropdown.options].find(opt => opt.text.trim() === currentUsername);
            if (found) dropdown.value = found.value;
          }
          dropdown.dataset.initial = dropdown.value ?? ""; // baseline userId ('' = unassigned)
        }

        dropdown.addEventListener("change", async () => {
          const row = dropdown.closest("[data-match-id]");
          const matchId = parseInt(row?.dataset.matchId);
          const teamId = parseInt(dropdown.dataset.teamId);
          const newVal = dropdown.value ?? "";        // '' means unassign
          const base = dropdown.dataset.initial ?? ""; // previous committed value

          // unchanged -> skip
          if (newVal === base) return;

          if (!matchId || !teamId || leagueId === undefined) {
            console.warn("⚠️ Missing values, cannot attach player");
            // revert visual selection to baseline to avoid confusion
            dropdown.value = base;
            return;
          }

          const userId = newVal === "" ? null : parseInt(newVal, 10);

          try {
            const res = await apiPost("/attach-players", {
              matchId,
              teamId,
              userId,
              leagueId
            }, { showLoading: false });

            if (res.success) {
              // commit new baseline
              dropdown.dataset.initial = newVal;
              if (newVal === "") {
                showToast(translation.player_success_unassigned || "User unassigned successfully", "success");
              } else {
                showToast(translation.player_success_assigned || "User assigned successfully", "success");
              }
            } else {
              // revert UI to baseline
              dropdown.value = base;
              showToast(translation.player_assign_failed || "Failed to attach user", "error");
            }
          } catch (err) {
            // revert UI to baseline on error
            dropdown.value = base;
            console.error("⚠️ Error while attaching user:", err);
          }
        });
      });
    }
  }
}