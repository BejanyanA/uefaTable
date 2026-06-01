import { apiGet, apiPost } from '../../services/api.js';
import { renderLeagueGroupStandingsPage } from './renderLeagueStandings.js'
import { langMap, currentLang } from '../LanguageManager.js';
import { LeagueManager } from '../LeagueManager.js';
import { renderLeagueKnockoutsStage, renderLeagueOnlyKnockouts } from './renderLeagueKnockout.js'
import { setLeagueIdForContext } from '../router.js';
import { getLeagueIdForContext } from '../router.js';
import { setGroupIdForContext } from '../router.js';
import { setGroupSelectionForContext } from '../router.js';
import { getGroupLetterFromName } from '../router.js';
import { customLeagues } from '../CustomLeagues.js';

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

    customLeagues()

    localStorage.removeItem("lastActiveLeagueTab");

    const bannerId = Number(localStorage.getItem("currentBannerId"));
    if (bannerId === 1) location.hash = "#champions-league";
    else if (bannerId === 2) location.hash = "#europe-league";
    else if (bannerId === 3) location.hash = "#euro-cup";
    else if (bannerId === 4) location.hash = "#world-cup";
    else location.hash = "#leagues";
  });

  section.appendChild(backBtn); // Add Back button

  // // ✅ If no leagues at all → show your exact empty state and RETURN (no tabs)
  // if (!leagues.length) {
  //   const noDataMsg = document.createElement("div");
  //   noDataMsg.innerHTML = `<h2 id="leagueNotExist">${translation.leagueNotExist || "No leagues found"}</h2>`;
  //   noDataMsg.id = "noLeaguedata";
  //   section.appendChild(noDataMsg);
  //   return;
  // }

  // Split groups
  const hasOwners = leagues.some(l => l.accessType === "owner");
  const hasInvited = leagues.some(l => l.accessType !== "owner"); // (kept for future use)

  // ✅ Tabs header (always shown now since we have some data)
  const tabsHeader = document.createElement("div");
  tabsHeader.className = "tab-switcher";
  tabsHeader.id = "leaguesTabs";
  tabsHeader.setAttribute("role", "tablist");

  const myTabBtn = document.createElement("button");
  myTabBtn.className = "tab-btn";
  myTabBtn.dataset.tab = "owners";
  myTabBtn.id = "myLeaguesTab";
  myTabBtn.setAttribute("role", "tab");
  myTabBtn.setAttribute("aria-controls", "leaguesRow");
  myTabBtn.textContent = translation.myCreatedLeagues || "My leagues";

  const invitedTabBtn = document.createElement("button");
  invitedTabBtn.className = "tab-btn";
  invitedTabBtn.dataset.tab = "invited";
  invitedTabBtn.id = "invitedLeaguesTab";
  invitedTabBtn.setAttribute("role", "tab");
  invitedTabBtn.setAttribute("aria-controls", "leaguesRow");
  invitedTabBtn.textContent = translation.myInvitedLeagues || "Invited Leagues";

  tabsHeader.appendChild(myTabBtn);
  tabsHeader.appendChild(invitedTabBtn);
  section.appendChild(tabsHeader);

  // ✅ Single container (preserves desktop layout)
  const rowContainer = document.createElement("div");
  rowContainer.className = "league-names-row";
  rowContainer.id = "leaguesRow";
  section.appendChild(rowContainer);

  // Render all items once; filter via tabs
  leagues.forEach(league => {
    const leagueRow = document.createElement("div");
    leagueRow.className = "league-names-row-item";
    leagueRow.dataset.group = (league.accessType === "owner") ? "owners" : "invited";

    const leagueBox = document.createElement("div");
    leagueBox.className = "league-name-box";
    leagueBox.textContent = league.name;
    leagueBox.style.cursor = "pointer";

    leagueBox.addEventListener("click", () => {
      const bannerId = Number(localStorage.getItem("currentBannerId"));
      const stageType = Number(localStorage.getItem("selectedStageType")) || 1; // 1 basic, 2 only
      const leagueTab = localStorage.getItem("lastActiveLeagueTab") || "owners";

      const comp =
        bannerId === 1 ? "ucl" :
          bannerId === 2 ? "uel" :
            bannerId === 3 ? "euro" :
              bannerId === 4 ? "wc" : null;

      const stage = stageType === 1 ? "basic" : "only";
      const access = leagueTab === "owners" ? "my" : "invited";

      setLeagueIdForContext({ comp, stage, access }, league.id);

      // for knockout-only leagues, default to knockouts
      const defaultInstancesTab = (stageType === 2) ? "knockouts" : "group";

      location.hash = `#${comp}-${stage}-${access}-club-${defaultInstancesTab}`;
    });

    leagueRow.appendChild(leagueBox);

    // 👤 Access
    const isOwner = league.accessType === "owner";

    // ✏️ Edit
    const editIcon = document.createElement("img");
    editIcon.src = "assets/icons/edit.svg";
    editIcon.alt = "Edit";
    editIcon.className = "league-edit-icon";
    editIcon.style.cursor = isOwner ? "pointer" : "not-allowed";
    editIcon.title = isOwner ? "" : (translation.owner_edit || "Only the owner can edit");
    if (!isOwner) editIcon.classList.add("icon-disabled");
    editIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOwner) {
        LeagueManager.initEdit(league.id, league.name);
      } else {
        showMobileTooltip(editIcon, "owner_edit");
      }
    });

    // 🗑️ Delete
    const deleteIcon = document.createElement("img");
    deleteIcon.src = "assets/icons/delete.svg";
    deleteIcon.alt = "Delete";
    deleteIcon.className = "league-delete-icon";
    deleteIcon.style.cursor = isOwner ? "pointer" : "not-allowed";
    deleteIcon.title = isOwner ? "" : (translation.owner_delete || "Only the owner can delete");
    if (!isOwner) deleteIcon.classList.add("icon-disabled");
    deleteIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOwner) {
        LeagueManager.initDelete(league.id);
      } else {
        showMobileTooltip(deleteIcon, "owner_delete");
      }
    });

    leagueRow.appendChild(editIcon);
    leagueRow.appendChild(deleteIcon);

    rowContainer.appendChild(leagueRow);
  });

  // 🔹 Per-tab empty placeholders (only used if one group is empty)
  const ownersEmpty = document.createElement("div");
  ownersEmpty.id = "noLeaguedata";
  ownersEmpty.innerHTML = `<h2 id="leagueNotExist">${translation.leagueNotExist || "No leagues found"}</h2>`;
  section.appendChild(ownersEmpty)

  const invitedEmpty = document.createElement("div");
  invitedEmpty.id = "noLeaguedata";
  invitedEmpty.innerHTML = `<h2 id="leagueNotExist">${translation.leagueNotExist || "No leagues found"}</h2>`;
  section.appendChild(invitedEmpty)

  // ✅ Tab filtering (show/hide items, keep grid/row layout intact)
  const ACTIVE = (typeof window !== "undefined" && window.ACTIVE_CLASS) || "active-tab";

  const hash = (location.hash || "").toLowerCase();
  const routeTab =
    hash.endsWith("-invited") ? "invited" :
      hash.endsWith("-my") ? "owners" :
        null;

  let activeTab = routeTab || localStorage.getItem("lastActiveLeagueTab") || "owners";

  if (activeTab === "owners") {
    myTabBtn.classList.add(ACTIVE);
    myTabBtn.setAttribute("aria-selected", "true");
  } else {
    invitedTabBtn.classList.add(ACTIVE);
    invitedTabBtn.setAttribute("aria-selected", "true");
  }

  const showTab = (tab) => {
    activeTab = tab;
    localStorage.setItem("lastActiveLeagueTab", tab);
    const items = rowContainer.querySelectorAll(".league-names-row-item");
    let visibleCount = 0;

    items.forEach(item => {
      if (item === ownersEmpty || item === invitedEmpty) {
        item.style.display = "none";
        return;
      }
      const match = (item.dataset.group === tab);
      item.style.display = match ? "" : "none";
      if (match) visibleCount++;
    });

    ownersEmpty.style.display = (tab === "owners" && visibleCount === 0) ? "" : "none";
    invitedEmpty.style.display = (tab === "invited" && visibleCount === 0) ? "" : "none";

    myTabBtn.setAttribute("aria-selected", tab === "owners" ? "true" : "false");
    invitedTabBtn.setAttribute("aria-selected", tab === "invited" ? "true" : "false");

    [myTabBtn, invitedTabBtn].forEach(b => {
      b.classList.remove(ACTIVE);
      b.classList.remove("active");
    });
    if (tab === "owners") myTabBtn.classList.add(ACTIVE);
    else invitedTabBtn.classList.add(ACTIVE);
  };

  const bannerId = Number(localStorage.getItem("currentBannerId"));
  const stageType = Number(localStorage.getItem("selectedStageType"));

  function getRoutePrefix() {
    if (bannerId === 1) return "ucl";
    if (bannerId === 2) return "uel";
    if (bannerId === 3) return "euro";
    if (bannerId === 4) return "wc";
    return null;
  }

  function getStageSuffix() {
    return stageType === 1 ? "basic" : "only";
  }

  myTabBtn.addEventListener("click", () => {
    const prefix = getRoutePrefix();
    if (!prefix) return;

    location.hash = `#${prefix}-${getStageSuffix()}-my`;
  });

  invitedTabBtn.addEventListener("click", () => {
    const prefix = getRoutePrefix();
    if (!prefix) return;

    location.hash = `#${prefix}-${getStageSuffix()}-invited`;
  });

  // Initial view
  showTab(activeTab);

  function showMobileTooltip(targetElement, messageKey) {
    if (document.querySelector(".mobile-tooltip")) return;

    const message =
      translation[messageKey] ||
      (messageKey === "owner_edit"
        ? "Only the owner can edit"
        : messageKey === "owner_delete"
          ? "Only the owner can delete"
          : "Restricted");

    const tooltip = document.createElement("div");
    tooltip.className = "mobile-tooltip";
    tooltip.textContent = message;

    document.body.appendChild(tooltip);

    const rect = targetElement.getBoundingClientRect();
    const verticalOffset = 8;
    const horizontalOffset = 1;

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


export function renderLeagueInstances(instanceData, options = {}) {
  const { autoRenderKnockouts = true } = options;
  const translation = langMap[currentLang];
  const wrapper = document.getElementById("leagueType1");
  wrapper.innerHTML = "";

  const instances = instanceData.leagueInstances || [];

  // Determine stage type
  const bannerId = parseInt(localStorage.getItem("currentBannerId"));
  const stageBannerId = parseInt(localStorage.getItem("selectedStageType"));
  const isGroup = stageBannerId === 1;

  // If there are no visible groups and this league is "group" type, hide like before.
  // But if it's knockout-only (isGroup === false), DO NOT early-return; we'll render KO below.
  const hasVisibleGroups = instances.some(i => i.groups && Object.keys(i.groups).length);
  const activeTab = localStorage.getItem("lastActiveInstancesTab") || "group";

  // ✅ hide ONLY if user is on Group tab
  if (!hasVisibleGroups && isGroup && activeTab === "group") {
    wrapper.style.display = "none";
    return;
  }

  // ✅ if Knockouts tab → still build UI (so knockoutTab exists)
  wrapper.style.display = "block";

  // ✅ Back button
  const backBtn = document.createElement("button");
  backBtn.textContent = translation.backButton;
  backBtn.id = "backBtn";
  backBtn.addEventListener("click", async () => {


    const bannerId = Number(localStorage.getItem("currentBannerId"));
    const stageType = Number(localStorage.getItem("selectedStageType")) || 1;
    const leagueTab = localStorage.getItem("lastActiveLeagueTab") || "owners";

    const comp =
      bannerId === 1 ? "ucl" :
        bannerId === 2 ? "uel" :
          bannerId === 3 ? "euro" :
            bannerId === 4 ? "wc" : null;

    const stage = stageType === 1 ? "basic" : "only";
    const access = leagueTab === "owners" ? "my" : "invited";

    location.hash = `#${comp}-${stage}-${access}`; // your leagues list routes
  });
  wrapper.appendChild(backBtn);
  wrapper.style.display = "block";

  // ✅ TAB SWITCHERS
  const tabWrapper = document.createElement("div");
  tabWrapper.className = "tab-switcher";

  // Conditionally create Group Stage button
  let groupStageBtn = null;
  if (isGroup) {
    groupStageBtn = document.createElement("button");
    groupStageBtn.textContent = translation.groupStageTitle || "Group Stage";
    groupStageBtn.dataset.tab = "group";
    groupStageBtn.id = "groupStageTitle"
    groupStageBtn.classList.add("tab-btn", "active-tab"); // default active when group exists
    tabWrapper.appendChild(groupStageBtn);
  }

  // Always create Knockouts button
  const knockoutBtn = document.createElement("button");
  knockoutBtn.textContent = translation.knockoutStageTitle || "Knockouts";
  knockoutBtn.dataset.tab = "knockouts";
  knockoutBtn.id = "knockoutStageTitle"
  knockoutBtn.classList.add("tab-btn");
  if (!isGroup) {
    // No group stage -> Knockouts is active by default
    knockoutBtn.classList.add("active-tab");
  }
  tabWrapper.appendChild(knockoutBtn);
  wrapper.appendChild(tabWrapper);

  // ✅ Containers for tab content (both INSIDE wrapper)
  let groupStageContainer = null;
  if (isGroup) {
    groupStageContainer = document.createElement("div");
    groupStageContainer.className = "tab-content";
    groupStageContainer.id = "groupStageTab";
    groupStageContainer.style.display = "block"; // visible by default when group exists
    wrapper.appendChild(groupStageContainer);
  }

  const knockoutContainer = document.createElement("div");
  knockoutContainer.className = "tab-content";
  knockoutContainer.id = "knockoutTab";
  knockoutContainer.style.display = isGroup ? "none" : "block"; // visible immediately if no group
  wrapper.appendChild(knockoutContainer);

  // ---------- helpers ----------
  function renderGroupsInto(container, instancesList) {
    container.innerHTML = ""; // clear only the pane

    instancesList.forEach(instance => {
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
        groupDiv.dataset.leagueId = instance.id;
        groupDiv.dataset.groupId = groupData.groupId;
        groupDiv.dataset.groupName = groupName;

        groupDiv.innerHTML = `
        <h3>${groupName}</h3>
        <ul class="club-list" style="list-style: none; padding: 0; margin: 0;">
        ${groupData.clubs.map((club, index) => {
          const teamLogo = club.logo || 'https://uefaresults.com/assets/logos/defaultLogo.png';
          return `<li>${index + 1}.&nbsp;&nbsp;<img src="${teamLogo}" class="team_logo"> ${club.name}</li>`;
        })
            .join("")}
        </ul>
        `;

        groupDiv.addEventListener("click", () => {
          const groupId = Number(groupDiv.dataset.groupId);
          const gName = groupDiv.dataset.groupName || "";

          const bannerId = Number(localStorage.getItem("currentBannerId"));
          const stageType = Number(localStorage.getItem("selectedStageType")) || 1;
          const leagueTab = localStorage.getItem("lastActiveLeagueTab") || "owners";

          const comp =
            bannerId === 1 ? "ucl" :
              bannerId === 2 ? "uel" :
                bannerId === 3 ? "euro" :
                  bannerId === 4 ? "wc" : "ucl";

          const stage = stageType === 1 ? "basic" : "only";
          const access = leagueTab === "owners" ? "my" : "invited";

          const letter = getGroupLetterFromName(gName);

          setGroupSelectionForContext({ comp, stage, access }, { groupId, groupName: gName, groupLetter: letter });

          location.hash = `#${comp}-${stage}-${access}-club-group-${letter}-standing`;
        });

        groupsRow.appendChild(groupDiv);
      }

      centeredWrapper.appendChild(groupsRow);
      instanceDiv.appendChild(centeredWrapper);
      container.appendChild(instanceDiv);
    });
  }

  function getInstancesBase() {
    const bannerId = Number(localStorage.getItem("currentBannerId"));
    const stageType = Number(localStorage.getItem("selectedStageType")) || 1;
    const leagueTab = localStorage.getItem("lastActiveLeagueTab") || "owners";

    const comp =
      bannerId === 1 ? "ucl" :
        bannerId === 2 ? "uel" :
          bannerId === 3 ? "euro" :
            bannerId === 4 ? "wc" : null;

    const stage = stageType === 1 ? "basic" : "only";
    const access = leagueTab === "owners" ? "my" : "invited";

    return { comp, stage, access };
  }

  tabWrapper.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab; // "group" | "knockouts"
      const { comp, stage, access } = getInstancesBase();
      if (!comp) return;

      location.hash = `#${comp}-${stage}-${access}-club-${tab}`;
    });
  });

  // ---- Initial fill
  if (isGroup) {
    renderGroupsInto(groupStageContainer, instances);
  } else {
    // ✅ Only render automatically if allowed
    if (autoRenderKnockouts) {
      const leagueId = getLeagueIdForContext({ comp, stage, access });
      knockoutContainer.innerHTML = "";
      renderLeagueOnlyKnockouts(leagueId, knockoutContainer);
    }
  }
}