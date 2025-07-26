import { apiPost } from '../../services/api.js';

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
  const section = document.getElementById("leagueType1");
  section.innerHTML = "";

  instanceData.leagueInstances.forEach(instance => {
    const instanceDiv = document.createElement("div");
    instanceDiv.className = "league-instance";

    const leagueTitle = `<h2>${instance.name}</h2>`;
    const groupsWrapper = document.createElement("div");
    groupsWrapper.className = "groups-row"; // Flex wrapper

    for (const [groupName, groupData] of Object.entries(instance.groups)) {
      const groupDiv = document.createElement("div");
      groupDiv.className = "group-block";

      groupDiv.innerHTML = `
        <h3>${groupName}</h3>
        <ul class="club-list">
          ${groupData.clubs.map(club => `<li>${club.name}</li>`).join("")}
        </ul>
      `;

      groupsWrapper.appendChild(groupDiv);
    }

    instanceDiv.innerHTML = leagueTitle;
    instanceDiv.appendChild(groupsWrapper);
    section.appendChild(instanceDiv);
  });

  section.style.display = "block";
}