import { clearErrors } from '../utils/helper.js';
import { langMap, currentLang } from './LanguageManager.js';
import { apiPost } from '../services/api.js';

export const getFriends = {
    initGetAllFriends: async function () {
        try {
            const response = await apiPost("/friends", { showLoading: false });
            const container = document.getElementById("user-select");
            const friendError = document.getElementById("friendError");
            const translation = langMap[currentLang];

            clearErrors(["friendError"]);
            container.innerHTML = "";

            if (response.success && response.data?.friends?.length) {
                response.data.friends.forEach(friend => {
                    const label = document.createElement("label");
                    label.className = "friend-checkbox-checkbox";
                    label.innerHTML = `
                    <input type="checkbox" value="${friend.id}" />
                    <span class="friend-checkbox-name">${friend.username}</span> `;
                    container.appendChild(label);
                });
                friendError.textContent = ""; // ✅ optional cleanup
            } else {
                // 🛠 Fix: Use friendError instead of undeclared "message"
                const message = translation.no_friends_found || "No friends found.";
                friendError.textContent = message;

                const error = document.createElement("div");
                error.className = "friend-list-error";
                error.textContent = message;
                container.appendChild(error);
            }
        } catch (err) {
            const container = document.getElementById("user-select");
            container.innerHTML = `<div class="friend-list-error">Something went wrong while loading friends.</div>`;
            console.error("Error fetching friends:", err);
        }
    },

    initGetAllFriendsStatuses: async function () {
        try {
            const response = await apiPost("/all-users", { showLoading: false });
            const container = document.getElementById("user-select");
            const friendError = document.getElementById("friendError");
            const translation = langMap[currentLang];

            clearErrors(["friendError"]);
            container.innerHTML = "";

            if (response.success && response.data?.friends?.length) {
                response.data.friends.forEach(friend => {
                    const label = document.createElement("label");
                    label.className = "friend-checkbox-checkbox";
                    label.innerHTML = `
                    <input type="checkbox" value="${friend.id}" />
                    <span class="friend-checkbox-name">${friend.username}</span> `;
                    container.appendChild(label);
                });
                friendError.textContent = ""; // ✅ optional cleanup
            } else {
                // 🛠 Fix: Use friendError instead of undeclared "message"
                const message = translation.no_friends_found || "No friends found.";
                friendError.textContent = message;

                const error = document.createElement("div");
                error.className = "friend-list-error";
                error.textContent = message;
                container.appendChild(error);
            }
        } catch (err) {
            const container = document.getElementById("user-select");
            container.innerHTML = `<div class="friend-list-error">Something went wrong while loading friends.</div>`;
            console.error("Error fetching friends:", err);
        }
    }
};