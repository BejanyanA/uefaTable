import { setError, clearErrors } from '../utils/helper.js';
import { apiGet } from '../services/api.js';

export const getFriends = {
    initGetAllFriends: async function () {
        try {
            const response = await apiGet("/friends");
            const container = document.getElementById("user-select");
            container.innerHTML = "";

            if (response.success && response.data?.friends?.length) {
                response.data.friends.forEach(friend => {
                    const label = document.createElement("label");
                    label.innerHTML = `
      <input type="checkbox" value="${friend.id}"> ${friend.username}
    `;
                    container.appendChild(label);
                });
            } else {
                const message =
                    response.message || "No friends found.";

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