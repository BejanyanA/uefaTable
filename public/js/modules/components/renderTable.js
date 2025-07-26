import { apiPost } from '../../services/api.js';
import { renderGroupStandingsPage } from './renderStandings.js'

export function renderLeagueTable(data) {
  const section = document.getElementById("leagueType1");
  const leagues = data.leagues || [];

  if (!leagues.length) {
    section.innerHTML = `<div><h2>No leagues found</h2></div>`;
    section.style.display = "block";
    return;
  }

  section.innerHTML = `<div class="league-names-row"></div>`;
  const rowContainer = section.querySelector(".league-names-row");

  leagues.forEach(league => {
    const leagueBox = document.createElement("div");
    leagueBox.className = "league-name-box";
    leagueBox.textContent = league.name;

    leagueBox.addEventListener("click", async () => {
      try {
        const response = await apiPost("/league-instances", { leagueId: league.id });
        if (response.success) {
          renderLeagueInstances(response.data);
        } else {
          section.innerHTML = `<p>Error loading instances</p>`;
        }
      } catch (err) {
        console.error("Failed to fetch league instances", err);
      }
    });

    rowContainer.appendChild(leagueBox);
  });

  section.style.display = "block";
}


export function renderLeagueInstances(instanceData) {
  const wrapper = document.getElementById("leagueType1");
  wrapper.innerHTML = "";

  const instances = instanceData.leagueInstances || [];
  const hasVisibleGroups = instances.some(i => i.groups && Object.keys(i.groups).length);

  if (!hasVisibleGroups) {
    wrapper.style.display = "none";
    return;
  }

  wrapper.style.display = "block";

  instances.forEach(instance => {
    const groups = instance.groups || {};
    if (!Object.keys(groups).length) return;

    const instanceDiv = document.createElement("div");
    instanceDiv.className = "league-instance";

    const leagueTitle = document.createElement("h2");
    leagueTitle.textContent = instance.name;
    instanceDiv.appendChild(leagueTitle);

    const centeredWrapper = document.createElement("div");
    centeredWrapper.className = "groups-center-wrapper";

    const groupsRow = document.createElement("div");
    groupsRow.className = "groups-row";

    for (const [groupName, groupData] of Object.entries(groups)) {
      const groupDiv = document.createElement("div");
      groupDiv.className = "group-block";

      // 🔹 Set data attributes for click handler
      groupDiv.dataset.leagueId = instance.id;
      groupDiv.dataset.groupId = groupData.groupId;
      groupDiv.dataset.groupName = groupName;

      groupDiv.innerHTML = `
        <h3>${groupName}</h3>
        <ul class="club-list">
          ${groupData.clubs.map(club => `<li>${club.name}</li>`).join("")}
        </ul>
      `;

      // ✅ CLICK HANDLER
      groupDiv.addEventListener("click", () => {
        const leagueId = groupDiv.dataset.leagueId;
        const groupId = groupDiv.dataset.groupId;
        const groupName = groupDiv.dataset.groupName;
        renderGroupStandingsPage(leagueId, groupId, groupName);
      });

      groupsRow.appendChild(groupDiv);
    }

    centeredWrapper.appendChild(groupsRow);
    instanceDiv.appendChild(centeredWrapper);
    wrapper.appendChild(instanceDiv);
  });
}