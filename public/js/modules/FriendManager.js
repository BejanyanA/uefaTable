import { langMap, currentLang } from './LanguageManager.js';
import { getFriends } from './GetFriends.js';
import { apiGet, apiPost } from '../services/api.js';
import { showToast } from '../utils/toast.js';
import { markSeenIfUnread } from './NotificationManager.js';


const handleUserSearch = async (friendsSearchInput, resultsContainer, toggleSearchIcon) => {
  const username = friendsSearchInput.value.trim();
  const translation = langMap[currentLang];
  resultsContainer.innerHTML = ''; // Clear old results

  if (username.length === 0) {
    // Should not happen if called correctly, but good to handle
    toggleSearchIcon(false);
    return;
  }

  const loaderOff = { showLoading: false };

  try {
    const response = await apiPost("/search-user", { username: username }, loaderOff);

    // CONFIRMED SUCCESS CHECK: response.data.user
    if (response.success && response.data && response.data.user) {
      const userData = response.data.user;
      const { id, username: foundUsername, status } = userData;

      // --- DISPLAY LOGIC (omitted for brevity) ---

      // --- START OF DISPLAY LOGIC ---

      const translation = langMap[currentLang];

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

      const t = translation || {};

      // 4. Action Button (Will sit to the left of the Status Badge)
      if (status === "available") {
        const addButton = document.createElement("button");
        addButton.className = "action-add-friend";
        addButton.textContent = t.addFriend || "+ Add Friend";

        addButton.addEventListener('click', async () => {
          const reqResponse = await apiPost("/add-friend", { userId: id }, token);
          if (reqResponse.success) {
            // Update UI to pending after request is sent
            showToast(t.friend_request_success || "Successfully Sent", "success");
            addButton.remove();
            getFriends.initGetAllFriendsStatuses();
            handleUserSearch(friendsSearchInput, resultsContainer, toggleSearchIcon)
          } else {
            console.error("Failed to send friend request.");
          }
        });

        item.appendChild(addButton);
      } else {

        // 5. Status Badge (Always the last element, guaranteed to be on the far right)
        const statusBadge = document.createElement("span");
        statusBadge.className = `status-badge ${status}`;
        statusBadge.dataset.statusKey = status;
        const t = translation || {}; // Assuming translation is available here
        statusBadge.textContent = t[status] || status;

        item.appendChild(statusBadge);
      }
      resultsContainer.appendChild(item);

      // --- END OF DISPLAY LOGIC ---


      // 🎯 SUCCESSFUL SEARCH: Switch to X icon
      toggleSearchIcon(true);

    } else {
      const t = translation || {};
      const userNotFoundMsg = t.usersNotExist || "User not found.";
      resultsContainer.innerHTML = `<div class="search-result-item status-rejected">${userNotFoundMsg}</div>`;

      // FAILED SEARCH: Switch to X icon
      toggleSearchIcon(true);
    }

  } catch (error) {
    console.error("Search User API Error:", error);
    resultsContainer.innerHTML = `<div class="search-result-item status-rejected">Search failed. Please try again.</div>`;
    // 🎯 ERROR: Switch to X icon (since results are now present)
    toggleSearchIcon(true);
  }
};




