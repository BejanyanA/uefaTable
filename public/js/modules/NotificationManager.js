// NotificationManager.js

// 1. References to DOM elements (Assumes they exist in index.html)
const notificationBellEl = document.getElementById('notificationBell');
const notificationBadgeEl = document.getElementById('notificationBadge');
const userInteractionsEl = document.querySelector('.user-interactions'); // Use this to control bell visibility

// Assuming apiGet and showToast are available globally or imported here
// import { apiGet } from './api.js'; 

let isBellInitialized = false; // Flag to prevent multiple initializations

/**
 * Updates the notification badge count and visibility.
 * @param {number} count - The number of unread notifications.
 */
export function updateNotificationBadge(count) {
    const unreadCount = parseInt(count, 10);

    if (unreadCount > 0) {
        notificationBadgeEl.textContent = unreadCount;
        notificationBadgeEl.style.display = 'block';
        notificationBadgeEl.classList.add('new-notifications');
    } else {
        notificationBadgeEl.style.display = 'none';
        notificationBadgeEl.classList.remove('new-notifications');
    }
}

/**
 * Fetches the current unread count from the server.
 */

const MOCK_UNREAD_COUNT = 5;
export function fetchNotificationCount() {
    // We prevent the actual async API call for now.
    // const token = localStorage.getItem("authToken");
    // if (!token) return;

    // // Simulate network delay if desired
    // setTimeout(() => {

    // --- MOCK API RESPONSE ---
    const response = {
        success: true,
        unreadCount: MOCK_UNREAD_COUNT // ⭐ Use the hardcoded value
    };

    if (response.success) {
        updateNotificationBadge(response.unreadCount);
    }

    // }, 500); // Simulate 500ms delay

    // If you plan to use setInterval later, keep the interval logic in initNotifications

}

/**
 * Handles the click event on the notification bell.
 */
function handleBellClick() {
    // 1. Placeholder for opening a dropdown/modal
    console.log("Notification bell clicked. Opening dropdown...");

    // 2. Logic to mark notifications as read (optional, can be done on dropdown close)
    // markAllAsRead(); 
}

/**
 * Initializes the notification bell functionality.
 * This should be called once when the user logs in.
 */
export function initNotifications() {
    if (isBellInitialized) return;

    // Show the bell icon in the header
    if (notificationBellEl) {
        notificationBellEl.style.display = 'flex'; // Use flex if the badge is inline
        notificationBellEl.addEventListener('click', handleBellClick);
    }

    // Start fetching the count immediately
    fetchNotificationCount();

    // Set up polling (e.g., fetch the count every 60 seconds)
    setInterval(fetchNotificationCount, 60000);

    isBellInitialized = true;
}

/**
 * Cleans up and hides the bell when the user logs out.
 */
export function cleanupNotifications() {
    if (notificationBellEl) {
        notificationBellEl.style.display = 'none';
        notificationBellEl.removeEventListener('click', handleBellClick);
    }
    updateNotificationBadge(0); // Clear the badge
    isBellInitialized = false;
    // You may also need to clear the setInterval if you stored the timer ID
}