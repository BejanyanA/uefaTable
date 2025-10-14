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
        rowContainer.querySelectorAll(".friend-item").forEach(n => n.remove());

        (list || []).forEach(friend => {
          const item = document.createElement("div");
          item.className = `friend-item status-${friend.status} friends-row-item friend-box`; // ← your exact classes
          item.dataset.status = friend.status;                    // ← used by filter

          // Friend name
          const box = document.createElement("div");
          const name = document.createElement("span");
          name.className = "friend-name";
          name.textContent = friend.username;
          item.appendChild(name);

          const actions = document.createElement("div");
          actions.className = "friend-actions";
          if (friend.status === "approved") {
            actions.innerHTML = `
        <button class="action-delete" id="delete">Delete</button>
        <button class="action-reject" id="reject">Reject</button>`;
          } else if (friend.status === "pending") {
            actions.innerHTML = `
       <button class="action-approve" id="approve">Approve</button>
       <button class="action-reject" id="reject">Reject</button>        
       <button class="action-delete">Delete</button>`;
          } else if (friend.status === "rejected") {
            actions.innerHTML = `<button class="action-delete" id="delete">Delete</button>`;
          }
          item.appendChild(actions);

          rowContainer.appendChild(item);
          enhanceActionsForMobile(actions);
        });
      }

      function enhanceActionsForMobile(actionsDiv) {
        // Build toggle button (⋮) + menu container
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "friend-actions-menu-toggle"; // new class, mobile-only visible
        toggle.setAttribute("aria-haspopup", "true");
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = "&#8942;"; // vertical ellipsis (⋮)

        const menu = document.createElement("div");
        menu.className = "friend-actions-menu"; // new class, mobile-only dropdown
        menu.setAttribute("role", "menu");
        menu.tabIndex = -1;

        // Clone existing action buttons into menu items
        const originalButtons = Array.from(actionsDiv.querySelectorAll("button"));
        originalButtons.forEach((btn, i) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = `menu-item ${btn.className}` ; // preserve your action-* classes
          item.textContent = btn.textContent;
          item.setAttribute("role", "menuitem");

          // When a menu item is clicked, trigger the original button’s click (so existing handlers keep working)
          item.addEventListener("click", (e) => {
            e.stopPropagation();
            btn.click();
            menu.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
          });

          menu.appendChild(item);
        });

        // Toggle logic
        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          const willOpen = !menu.classList.contains("open");
          document.querySelectorAll(".friend-actions-menu.open").forEach(m => m.classList.remove("open"));
          document.querySelectorAll(".friend-actions-menu-toggle[aria-expanded='true']").forEach(t => t.setAttribute("aria-expanded", "false"));
          if (willOpen) {
            menu.classList.add("open");
            toggle.setAttribute("aria-expanded", "true");
            // focus first item for accessibility
            const first = menu.querySelector(".menu-item");
            if (first) first.focus();
          }
        });

        // Close on outside click / Escape
        document.addEventListener("click", () => {
          if (menu.classList.contains("open")) {
            menu.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
          }
        });
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && menu.classList.contains("open")) {
            menu.classList.remove("open");
            toggle.setAttribute("aria-expanded", "false");
          }
        });

        // Mount right after the actionsDiv (so both exist in DOM)
        const parent = actionsDiv.parentElement;              // .friend-item
        parent.style.position = parent.style.position || "relative"; // for absolute menu positioning
        actionsDiv.after(toggle, menu);
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
        const items = rowContainer.querySelectorAll(".friend-item"); // ← use new class
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