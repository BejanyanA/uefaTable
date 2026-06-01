import { API_BASE } from '../services/config.js';
import { updateChatHeaderStatus, getCurrentFriendId, formatLastSeenDateTime } from "./Messages.js";

let presenceSocket = null;
let presencePingTimer = null;

const presenceCache = new Map();

export function connectPresenceSocket() {

    const token = localStorage.getItem("authToken");
    if (!token || presenceSocket) return;

    const apiUrl = new URL(API_BASE);
    const wsProtocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
    const wsBase = `${wsProtocol}//${apiUrl.host}`;

    presenceSocket = new WebSocket(`${wsBase}/presence-socket?token=${token}`);

    presenceSocket.onopen = () => {
        presencePingTimer = setInterval(() => {
            if (presenceSocket?.readyState === WebSocket.OPEN) {
                presenceSocket.send(JSON.stringify({ type: "ping" }));
            }
        }, 20000);
    };

    presenceSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "presence_status") {
            updateConversationUserStatus(data.userId, data.isOnline, data.lastSeen);
            return;
        }

        if (data.type === "presence_statuses") {
            data.users.forEach((user) => {
                updateConversationUserStatus(user.userId, user.isOnline, user.lastSeen);
            });
        }
    };

    presenceSocket.onclose = () => {
        clearInterval(presencePingTimer);
        presencePingTimer = null;
        presenceSocket = null;

        if (localStorage.getItem("authToken")) {
            setTimeout(connectPresenceSocket, 2000);
        }
    };
}

export function disconnectPresenceSocket() {
    if (presencePingTimer) {
        clearInterval(presencePingTimer);
        presencePingTimer = null;
    }

    if (presenceSocket) {
        presenceSocket.onclose = null;
        presenceSocket.close();
        presenceSocket = null;
    }
}

export function requestPresenceStatuses(friendIds = []) {
    if (!presenceSocket || presenceSocket.readyState !== WebSocket.OPEN) return;

    presenceSocket.send(JSON.stringify({
        type: "get_statuses",
        friendIds
    }));
}

export function getPresenceStatus(userId) {
    return presenceCache.get(Number(userId)) || {
        isOnline: false,
        lastSeen: null
    };
}

function updateConversationUserStatus(userId, isOnline, lastSeen) {
    presenceCache.set(Number(userId), {
        isOnline: Boolean(isOnline),
        lastSeen: lastSeen || null
    });

    document
        .querySelectorAll(`[data-friend-id="${userId}"]`)
        .forEach((item) => {
            const dot = item.querySelector(".online-dot");
            const status = item.querySelector(".conversation-status");

            if (dot) {
                dot.classList.toggle("online", Boolean(isOnline));
                dot.classList.toggle("offline", !Boolean(isOnline));
            }

            if (status) {
                status.textContent = isOnline
                    ? "Online"
                    : lastSeen
                        ? `Last seen ${formatLastSeenDateTime(lastSeen)}`
                        : "Offline";
            }
        });

    if (Number(userId) === Number(getCurrentFriendId())) {
        updateChatHeaderStatus(isOnline, lastSeen);
    }
}

export function formatLastSeen(value) {
    const dateValue = value.includes("T")
        ? value
        : value.replace(" ", "T") + "Z";

    const date = new Date(dateValue);
    const now = new Date();

    const diffMinutes = Math.floor((now - date) / 60000);

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
}