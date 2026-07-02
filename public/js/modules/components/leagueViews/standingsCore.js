import { showToast } from '../../../utils/toast.js';
import { apiPost } from '../../../services/api.js';
import { langMap, currentLang } from '../../LanguageManager.js';
import { setGroupSelectionForContext, getGroupSelectionForContext, getGroupLetterFromName } from '../../router.js';
import { computeComp } from './config.js';

export async function renderGroupStandingsPage(leagueId, groupId, groupNameOrOpts, opts = {}, config) {
  // Backward compatible: (leagueId, groupId, opts) OR (leagueId, groupId, groupName, opts)
  let groupName = "";
  if (typeof groupNameOrOpts === "object" && groupNameOrOpts !== null) {
    opts = groupNameOrOpts;
  } else {
    groupName = groupNameOrOpts || "";
  }

  const bannerId = Number(localStorage.getItem("currentBannerId"));
  const stageType = Number(localStorage.getItem("selectedStageType")) || 1;
  const leagueTab = localStorage.getItem(config.activeLeagueTabKey) || "owners";

  const comp = computeComp(bannerId);
  const stage = stageType === 1 ? "basic" : "only";
  const access = leagueTab === "owners" ? "my" : "invited";

  if (!groupName) {
    const ctx = { comp, stage, access };
    const groupLetter = (opts?.query?.get?.("groupLetter") || "").toUpperCase();

    groupName =
      (opts?.query?.get?.("groupName")
        ? decodeURIComponent(opts.query.get("groupName"))
        : "") ||
      getGroupSelectionForContext(ctx, groupLetter).groupName ||
      "";
  }

  const initialTab = opts.initialTab || "standings";
  const wrapper = document.getElementById(config.rootId);
  const translation = langMap[currentLang];
  wrapper.innerHTML = `
  <button class="backButtn" id="${config.backBtnId}">⬅ Back</button>
    <div class="tab-switcher">
      <button class="tab-btn active" data-tab="standings" id="standingsTabBtn"></button>
      <button class="tab-btn" data-tab="matches" id="matchesTabBtn"></button>
    </div>
    <div class="group-standings-header">
      <h2>${groupName}</h2>
    </div>
    <div class="tab-content" id="tabContent">Loading...</div>
  `;

  document.getElementById("standingsTabBtn").innerText = translation.standings || "Standings";
  document.getElementById("matchesTabBtn").innerText = translation.matches || "Matches";

  const backBtn = document.getElementById(config.backBtnId);
  backBtn.textContent = translation.backButton;
  backBtn.addEventListener("click", async () => {
    location.hash = config.getBackInstancesHash();
  });

  setActiveTab(initialTab);
  await loadTabContent(initialTab);

  function setActiveTab(tab) {
    const ACTIVE_CLASS = "active";

    document.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.remove(ACTIVE_CLASS);
    });

    const target = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (target) target.classList.add(ACTIVE_CLASS);
  }

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      const view = tab === "standings" ? "standing" : "matches";

      const letter = getGroupLetterFromName(groupName);

      setGroupSelectionForContext({ comp, stage, access }, { groupId, groupName, groupLetter: letter });

      location.hash = `#${comp}-${stage}-${access}-${config.routeSegment}-group-${letter}-${view}`;
    });
  });

  async function loadTabContent(tab) {
    const contentDiv = document.getElementById("tabContent");

    try {
      if (tab === "standings") {
        const response = await apiPost(config.endpoints.standings, { leagueId, groupId });

        if (response.success) {
          contentDiv.innerHTML = renderStandingsTable(response.data.standings);
        } else {
          contentDiv.innerHTML = "Failed to load standings.";
        }
      } else if (tab === "matches") {
        // Show loading message immediately
        contentDiv.innerHTML = `<div style="padding: 20px; font-size: 16px;"></div>`;

        const [matchesResponse, playersResponse] = await Promise.all([
          apiPost(config.endpoints.matches, { leagueId, groupId }),
          apiPost(config.endpoints.players, { leagueId }, { showLoading: false }),
        ]);

        if (matchesResponse.success && playersResponse.success) {
          // Force a repaint before rendering heavy UI
          await new Promise(resolve => requestAnimationFrame(resolve));

          contentDiv.innerHTML = ""; // Now clear and render
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
          ${standings.map((team, index) => {
      const teamLogo = team.logo_url || 'https://uefaresults.com/assets/logos/defaultLogo.png';
      return `<tr>
              <td>${index + 1}. <img src="${teamLogo}" class="team_logo"> ${team[config.teamNameField]}</td>
              <td>${team.played ?? 0}</td>
              <td>${team.wins ?? 0}</td>
              <td>${team.draws ?? 0}</td>
              <td>${team.losses ?? 0}</td>
              <td>${team.goals_for ?? 0}</td>
              <td>${team.goals_against ?? 0}</td>
              <td>${team.goal_difference ?? 0}</td>
              <td>${team.points ?? 0}</td>
            </tr>
          `}).join("")}
        </tbody>
      </table>

      <!-- Mobile version -->
    <div class="mobile-standings-container">
  <div class="scroll-layout">
    <div class="fixed-clubs">
      <div class="club-header" id="teamMobile">${translation.teams || "Teams"}</div>
      ${standings.map((team, index) => {
        const teamLogo = team.logo_url || 'https://uefaresults.com/assets/logos/defaultLogo.png';
        return `
        <div class="club-name">${index + 1}. <img src="${teamLogo}" class="team_logo"> ${team[config.teamNameField]}</div>
      `}).join("")}
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

  async function renderMatchesTable(matchesData, section, leagueId, players = []) {
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
        ${matches.map(match => {
        const team1Logo = match.team1_logo || 'https://uefaresults.com/assets/logos/defaultLogo.png';
        const team2Logo = match.team2_logo || 'https://uefaresults.com/assets/logos/defaultLogo.png';
        return `
          <tr data-match-id="${match.id}">
            <td>
              <select class="user-dropdown" name="team1_user" data-team-id="${match.team1_id}" data-initial-username="${match.team1_username || ''}" ${editable ? "" : "disabled"}>
                <option value="">${match.team1_username || "Select user"}</option>
              </select>
            </td>
            <td><img src="${team1Logo}" class="team_logo"> ${match.team1_name}</td>
            <td><input type="number" class="score-input" name="team1" value="${match.team1_score}" ${editable ? "" : "disabled"}></td>
            <td><input type="number" class="score-input" name="team2" value="${match.team2_score}" ${editable ? "" : "disabled"}></td>
            <td><img src="${team2Logo}" class="team_logo"> ${match.team2_name}</td>
            <td>
              <select class="user-dropdown" name="team2_user" data-team-id="${match.team2_id}" data-initial-username="${match.team2_username || ''}" ${editable ? "" : "disabled"}>
                <option value="">${match.team2_username || "Select user"}</option>
              </select>
            </td>
          </tr>
        `}).join("")}
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
        const team1Logo = match.team1_logo || 'https://uefaresults.com/assets/logos/defaultLogo.png';
        const team2Logo = match.team2_logo || 'https://uefaresults.com/assets/logos/defaultLogo.png';

        matchWrapper.innerHTML = `
        <div class="match-line">
          <select class="user-dropdown" name="team1_user" data-team-id="${match.team1_id}" data-initial-username="${match.team1_username || ''}" ${editable ? "" : "disabled"}>
            <option value="">${match.team1_username || "Select Player"}</option>
          </select>
          <div class="team-name"><img src="${team1Logo}" class="team_logo"> ${match.team1_name}</div>
          <input type="number" class="score-input" name="team1" value="${match.team1_score}" ${editable ? "" : "disabled"}>
        </div>
        <div class="match-line">
          <select class="user-dropdown" name="team2_user" data-team-id="${match.team2_id}" data-initial-username="${match.team2_username || ''}" ${editable ? "" : "disabled"}>
            <option value="">${match.team2_username || "Select Player"}</option>
          </select>
          <div class="team-name"><img src="${team2Logo}" class="team_logo"> ${match.team2_name}</div>
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
        if (input.dataset.initial === undefined) {
          input.dataset.initial = (input.value ?? "").trim();
        }

        input.addEventListener("focus", () => {
          input.dataset.focusInitial = (input.value ?? "").trim();
        });

        input.addEventListener("input", () => {
          if (input.value !== "" && Number(input.value) < 0) input.value = "";
        });

        input.addEventListener("blur", async () => {
          const row = input.closest("[data-match-id]");
          const matchId = parseInt(row?.dataset.matchId);
          const raw = (input.value ?? "").trim();

          if (raw === "" || Number.isNaN(Number(raw)) || Number(raw) < 0) {
            input.value = "";
            return;
          }

          const newVal = String(Number(raw)); // normalize "02" -> "2"
          const base = input.dataset.initial ?? "";
          const baseAtFocus = input.dataset.focusInitial ?? base;

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
            const res = await apiPost(config.endpoints.updateScore, payload);
            if (res.success) {
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

        if (!dropdown.dataset.optionsBuilt) {
          const defaultOption = `<option value="" id="selectUserDesk">${translation.selectUser || "Select Player"}</option>`;
          const options = players.map(p => `<option value="${p.id}">${p.username}</option>`).join("");
          dropdown.innerHTML = defaultOption + options;
          dropdown.dataset.optionsBuilt = "1";
        }

        if (dropdown.dataset.initial === undefined) {
          const currentUsername = dropdown.dataset.initialUsername?.trim();
          if (currentUsername) {
            const found = [...dropdown.options].find(opt => opt.text.trim() === currentUsername);
            if (found) dropdown.value = found.value;
          }
          dropdown.dataset.initial = dropdown.value ?? "";
        }

        dropdown.addEventListener("change", async () => {
          const row = dropdown.closest("[data-match-id]");
          const matchId = parseInt(row?.dataset.matchId);
          const teamId = parseInt(dropdown.dataset.teamId);
          const newVal = dropdown.value ?? "";
          const base = dropdown.dataset.initial ?? "";

          if (newVal === base) return;

          if (!matchId || !teamId || leagueId === undefined) {
            console.warn("⚠️ Missing values, cannot attach player");
            dropdown.value = base;
            return;
          }

          const userId = newVal === "" ? null : parseInt(newVal, 10);

          try {
            const res = await apiPost(config.endpoints.attachPlayer, {
              matchId,
              teamId,
              userId,
              leagueId,
            }, { showLoading: false });

            if (res.success) {
              dropdown.dataset.initial = newVal;
              if (newVal === "") {
                showToast(translation.player_success_unassigned || "User unassigned successfully", "success");
              } else {
                showToast(translation.player_success_assigned || "User assigned successfully", "success");
              }
            } else {
              dropdown.value = base;
              showToast(translation.player_assign_failed || "Failed to attach user", "error");
            }
          } catch (err) {
            dropdown.value = base;
            console.error("⚠️ Error while attaching user:", err);
          }
        });
      });
    }
  }
}
