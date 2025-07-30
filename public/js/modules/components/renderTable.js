import { apiGet, apiPost } from '../../services/api.js';
import { renderGroupStandingsPage } from './renderStandings.js'
import { langMap, currentLang } from '../LanguageManager.js';
import { LeagueManager } from '../LeagueManager.js';

export function renderLeagueTable(data) {
  const translation = langMap[currentLang];
  const section = document.getElementById("leagueType1");
  const leagues = data.leagues || [];

  section.innerHTML = ""; // Clear previous content
  section.style.display = "block";

  // ✅ Add Back Button to /me
  const backBtn = document.createElement("button");
  backBtn.textContent = translation.backButton;
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
    const translation = langMap[currentLang];
    const noDataMsg = document.createElement("div");
    noDataMsg.innerHTML = `<h2 id="leagueNotExist">${translation.leagueNotExist || "No leagues found"}</h2>`;
    noDataMsg.id = "noLeaguedata";
    section.appendChild(noDataMsg);
    return;
  }

  // ✅ Container for league boxes
  const rowContainer = document.createElement("div");
  rowContainer.className = "league-names-row";
  section.appendChild(rowContainer);

  leagues.forEach(league => {
    const leagueRow = document.createElement("div");
    leagueRow.className = "league-names-row-item";

    const leagueBox = document.createElement("div");
    leagueBox.className = "league-name-box";
    leagueBox.textContent = league.name;
    leagueBox.style.cursor = "pointer";

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

    leagueRow.appendChild(leagueBox);

    // Access control: true if owner
    const isOwner = league.accessType === "owner";

    // ✏️ Edit Icon
    const editIcon = document.createElement("span");
    editIcon.innerHTML = "✏️";
    editIcon.className = "league-edit-icon";
    editIcon.style.marginLeft = "8px";
    editIcon.style.cursor = isOwner ? "pointer" : "not-allowed";
    editIcon.style.opacity = isOwner ? "1" : "0.4";
    editIcon.title = isOwner ? "Edit League" : "Only the owner can edit";
    editIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOwner) {
        LeagueManager.initEdit(league.id, league.name);
      } else {
        showMobileTooltip(editIcon, "Only the owner can edit");
      }
    });

    // 🗑️ Delete Icon
    const deleteIcon = document.createElement("span");
    deleteIcon.innerHTML = "🗑️";
    deleteIcon.className = "league-delete-icon";
    deleteIcon.style.marginLeft = "8px";
    deleteIcon.style.cursor = isOwner ? "pointer" : "not-allowed";
    deleteIcon.style.opacity = isOwner ? "1" : "0.4";
    deleteIcon.title = isOwner ? "Delete League" : "Only the owner can delete";
    deleteIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOwner) {
        LeagueManager.initDelete(league.id);
      } else {
        showMobileTooltip(deleteIcon, "Only the owner can delete");
      }
    });

    leagueRow.appendChild(editIcon);
    leagueRow.appendChild(deleteIcon);

    rowContainer.appendChild(leagueRow);
  });

  function showMobileTooltip(targetElement, message) {
    if (document.querySelector(".mobile-tooltip")) return;

    const tooltip = document.createElement("div");
    tooltip.className = "mobile-tooltip";
    tooltip.textContent = message;

    document.body.appendChild(tooltip);

    // Get positions
    const rect = targetElement.getBoundingClientRect();

    // Adjust: move lower and left
    const verticalOffset = 8; // pixels lower
    const horizontalOffset = 1; // pixels more to the left

    const top = rect.bottom + window.scrollY + verticalOffset;
    const left = rect.left + window.scrollX - tooltip.offsetWidth - horizontalOffset;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;

    setTimeout(() => {
      tooltip.classList.add("show");
      setTimeout(() => {
        tooltip.classList.remove("show");
        setTimeout(() => tooltip.remove(), 300);
      }, 2000);
    }, 10);
  }
}


export function renderLeagueInstances(instanceData) {
  const translation = langMap[currentLang];
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
  backBtn.textContent = translation.backButton;
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