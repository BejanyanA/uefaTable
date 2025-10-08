import { langMap, currentLang } from './LanguageManager.js';
import { getFriends } from './GetFriends.js';
import { apiGet, apiPost } from '../services/api.js';

export const ProfileManager = {

  openFriends: async function () {
    const translation = langMap[currentLang];
    const section = document.getElementById("friendsContainer");
    section.innerHTML = ""; // Clear previous content
    section.style.display = "block";

    // 🔹 Friends click logic
    const friendsLink = document.getElementById("friends");
    friendsLink.addEventListener("click", () => {

      const homeButton = document.createElement("button");
      homeButton.textContent = translation.homeButton;
      homeButton.id = "homeButton";

      homeButton.addEventListener("click", async () => {
        const token = localStorage.getItem("authToken");

        try {
          const response = await apiGet("/me", token);
          if (response.success && response.user) {
            document.getElementById("headerUsername").style.display = "block";
            document.getElementById("profileMenu").style.display = "block";
            document.getElementById("homePage").style.display = "block";
            document.getElementById("bannerContainer").style.display = "block";
            document.getElementById("stageContainer").style.display = "none";
            document.getElementById("leagueType1").style.display = "none";
            document.getElementById("leagueType2").style.display = "none";
            document.getElementById("loginBtn").style.display = "none";
            document.getElementById("registerBtn").style.display = "none";
            document.getElementById("friendsContainer").style.display = "none";
          } else {
            localStorage.removeItem("authToken");
            if (authButtons) authButtons.style.display = "flex";
            document.getElementById("bannerContainer").style.display = "none";
          }
        } catch (err) {
          console.error("🔴 Error in Back button to /me:", err);
          localStorage.removeItem("authToken");
          if (authButtons) authButtons.style.display = "flex";
        }
      });

      section.appendChild(homeButton); // Add Back button


      document.getElementById("headerUsername").style.display = "block";
      document.getElementById("profileMenu").style.display = "block";
      document.getElementById("friendsContainer").style.display = "block";
      document.getElementById("bannerContainer").style.display = "none";
      document.getElementById("stageContainer").style.display = "none";
      document.getElementById("leagueType1").style.display = "none";
      document.getElementById("leagueType2").style.display = "none";
      localStorage.removeItem("lastActiveLeagueTab");
      localStorage.removeItem("leaguesActiveTab");
      localStorage.removeItem("lastActiveNationalLeagueTab");
      localStorage.removeItem("currentBannerId");
      localStorage.removeItem("leagueId");
      localStorage.removeItem("selectedStageType");

      getFriends.initGetAllFriendsStatuses();


      // ✅ Tabs header (always shown now since we have some data)
      const tabsHeader = document.createElement("div");
      tabsHeader.className = "tab-switcher";
      tabsHeader.id = "friendsTab";

      const friendsTabBtn = document.createElement("button");
      friendsTabBtn.className = "tab-btn";
      friendsTabBtn.dataset.tab = "approvedFriendsTab";
      friendsTabBtn.id = "friends";
      friendsTabBtn.textContent = translation.friends || "Friends";

      const pendingUsersTabBtn = document.createElement("button");
      pendingUsersTabBtn.className = "tab-btn";
      pendingUsersTabBtn.dataset.tab = "pendingUsersTab";
      pendingUsersTabBtn.id = "pendingUsers";
      pendingUsersTabBtn.textContent = translation.pendingUsers || "Friend Requests";


      const rejectedUsersTabBtn = document.createElement("button");
      rejectedUsersTabBtn.className = "tab-btn";
      rejectedUsersTabBtn.dataset.tab = "rejectedUsersTab";
      rejectedUsersTabBtn.id = "rejectedUsers";
      rejectedUsersTabBtn.textContent = translation.rejectedUsers || "Rejected Users";

      tabsHeader.appendChild(friendsTabBtn);
      tabsHeader.appendChild(pendingUsersTabBtn);
      tabsHeader.appendChild(rejectedUsersTabBtn);
      section.appendChild(tabsHeader);




      const friendsEmpty = document.createElement("div");
      friendsEmpty.id = "noUsersData";
      friendsEmpty.innerHTML = `<h2 id="usersNotExist">${translation.friendsNotExist || "No friends found"}</h2>`;
      section.appendChild(friendsEmpty)

      const pendingUsersEmpty = document.createElement("div");
      pendingUsersEmpty.id = "noUsersData";
      pendingUsersEmpty.innerHTML = `<h2 id="usersNotExist">${translation.usersNotExist || "No users found"}</h2>`;
      section.appendChild(pendingUsersEmpty)

      const rejectedUsersEmpty = document.createElement("div");
      rejectedUsersEmpty.id = "noUsersData";
      rejectedUsersEmpty.innerHTML = `<h2 id="usersNotExist">${translation.usersNotExist || "No users found"}</h2>`;
      section.appendChild(rejectedUsersEmpty)

      // ✅ Tab filtering (show/hide items, keep grid/row layout intact)
      const ACTIVE = (typeof window !== "undefined" && window.ACTIVE_CLASS) || "active-tab";

      let activeTab = localStorage.getItem("lastActiveFriendsTab") || "friends";
      if (activeTab === "friends") {
        friendsTabBtn.classList.add(ACTIVE);
        friendsTabBtn.setAttribute("aria-selected", "true");
      } else {
        pendingUsersTabBtn.classList.add(ACTIVE);
        pendingUsersTabBtn.setAttribute("aria-selected", "true");
      }

      const showTab = (tab) => {
        activeTab = tab;
        localStorage.setItem("lastActiveFriendsTab", tab);
        const items = rowContainer.querySelectorAll(".league-names-row-item");
        let visibleCount = 0;

        items.forEach(item => {
          if (item === friendsEmpty || item === invitedEmpty) {
            item.style.display = "none";
            return;
          }
          const match = (item.dataset.group === tab);
          item.style.display = match ? "" : "none";
          if (match) visibleCount++;
        });

        friendsEmpty.style.display = (tab === "friends" && visibleCount === 0) ? "" : "none";
        invitedEmpty.style.display = (tab === "invited" && visibleCount === 0) ? "" : "none";

        friendsTabBtn.setAttribute("aria-selected", tab === "friends" ? "true" : "false");
        pendingUsersTabBtn.setAttribute("aria-selected", tab === "invited" ? "true" : "false");

        [friendsTabBtn, pendingUsersTabBtn].forEach(b => {
          b.classList.remove(ACTIVE);
          b.classList.remove("active");
        });
        if (tab === "friends") friendsTabBtn.classList.add(ACTIVE);
        else pendingUsersTabBtn.classList.add(ACTIVE);
      };

      [friendsTabBtn, pendingUsersTabBtn].forEach(btn => {
        btn.addEventListener("click", () => {
          if (btn.classList.contains(ACTIVE)) return; // already active
          const tab = btn.dataset.tab === "friends" ? "friends" : "invited";
          showTab(tab);
        });
      });

      // Initial view
      showTab(activeTab);




    });

  },






};