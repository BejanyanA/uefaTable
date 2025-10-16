import { langMap, currentLang } from './LanguageManager.js';
import { getFriends } from './GetFriends.js';
import { apiGet, apiPost } from '../services/api.js';


const handleUserSearch = async (friendsSearchInput, resultsContainer, toggleSearchIcon) => {
  const username = friendsSearchInput.value.trim();

  resultsContainer.innerHTML = ''; // Clear old results

  if (username.length === 0) {
    // Should not happen if called correctly, but good to handle
    toggleSearchIcon(false);
    return;
  }

  try {
    const token = localStorage.getItem("authToken");
    const response = await apiPost("/search-user", { username: username }, token);

    // CONFIRMED SUCCESS CHECK: response.data.user
    if (response.success && response.data && response.data.user) {
      const userData = response.data.user;
      const { id, username: foundUsername, status } = userData;

      // --- DISPLAY LOGIC (omitted for brevity) ---

      // --- START OF DISPLAY LOGIC ---

      const item = document.createElement("div");
      item.className = "search-result-item";
      item.dataset.userId = id;

      // 2. Username (Far Left)
      const nameDisplay = document.createElement("span");
      nameDisplay.className = "result-username";
      nameDisplay.textContent = foundUsername;
      item.appendChild(nameDisplay);

      // 3. Spacer (Takes up all remaining space to push elements to the right)
      const spacer = document.createElement("div");
      spacer.style.flexGrow = 1;
      item.appendChild(spacer);

      // 4. Action Button (Will sit to the left of the Status Badge)
      if (status === "available") {
        const addButton = document.createElement("button");
        addButton.className = "action-add-friend";
        addButton.textContent = "Add Friend";

        addButton.addEventListener('click', async () => {
          const reqResponse = await apiPost("/friends/request", { targetUserId: id }, token);
          if (reqResponse.success) {
            // Update UI to pending after request is sent
            statusBadge.textContent = 'pending';
            statusBadge.className = 'status-badge pending';
            addButton.remove();
          } else {
            console.error("Failed to send friend request.");
          }
        });

        item.appendChild(addButton);
      } else {

        // 5. Status Badge (Always the last element, guaranteed to be on the far right)
        const statusBadge = document.createElement("span");
        statusBadge.className = `status-badge ${status}`;
        statusBadge.textContent = status;
        item.appendChild(statusBadge);


      }
      resultsContainer.appendChild(item);

      // --- END OF DISPLAY LOGIC ---


      // 🎯 SUCCESSFUL SEARCH: Switch to X icon
      toggleSearchIcon(true);

    } else {
      // Handle user not found or other errors
      resultsContainer.innerHTML = `<div class="search-result-item status-rejected">User "${username}" not found.</div>`;
      // 🎯 FAILED SEARCH: Switch to X icon (since results are now present)
      toggleSearchIcon(true);
    }

  } catch (error) {
    console.error("Search User API Error:", error);
    resultsContainer.innerHTML = `<div class="search-result-item status-rejected">Search failed. Please try again.</div>`;
    // 🎯 ERROR: Switch to X icon (since results are now present)
    toggleSearchIcon(true);
  }
};




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
      const translation = langMap[currentLang];
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
      tabsHeader.className = "tab-switcher status-tabs-container";
      tabsHeader.id = "friendsStatusesContainer";

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

      ProfileManager.addFriends();

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
        const t = (langMap[currentLang] || {});
        rowContainer.querySelectorAll(".friend-item").forEach(n => n.remove());

        (list || []).forEach(friend => {
          const item = document.createElement("div");
          item.className = `friend-item status-${friend.status} friends-row-item friend-box`;
          item.dataset.status = friend.status;

          // name
          const name = document.createElement("span");
          name.className = "friend-name";
          name.textContent = friend.username;
          item.appendChild(name);

          // actions
          const actions = document.createElement("div");
          actions.className = "friend-actions";

          const mkBtn = (cls, labelKey, fallback) => {
            const b = document.createElement("button");
            b.className = cls;
            b.textContent = t[labelKey] || fallback;
            return b;
          };

          if (friend.status === "approved") {
            actions.append(
              mkBtn("action-delete", "delete", "Delete"),
              mkBtn("action-reject", "reject", "Reject")
            );
          } else if (friend.status === "pending") {
            actions.append(
              mkBtn("action-approve", "approve", "Approve"),
              mkBtn("action-reject", "reject", "Reject"),
              mkBtn("action-delete", "delete", "Delete")
            );
          } else if (friend.status === "rejected") {
            actions.append(
              mkBtn("action-delete", "delete", "Delete")
            );
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
          item.className = `menu-item ${btn.className}`; // preserve your action-* classes
          item.textContent = btn.textContent;
          item.setAttribute("role", "menuitem");

          // ✅ Add proper ID based on class
          if (btn.classList.contains("action-delete")) {
            item.id = "delete";
          } else if (btn.classList.contains("action-approve")) {
            item.id = "approve";
          } else if (btn.classList.contains("action-reject")) {
            item.id = "reject";
          }

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


  addFriends: async function () {
    const translation = langMap[currentLang];
    const mainContainer = document.getElementById("friendsContainer");

    // --- 1. ELEMENT CREATION (Remains the same) ---
    const friendSearch = document.createElement("div");
    friendSearch.className = "add-friend-bar";
    friendSearch.id = "friendsSearchBar";

    const friendsSearchInput = document.createElement("input");
    friendsSearchInput.className = "add-friend-input";
    friendsSearchInput.type = "text";
    friendsSearchInput.id = "friendsSearchInput";
    friendsSearchInput.placeholder = translation.friendsSearchPlaceholder || "Search or Enter Username...";

    const friendsSearchBtn = document.createElement("button");
    friendsSearchBtn.className = "add-friend-button";
    friendsSearchBtn.id = "searchUserButton";
    friendsSearchBtn.type = "button";

    const searchIcon = document.createElement("span");
    searchIcon.className = "search-icon search-loop-icon";
    searchIcon.textContent = "\uD83D\uDD0E";

    const clearIcon = document.createElement("span");
    clearIcon.className = "search-icon search-clear-icon hidden-icon";
    clearIcon.textContent = "\u2715";

    friendsSearchBtn.appendChild(searchIcon);
    friendsSearchBtn.appendChild(clearIcon);

    friendSearch.appendChild(friendsSearchInput);
    friendSearch.appendChild(friendsSearchBtn);

    const resultsContainer = document.createElement("div");
    resultsContainer.id = "searchResultsContainer";
    resultsContainer.className = "add-friend-bar ";

    // --- 2. APPENDING ELEMENTS (Remains the same) ---
    if (mainContainer) {
      const nextElement = document.getElementById("friendsRow");
      if (nextElement) {
        mainContainer.insertBefore(friendSearch, nextElement);
        mainContainer.insertBefore(resultsContainer, nextElement);
      } else {
        mainContainer.appendChild(friendSearch);
        mainContainer.appendChild(resultsContainer);
      }
    }

    // --- 3. ICON TOGGLE LOGIC (Remains the same helper) ---
    const toggleSearchIcon = (hasContent) => {
      if (hasContent) {
        searchIcon.classList.add('hidden-icon');
        clearIcon.classList.remove('hidden-icon');
      } else {
        searchIcon.classList.remove('hidden-icon');
        clearIcon.classList.add('hidden-icon');
      }
    };

    // --- 4. EVENT HANDLER LOGIC (Modified to ONLY run search/clear on click/enter) ---

    const handleButtonAction = (e) => {
      e.preventDefault();
      const isClearAction = !clearIcon.classList.contains('hidden-icon');

      if (isClearAction) {
        // --- CLEAR ACTION (X icon clicked) ---
        friendsSearchInput.value = '';
        resultsContainer.innerHTML = '';
        friendsSearchInput.focus();
        toggleSearchIcon(false); // Switch to LOOP icon
      } else {
        // --- SEARCH ACTION (Loop icon clicked) ---
        if (friendsSearchInput.value.trim().length > 0) {
          handleUserSearch(friendsSearchInput, resultsContainer, toggleSearchIcon);
          // NOTE: toggleSearchIcon(true) is now called INSIDE handleUserSearch
        }
      }
    };

    // --- 5. EVENT LISTENERS ---

    // ❌ REMOVED: Listener for 'input' event (This is what caused the premature switch)

    // Listener for click on the button
    friendsSearchBtn.addEventListener('click', handleButtonAction);

    // Listener for Enter key
    friendsSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (friendsSearchInput.value.trim().length > 0) {
          handleButtonAction(e);
        }
      }
    });

    // Initialize state (must be loop icon)
    toggleSearchIcon(false);
  },
};