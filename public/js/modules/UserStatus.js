import { langMap, currentLang } from './LanguageManager.js';
import { getFriends } from './GetFriends.js';
import { apiGet, apiPost } from '../services/api.js';
import { API_BASE } from '../services/config.js';
import { FriendManager } from './FriendManager.js';
import { showToast } from '../utils/toast.js';
import { logout } from './MeHomepage.js'
import { setHomeOptionsVisible, setCustomCompetitionVisible } from "./HomeOptions.js";

let presenceSocket = null;
let presencePingTimer = null;

export function connectPresenceSocket() {
    console.log("CONNECTING PRESENCE SOCKET");
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
        }, 1000);
    };

    presenceSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "presence_status") {
            updateConversationUserStatus(
                data.userId,
                data.isOnline,
                data.lastSeen
            );
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

function updateConversationUserStatus(userId, isOnline, lastSeen) {
  document
    .querySelectorAll(`.conversation-item[data-friend-id="${userId}"]`)
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
            ? `Last seen ${formatLastSeen(lastSeen)}`
            : "Offline";
      }
    });
}

function formatLastSeen(value) {
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