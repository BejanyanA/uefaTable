import { langMap, currentLang } from './LanguageManager.js';
import { getFriends } from './GetFriends.js';
import { apiGet, apiPost } from '../services/api.js';
import { API_BASE } from '../services/config.js';
import { FriendManager } from './FriendManager.js';

const loaderOff = { showLoading: false };

// 1. References to DOM elements
const notificationBellEl = document.getElementById('notificationBell');
const notificationBadgeEl = document.getElementById('notificationBadge');

let eventSource = null; // To hold the SSE connection object
let currentUnreadCount = 0;

// You must export your apiPost function or ensure it's globally available
// import { apiGet, apiPost } from './api.js'; 

function triggerBellClickIfUnread() {
    // Only perform the click if the count is > 0
    if (currentUnreadCount > 0) {

        handleBellClick();
    }
}


/**
 * @param {number} count - The number of unread notifications.
 */
function updateNotificationBadge(count) {
    currentUnreadCount = parseInt(count, 10);

    if (currentUnreadCount > 0) {
        notificationBadgeEl.textContent = currentUnreadCount;
        notificationBadgeEl.style.display = 'block';
        notificationBadgeEl.classList.add('new-notifications');
        triggerBellClickIfUnread();
        // You might want to play a sound or trigger a small animation here
    } else {
        notificationBadgeEl.style.display = 'none';
        notificationBadgeEl.classList.remove('new-notifications');
    }
}

async function fetchAndDisplayCount() {

    try {
        // The BE returns a format like: { success: true, data: { pendingFriendRequests: count, seenAt } }
        const response = await apiGet("/notifications/count", loaderOff);

        if (response.success && response.data) {
            // Your BE field name is 'pendingFriendRequests' for the count
            updateNotificationBadge(response.data.requestsCount);
        }
    } catch (error) {
        console.error("Failed to fetch notification count:", error);
    }
}

/**
 * Handles the click event on the notification bell (to mark notifications as seen).
 */
export async function markSeenIfUnread() {
    // Check the global count variable managed by updateNotificationBadge
    if (currentUnreadCount === 0)
        return;

    try {
        // 1. Call the backend to mark seen
        const response = await apiPost("/notifications/mark-seen", {}, loaderOff);

        if (response.success) {
            // 2. Synchronize the count to 0 (This is fetchAndDisplayCount)
            await fetchAndDisplayCount();
        }
    } catch (error) {
        console.error("Failed to mark notifications as seen:", error);
    }

    updateNotificationBadge(0);
}


/**
 * Cleans up and hides the bell when the user logs out.
 */
export function cleanupNotifications() {
    // 1. Close the SSE connection
    if (eventSource) {
        eventSource.close();
        eventSource = null;
    }

    // 2. Hide the UI elements and remove listener
    if (notificationBellEl) {
        notificationBellEl.style.display = 'none';
        notificationBellEl.removeEventListener('click', handleBellClick);
    }
    updateNotificationBadge(0); // Clear the badge count
}

/**
 * 1. Initial REST call to get the current unread count.
 * 2. Starts the real-time SSE stream.
 */
export async function initNotifications() {
    const token = localStorage.getItem("authToken");
    if (!token) {
        cleanupNotifications();
        return;
    }

    // --- A. Initial Count Fetch ---
    // ⭐ Use the new reusable function
    await fetchAndDisplayCount();


    if (eventSource) {
        eventSource.close(); // Close existing connection if any
    }

    // The BE endpoint is /notifications/stream?t=<token>
    const streamUrl = `${API_BASE}/notifications/stream?t=${encodeURIComponent(token)}`;

    // Initialize the EventSource connection
    eventSource = new EventSource(streamUrl);


    // Listen for generic messages (sent by the server without an 'event' field)
    eventSource.onmessage = function (event) {
        // The BE logic isn't sending generic messages, but it's good practice.
        console.log("Generic SSE Message:", event.data);
    };

    // Listen for custom events named 'friend_requests'
    // The BE's publishToUser sends: { type: "friend_requests", count: 0 }
    eventSource.onmessage = function (event) {
        console.log("Generic SSE Message received:", event.data);

        // ⭐ ADD PROCESSING LOGIC HERE ⭐
        try {
            // Attempt to parse the data as JSON
            const data = JSON.parse(event.data);

            // Check if it's the notification count update we care about
            if (data.type === 'friend_requests' && typeof data.count === 'number') {
                updateNotificationBadge(data.count);
                console.log("Generic SSE processed and count updated:", data.count);
            }

        } catch (e) {
            // This will catch non-JSON messages (like your initial 'ready' message)
            console.warn("Could not process generic message as JSON:", event.data, e);
        }
    };

}

async function handleBellClick() {
    notificationBellEl.addEventListener("click", () => {

        if (currentUnreadCount === 0) {
            console.log("Notification bell click ignored: Count is zero.");
            return; // Stop here if there's nothing to do
        }

        markSeenIfUnread();

        const translation = langMap[currentLang];
        const section = document.getElementById("friendsContainer");
        section.innerHTML = ""; // Clear previous content
        section.style.display = "block";
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
        let activeTab = "pending"; // default to Friends

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
                    }
                } else {
                    showToast(translation.something_went_wrong, "error");
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
}

