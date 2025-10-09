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

      section.innerHTML = "";
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

      // --- after: const tabsHeader = document.createElement("div"); tabsHeader.className = "tab-switcher"; tabsHeader.id = "friendsTab";
      const ACTIVE = (typeof window !== "undefined" && window.ACTIVE_CLASS) || "active-tab";

      // Build tab buttons (keep your class naming)
      const friendsTabBtn = document.createElement("button");
      friendsTabBtn.className = "tab-btn";
      friendsTabBtn.dataset.tab = "approved";
      friendsTabBtn.id = "myFriendsTab";
      friendsTabBtn.textContent = translation.myFriends || "Friends";

      const pendingTabBtn = document.createElement("button");
      pendingTabBtn.className = "tab-btn";
      pendingTabBtn.dataset.tab = "pending";
      pendingTabBtn.id = "pendingUsersTab";
      pendingTabBtn.textContent = translation.pendingUsers || "Pending";

      const rejectedTabBtn = document.createElement("button");
      rejectedTabBtn.className = "tab-btn";
      rejectedTabBtn.dataset.tab = "rejected";
      rejectedTabBtn.id = "rejectedUsersTab";
      rejectedTabBtn.textContent = translation.rejectedUsers || "Rejected";

      tabsHeader.appendChild(friendsTabBtn);
      tabsHeader.appendChild(pendingTabBtn);
      tabsHeader.appendChild(rejectedTabBtn);
      section.appendChild(tabsHeader);

      // Container row for items
      const rowContainer = document.createElement("div");
      rowContainer.className = "friends-row"; // your grid/row class if you have
      rowContainer.id = "friendsRow";
      section.appendChild(rowContainer);

      // Per-tab empty placeholders (hidden by default)
      const emptyApproved = document.createElement("div");
      emptyApproved.id = "usersData";
      emptyApproved.innerHTML = `<h2 id="friendsNotExist">${translation.no_friends_found || "No friends found"}</h2>`;
      section.appendChild(emptyApproved);

      const emptyPending = document.createElement("div");
      emptyPending.id = "usersData";
      emptyPending.innerHTML = `<h2 id="usersNotExist">${translation.usersNotExist || "No users found"}</h2>`;
      section.appendChild(emptyPending);

      const emptyRejected = document.createElement("div");
      emptyRejected.id = "usersData";
      emptyRejected.innerHTML = `<h2 id="usersNotExist">${translation.usersNotExist || "No users found"}</h2>`;
      section.appendChild(emptyRejected);

      // State
      let friendsData = []; // will be set when the request returns
      let activeTab = "approved"; // default to Friends

      // Render list items (id, username, status)
      function renderFriendsList(list) {
        // Remove previously rendered items but keep placeholders
        rowContainer.querySelectorAll(".friends-row-item[data-status]").forEach(n => n.remove());

        (list || []).forEach(user => {
          const item = document.createElement("div");
          item.className = "friends-row-item";
          item.dataset.status = user.status; // "approved" | "pending" | "rejected"

          const box = document.createElement("div");
          box.className = "friend-box"; // keep your own class if you have a style
          box.textContent = user.username;
          item.appendChild(box);

          // (Optional) add action icons per status later

          rowContainer.appendChild(item);
        });
      }

      // Show/hide per tab
      function showFriendsTab(tab) {
        activeTab = tab;

        // buttons visual (mirror your tab logic)
        [friendsTabBtn, pendingTabBtn, rejectedTabBtn].forEach(b => {
          b.classList.remove(ACTIVE);
          b.classList.remove("active");
        });
        if (tab === "approved") friendsTabBtn.classList.add(ACTIVE);
        if (tab === "pending") pendingTabBtn.classList.add(ACTIVE);
        if (tab === "rejected") rejectedTabBtn.classList.add(ACTIVE);

        // Filter visibility
        const items = rowContainer.querySelectorAll(".friends-row-item");
        let visibleCount = 0;
        items.forEach(el => {
          if (!el.dataset.status) { // placeholders handled below
            el.style.display = "none";
            return;
          }
          const match = el.dataset.status === tab;
          el.style.display = match ? "" : "none";
          if (match) visibleCount++;
        });

        // Empty states
        emptyApproved.style.display = (tab === "approved" && visibleCount === 0) ? "" : "none";
        emptyPending.style.display = (tab === "pending" && visibleCount === 0) ? "" : "none";
        emptyRejected.style.display = (tab === "rejected" && visibleCount === 0) ? "" : "none";
      }

      // Click handlers — same pattern as your tabs
      [friendsTabBtn, pendingTabBtn, rejectedTabBtn].forEach(btn => {
        btn.addEventListener("click", () => {
          if (btn.classList.contains(ACTIVE)) return;
          showFriendsTab(btn.dataset.tab);
        });
      });

      // Hook for your fetcher:
      // 1) If your getFriends.initGetAllFriendsStatuses() can call this, we're done:
      window.__setFriendsStatuses = function (payload) {
        // expecting payload like: { friends: [ {id, username, status}, ... ] }
        const list = (payload && payload.friends) || [];
        friendsData = list;
        renderFriendsList(friendsData);
        showFriendsTab(activeTab);
      };

      // 2) Or, if your fetcher dispatches an event instead, we support it too:
      document.addEventListener("friends:statuses:loaded", (e) => {
        const detail = (e && e.detail) || {};
        const list = (detail && detail.friends) || [];
        friendsData = list;
        renderFriendsList(friendsData);
        showFriendsTab(activeTab);
      });

      // Initialize the view (tabs visible immediately; content appears when data arrives)
      showFriendsTab(activeTab);




    });

  },






};