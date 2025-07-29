import { apiGet, apiPost } from '../../services/api.js';
import { renderGroupStandingsPage } from './renderStandings.js'

export function renderLeagueTable(data) {
  const section = document.getElementById("leagueType1");
  const leagues = data.leagues || [];

  section.innerHTML = ""; // Clear previous content
  section.style.display = "block";

  // ✅ Add Back Button to /me
  const backBtn = document.createElement("button");
  backBtn.textContent = "⬅ Back";
  backBtn.id = "backBtn";

  backBtn.addEventListener("click", async () => {
    const token = localStorage.getItem("authToken");

    try {
      const response = await apiGet("/me", token);
      if (response.success && response.user) {
         document.getElementById("logoutButtn").style.display = "block";
         document.getElementById("bannerContainer").style.display = "block";
         document.getElementById("leagueType1").style.display = "none";
      } else {
        localStorage.removeItem("authToken");
        if (authButtons) authButtons.style.display = "flex";
      }
    } catch (err) {
      console.error("🔴 Error in Back button to /me:", err);
      localStorage.removeItem("authToken");
      if (authButtons) authButtons.style.display = "flex";
    }
  });

  section.appendChild(backBtn); // Add Back button

  // ✅ If no leagues
  if (!leagues.length) {
    const noDataMsg = document.createElement("div");
    noDataMsg.innerHTML = `<h2>No leagues found</h2>`;
    noDataMsg.id = "noLeaguedata"; 
    section.appendChild(noDataMsg);
    return;
  }

  // ✅ Container for league boxes
  const rowContainer = document.createElement("div");
  rowContainer.className = "league-names-row";
  section.appendChild(rowContainer);

  leagues.forEach(league => {
    const leagueBox = document.createElement("div");
    leagueBox.className = "league-name-box";
    leagueBox.textContent = league.name;

    leagueBox.addEventListener("click", async () => {
      try {
        const response = await apiPost("/league-instances", { leagueId: league.id });
        if (response.success) {
          localStorage.setItem("leagueId", league.id);
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

  // ✅ Back button to return to /leagues

  const backBtn = document.createElement("button");
  backBtn.textContent = "⬅ Back";
  backBtn.id = "backBtn";
  const bannerId = parseInt(localStorage.getItem("currentBannerId"))
  backBtn.addEventListener("click", async () => {

    try {
      const data = await apiPost("/leagues", { bannerId });
      if (data.success && data.data) {
        wrapper.style.display = "none";
        document.getElementById("bannerContainer").style.display = "none"; // Optional if modal used
        renderLeagueTable(data.data);
      } else {
        showToast("Table not found.");
      }
    } catch (err) {
      console.error("Error loading leagues", err);
      showToast("Something went wrong", "error");
    }
  });

  wrapper.appendChild(backBtn); // ✅ Add back button to wrapper


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
        const leagueId = parseInt(groupDiv.dataset.leagueId);
        const groupId = parseInt(groupDiv.dataset.groupId);
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