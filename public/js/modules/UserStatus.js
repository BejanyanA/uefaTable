import { API_BASE } from '../services/config.js';
import { langMap, currentLang } from '../modules/LanguageManager.js';
import { updateChatHeaderStatus, getCurrentFriendId } from "./Messages.js";

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

export function formatLastSeen(value) {
    const dateValue = value.includes("T")
        ? value
        : value.replace(" ", "T") + "Z";

    const date = new Date(dateValue);
    const now = new Date();

    const diffMinutes = Math.floor((now - date) / 60000);

    if (diffMinutes < 1) {
        return tr("just_now", "just now");
    }

    if (diffMinutes < 60) {
        return `${diffMinutes} ${tr("min_ago", "min ago")}`;
    }

    const diffHours = Math.floor(diffMinutes / 60);

    if (diffHours < 24) {
        return `${diffHours} ${tr("hour_ago", "h ago")}`;
    }

    return formatFullDateTime(date);
}

export function formatLastSeenDateTime(lastSeen) {
    const userTimeZone = getUserTimeZone();

    const dateValue = lastSeen.includes("T")
        ? lastSeen
        : lastSeen.replace(" ", "T") + "Z";

    const date = new Date(dateValue);
    const now = new Date();

    const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    if (isToday) {
        const time = new Intl.DateTimeFormat(undefined, {
            timeZone: userTimeZone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
        }).format(date);

        return `${langMap[currentLang]?.today_at || "today at"} ${time}`;
    }

    const localDate = new Date(
        date.toLocaleString("en-US", { timeZone: userTimeZone })
    );

    const day = String(localDate.getDate()).padStart(2, "0");
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const year = String(localDate.getFullYear()).slice(-2);

    const datePart = `${day}.${month}.${year}`;

    const timePart = new Intl.DateTimeFormat(undefined, {
        timeZone: userTimeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).format(date);

    return `${datePart} ${timePart}`;
}

export function getOnlineText() {
    return tr("online", "Online");
}

export function getOfflineText() {
    return tr("offline", "Offline");
}

export function getLastSeenText() {
    return tr("last_seen", "Last visit");
}

export function refreshPresenceTexts() {
    document
        .querySelectorAll(".conversation-item, .friend-chat-item")
        .forEach((item) => {
            const statusEl = item.querySelector(".conversation-status");
            if (!statusEl) return;

            const friendId = Number(item.dataset.friendId);
            const presence = getPresenceStatus(friendId);

            statusEl.textContent = presence.isOnline
                ? (langMap[currentLang]?.online || "Online")
                : presence.lastSeen
                    ? `${langMap[currentLang]?.last_seen || "Last visit"} ${formatLastSeen(presence.lastSeen)}`
                    : (langMap[currentLang]?.offline || "Offline");
        });

    const currentFriendIdValue = getCurrentFriendId();

    if (currentFriendIdValue) {
        const presence = getPresenceStatus(currentFriendIdValue);

        updateChatHeaderStatus(
            presence.isOnline,
            presence.lastSeen
        );
    }
}

export function getUserTimeZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
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
                status.classList.toggle("online-status", Boolean(isOnline));

                status.textContent = isOnline
                    ? getOnlineText()
                    : lastSeen
                        ? `${langMap[currentLang]?.last_seen || "Last visit"} ${formatLastSeen(lastSeen)}`
                        : getOfflineText();
            }
        });

    if (Number(userId) === Number(getCurrentFriendId())) {
        updateChatHeaderStatus(isOnline, lastSeen);
    }
}

function formatFullDateTime(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function tr(key, fallback) {
    return langMap[currentLang]?.[key] || fallback;
}