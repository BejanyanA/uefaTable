import { langMap, currentLang } from './LanguageManager.js';
import { getFriends } from './GetFriends.js';
import { apiGet, apiPost } from '../services/api.js';
import { API_BASE } from '../services/config.js';
import { FriendManager } from './FriendManager.js';
import { showToast } from '../utils/toast.js';
import { logout } from '../modules/MeHomepage.js'
import { setHomeOptionsVisible, setCustomCompetitionVisible } from "./HomeOptions.js";
import { navigateTo } from "./router.js";

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
    };

    // Listen for custom events named 'friend_requests'
    // The BE's publishToUser sends: { type: "friend_requests", count: 0 }
    eventSource.onmessage = function (event) {

        try {
            const data = JSON.parse(event.data);

            const translation = langMap[currentLang];

            // Check if it's the notification count update we care about
            if (data.type === 'friend_requests' && typeof data.count === 'number') {
                updateNotificationBadge(data.count);
            }

            if (data.type === 'friend_status_update' && data.status === 'rejected') {
                showToast(translation.friend_request_rejected || "Friend Request Rejected", "error");

            }

            if (data.type === 'friend_status_update' && data.status === 'approved') {
                showToast(translation.friend_request_approved || "Friend Request Approved", "success");
            }

        } catch (e) {
            // This will catch non-JSON messages (like your initial 'ready' message)
            console.warn("Could not process generic message as JSON:", event.data, e);
        }
    };

}

function handleBellClick() {
  if (notificationBellEl.__bellBound) return;
  notificationBellEl.__bellBound = true;

  notificationBellEl.addEventListener("click", () => {
    if (currentUnreadCount === 0) return;

    markSeenIfUnread();

    // ✅ route only
    navigateTo("friends?tab=pending");
  });
}

