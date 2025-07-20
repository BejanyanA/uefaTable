import { clearErrors } from '../utils/helper.js';
import { langMap, currentLang } from './LanguageManager.js';
import { apiGet } from '../services/api.js';

export const getFriends = {
    initGetAllFriends: async function () {
        try {
            const response = await apiGet("/friends");
            const container = document.getElementById("user-select");
            const friendError = document.getElementById("friendError");
            const translation = langMap[currentLang];

            clearErrors(["friendError"]);
            container.innerHTML = "";

            if (response.success && response.data?.friends?.length) {
                response.data.friends.forEach(friend => {
                    const label = document.createElement("label");
                    label.className = "checkbox-checkbox";
                    label.innerHTML = `
                    <input type="checkbox" value="${friend.id}" />
                    <span class="checkbox-name">${friend.username}</span> `;
                    container.appendChild(label);
                });
                friendError.textContent = ""; // ✅ optional cleanup
            } else {
                // 🛠 Fix: Use friendError instead of undeclared "message"
                const message = translation.no_friends_found || "No friends found.";
                friendError.textContent = message;

                const error = document.createElement("div");
                error.className = "error-message";
                error.textContent = message;
                container.appendChild(error);
            }
        } catch (err) {
            const container = document.getElementById("user-select");
            container.innerHTML = `<div class="error-message">Something went wrong while loading friends.</div>`;
            console.error("Error fetching friends:", err);
        }
    }
};