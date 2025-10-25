import { apiGet, apiPost } from '../services/api.js';
import { API_BASE } from '../services/config.js';

// 1. References to DOM elements
const notificationBellEl = document.getElementById('notificationBell');
const notificationBadgeEl = document.getElementById('notificationBadge');

let eventSource = null; // To hold the SSE connection object
let currentUnreadCount = 0;

// You must export your apiPost function or ensure it's globally available
// import { apiGet, apiPost } from './api.js'; 


/**
 * @param {number} count - The number of unread notifications.
 */
function updateNotificationBadge(count) {
    currentUnreadCount = parseInt(count, 10);

    if (currentUnreadCount > 0) {
        notificationBadgeEl.textContent = currentUnreadCount;
        notificationBadgeEl.style.display = 'block';
        notificationBadgeEl.classList.add('new-notifications');
        // You might want to play a sound or trigger a small animation here
    } else {
        notificationBadgeEl.style.display = 'none';
        notificationBadgeEl.classList.remove('new-notifications');
    }
}

async function fetchAndDisplayCount() {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    try {
        // The BE returns a format like: { success: true, data: { pendingFriendRequests: count, seenAt } }
        const response = await apiGet("/notifications/count", token);

        if (response.success && response.data) {
            // Your BE field name is 'pendingFriendRequests' for the count
            updateNotificationBadge(response.data.pendingFriendRequests);
        }
    } catch (error) {
        console.error("Failed to fetch notification count:", error);
    }
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
    // Handle errors (automatic reconnect happens by default)
    eventSource.onerror = function (error) {
        console.error("SSE Error occurred. Attempting to reconnect...", error);
    };

    // Show the bell icon
    if (notificationBellEl) {
        notificationBellEl.style.display = 'flex';
        notificationBellEl.addEventListener('click', handleBellClick);
    }
}

/**
 * Handles the click event on the notification bell (to mark notifications as seen).
 */
async function handleBellClick() {
    if (currentUnreadCount === 0) return;

    const token = localStorage.getItem("authToken");
    if (!token) return;

    try {
        const response = await apiPost("/notifications/mark-seen", {}, token);

        if (response.success) {
            console.log("Notifications marked as seen. Re-fetching count...");

            // ⭐ CRITICAL CHANGE: Call the count endpoint again for synchronization
            await fetchAndDisplayCount();
        }
    } catch (error) {
        console.error("Failed to mark notifications as seen:", error);
    }
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