export const FriendManager = {

  openFriends: async function () {
    const translation = langMap[currentLang];
    const section = document.getElementById("friendsContainer");
    section.innerHTML = ""; // Clear previous content
    section.style.display = "block";

    const loaderOff = { showLoading: false };

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
            document.getElementById("profileContainer").style.display = "none";
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

      section.appendChild(homeButton);


      document.getElementById("headerUsername").style.display = "block";
      document.getElementById("profileMenu").style.display = "block";
      document.getElementById("friendsContainer").style.display = "block";
      document.getElementById("profileContainer").style.display = "none";
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

      FriendManager.addFriends();

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

      // 🎯 NEW: Store confirmation timers for each friend ID
      const confirmationTimers = {};


      // Render list items (id, username, status)
      function renderFriendsList(list) {
        const t = (langMap[currentLang] || {});
        rowContainer.querySelectorAll(".friend-item").forEach(n => n.remove());

        // Clear any old timers when re-rendering
        Object.values(confirmationTimers).forEach(timer => clearTimeout(timer));

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
          actions.dataset.friendId = friend.id; // Store ID on the parent

          const mkBtn = (cls, labelKey, fallback) => {
            const b = document.createElement("button");
            b.className = cls;
            b.textContent = t[labelKey] || fallback;

            b.dataset.labelKey = labelKey;
            b.dataset.fallback = fallback;

            // helper: always resolve original label from CURRENT language
            const getOriginalText = (btn) => {
              const lk = btn.dataset.labelKey;
              const fb = btn.dataset.fallback;
              const tt = (langMap[currentLang] || {});
              return lk ? (tt[lk] ?? fb ?? btn.textContent) : btn.textContent;
            };

            const parts = cls.split('-');
            const actionType = parts.length > 1 ? parts[1] : '';

            b.addEventListener('click', async () => {

              if (!actionType) return;

              const friendId = friend.id;
              const currentT = (langMap[currentLang] || {});
              const originalText = currentT[labelKey] || fallback;
              const confirmWord = currentT.confirmQuestion || "Confirm ?";
              const confirmationText = `${confirmWord}`;

              if (confirmationTimers[friendId] === actionType) {
                clearTimeout(confirmationTimers[`timer-${friendId}`]);
                confirmationTimers[friendId] = null;

                // Execute the API action
                await handleFriendAction(friendId, actionType);

              } else {
                Object.keys(confirmationTimers).forEach(key => {
                  if (key === friendId && confirmationTimers[key]) {
                    clearTimeout(confirmationTimers[`timer-${key}`]);
                  }
                });

                b.textContent = confirmationText;
                b.classList.add('confirming-action');

                const resetAction = () => {
                  const resetT = (langMap[currentLang] || {});
                  const resetOriginalText = resetT[labelKey] || fallback;

                  b.textContent = resetOriginalText;
                  b.classList.remove('confirming-action');
                  confirmationTimers[friendId] = null;
                  confirmationTimers[`timer-${friendId}`] = null;
                };

                const timerId = setTimeout(resetAction, 2000);
                confirmationTimers[friendId] = actionType;
                confirmationTimers[`timer-${friendId}`] = timerId;
                confirmationTimers[`reset-${friendId}`] = resetAction;
              }
            });

            return b;
          };

          if (friend.status === "approved") {
            actions.append(
              mkBtn("action-delete", "delete", "Delete"),
              mkBtn("action-reject", "reject", "Reject")
            );
          } else if (friend.status === "pending") {

            // 🎯 NEW LOGIC: Only show Approve button if the request was NOT sent by me
            if (friend.byMe !== true) {
              actions.append(
                mkBtn("action-approve", "approve", "Approve"),
                mkBtn("action-reject", "reject", "Reject"),
              );
            }
            // Always show Delete for a pending request
            actions.append(
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
      } // end renderFriendsList

      // 🎯 MODIFIED: handleFriendAction is now the API executor
      async function handleFriendAction(friendId, actionType) {
        const token = localStorage.getItem("authToken");
        const endpoint = `/user-${actionType}`;

        try {
          const response = await apiPost(endpoint, { userId: friendId }, token);

          if (response.success) {

            // 1. Update State (friendsData)
            const newStatus = actionType === 'approve' ? 'approved' :
              actionType === 'reject' ? 'rejected' : null;

            if (newStatus || actionType === 'delete') {
              const index = friendsData.findIndex(f => f.id === friendId);
              if (index > -0) {
                if (actionType === 'delete') {
                  // Remove the friend completely for delete action
                  friendsData.splice(index, 1);
                } else if (newStatus) {
                  // Update the status for approve/reject actions
                  friendsData[index].status = newStatus;
                }
              }
            }

            // Re-render UI and show success toast
            getFriends.initGetAllFriendsStatuses();

            if (actionType === 'approve') {
              showToast(translation.friend_approved_success || "User successfully approved", "success");
            } else if (actionType === 'reject') {
              showToast(translation.friend_rejected_success || "User successfully rejected", "success");
            } else if (actionType === 'delete') {
              showToast(translation.friend_deleted_success || "User successfully deleted", "success");
            } else {
              showToast(translation.something_went_wrong || "Something went wrong");
            }

          } else {
            console.error(`🔴 API action failed for ${actionType}:`, response);
          }
        } catch (error) {
          console.error(`🔴 API Error during ${actionType}:`, error);
        }
      }

      function enhanceActionsForMobile(actionsDiv) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "friend-actions-menu-toggle";
        toggle.setAttribute("aria-haspopup", "true");
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = "&#8942;";

        const menu = document.createElement("div");
        menu.className = "friend-actions-menu";
        menu.setAttribute("role", "menu");
        menu.tabIndex = -1;

        const friendId = String(actionsDiv.dataset.friendId || "");

        const getConfirmText = () => {
          const t = (langMap[currentLang] || {});
          return t.confirmQuestion || "Confirm ?";
        };

        // resolve “original” label from CURRENT language using data-label-key/fallback
        const getOriginalText = (el) => {
          const lk = el.dataset.labelKey;
          const fb = el.dataset.fallback;
          const t = (langMap[currentLang] || {});
          return lk ? (t[lk] ?? fb ?? el.textContent) : el.textContent;
        };

        const originalButtons = Array.from(actionsDiv.querySelectorAll("button"));
        originalButtons.forEach((btn) => {
          // ensure desktop button carries label metadata (in case older buttons exist)
          if (!btn.dataset.labelKey) btn.dataset.labelKey = btn.getAttribute("data-label-key") || "";
          if (!btn.dataset.fallback) btn.dataset.fallback = btn.getAttribute("data-fallback") || "";

          const item = document.createElement("button");
          item.type = "button";
          item.className = `menu-item ${btn.className}`;
          item.setAttribute("role", "menuitem");

          // mirror metadata so mobile item can also resolve dynamically
          item.dataset.labelKey = btn.dataset.labelKey || "";
          item.dataset.fallback = btn.dataset.fallback || "";

          // initial render uses current language
          item.textContent = getOriginalText(item);

          const parts = btn.className.split("-");
          const actionType = parts.length > 1 ? parts[1] : "";

          item.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!actionType) return;

            if (confirmationTimers[friendId] === actionType) {
              if (confirmationTimers[`timer-${friendId}`]) {
                clearTimeout(confirmationTimers[`timer-${friendId}`]);
                confirmationTimers[`timer-${friendId}`] = null;
              }
              confirmationTimers[friendId] = null;

              // ✅ restore labels using CURRENT language
              const restore = getOriginalText(btn);
              const restoreItem = getOriginalText(item);
              btn.textContent = restore;
              item.textContent = restoreItem;
              btn.classList.remove("confirming-action");
              item.classList.remove("confirming-action");

              menu.classList.remove("open");
              toggle.setAttribute("aria-expanded", "false");

              await handleFriendAction(friendId, actionType);
              return;
            }

            // first click → confirming state (clear existing timer only for this friend)
            if (confirmationTimers[`timer-${friendId}`]) {
              clearTimeout(confirmationTimers[`timer-${friendId}`]);
              confirmationTimers[`timer-${friendId}`] = null;
            }

            // if some other action is armed, run its reset
            if (confirmationTimers[friendId] && confirmationTimers[friendId] !== actionType) {
              const prevReset = confirmationTimers[`reset-${friendId}`];
              if (typeof prevReset === "function") prevReset();
            }

            const confirmText = getConfirmText();
            btn.textContent = confirmText;
            item.textContent = confirmText;
            btn.classList.add("confirming-action");
            item.classList.add("confirming-action");

            const resetAction = () => {
              // ✅ recompute from CURRENT language at reset time
              btn.textContent = getOriginalText(btn);
              item.textContent = getOriginalText(item);
              btn.classList.remove("confirming-action");
              item.classList.remove("confirming-action");
              confirmationTimers[friendId] = null;
              confirmationTimers[`timer-${friendId}`] = null;
              confirmationTimers[`reset-${friendId}`] = null;
            };

            const timerId = setTimeout(resetAction, 2000);
            confirmationTimers[friendId] = actionType;
            confirmationTimers[`timer-${friendId}`] = timerId;
            confirmationTimers[`reset-${friendId}`] = resetAction;
          });

          menu.appendChild(item);
        });

        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          const isOpen = menu.classList.toggle("open");
          toggle.setAttribute("aria-expanded", String(isOpen));
          if (isOpen) menu.focus();
        });

        document.addEventListener("click", (e) => {
          if (!menu.contains(e.target) && e.target !== toggle) {
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

        actionsDiv.appendChild(toggle);
        actionsDiv.appendChild(menu);

        // Mount right after the actionsDiv (so both exist in DOM)
        const parent = actionsDiv.parentElement; 			// .friend-item
        parent.style.position = parent.style.position || "relative"; // for absolute menu positioning
        actionsDiv.after(toggle, menu);
      }



      function filterFriendsList(tab) {
        activeTab = tab;

        // buttons visual (mirror your tab logic)
        [friendsTabBtn, pendingTabBtn, rejectedTabBtn].forEach(b => {
          b.classList.remove(ACTIVE);
          b.classList.remove("active");
          b.disabled = false; // ← reset state each time
        });

        if (tab === "approved") friendsTabBtn.classList.add(ACTIVE);
        if (tab === "pending") pendingTabBtn.classList.add(ACTIVE);
        if (tab === "rejected") rejectedTabBtn.classList.add(ACTIVE);

        // ❌ disable the currently active tab (make unclickable)
        if (tab === "approved") friendsTabBtn.disabled = true;
        if (tab === "pending") pendingTabBtn.disabled = true;
        if (tab === "rejected") rejectedTabBtn.disabled = true;

        // Filter visibility
        const items = rowContainer.querySelectorAll(".friend-item");
        let visibleCount = 0;
        items.forEach(el => {
          if (!el.dataset.status) {
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

      // Show/hide per tab
      function showFriendsTab(tab) {
        // Only set active tab here if you want the filter logic to use it
        activeTab = tab;

        getFriends.initGetAllFriendsStatuses();

        filterFriendsList(tab);
      }

      // Click handlers — same pattern as your tabs
      [friendsTabBtn, pendingTabBtn, rejectedTabBtn].forEach(btn => {
        btn.addEventListener("click", () => {
          // This now triggers the fetch inside showFriendsTab
          showFriendsTab(btn.dataset.tab);
          if (btn === pendingTabBtn) {
            markSeenIfUnread();
          }
        });
      });

      // Hook for your fetcher:
      // 1) If your getFriends.initGetAllFriendsStatuses() can call this, we're done:
      window.__setFriendsStatuses = function (payload) {
        // expecting payload like: { friends: [ {id, username, status}, ... ] }
        const list = (payload && payload.friends) || [];
        friendsData = list;
        renderFriendsList(friendsData);

        // ✅ FIX: Use the filtering function instead of the fetching function
        filterFriendsList(activeTab);
      };

      // 2) Or, if your fetcher dispatches an event instead, we support it too:
      document.addEventListener("friends:statuses:loaded", (e) => {
        const detail = (e && e.detail) || {};
        const list = (detail && detail.friends) || [];
        friendsData = list;
        renderFriendsList(friendsData);

        // This part was already correct
        filterFriendsList(activeTab);
      });

      // Initialize the view (tabs visible immediately; content appears when data arrives)
      filterFriendsList(activeTab);

      // 2. Manually start the fetch (the callback, window.__setFriendsStatuses, will handle rendering)
      // We don't show a loading indicator here because the empty screen IS the loading screen for now.
      getFriends.initGetAllFriendsStatuses();
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
        // Prevent form submission if it's inside a form
        e.preventDefault();

        // Only run the action if there's text in the box
        if (friendsSearchInput.value.trim().length > 0) {

          // 🎯 The key change: We unconditionally call the search action.
          // The handleButtonAction function already knows that since 
          // Enter was pressed, it should run the search logic, 
          // NOT the clear logic (because the key pressed wasn't a mouse click).

          // We'll call the handleUserSearch directly, as handleButtonAction
          // is designed primarily for the mouse click event logic.

          // We use the direct function call that handles the API request:
          handleUserSearch(friendsSearchInput, resultsContainer, toggleSearchIcon);
        }
      }
    });

    // Initialize state (must be loop icon)
    toggleSearchIcon(false);
  },
};