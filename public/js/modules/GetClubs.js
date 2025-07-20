import { clearErrors } from '../utils/helper.js';
import { langMap, currentLang } from './LanguageManager.js';
import { apiGet } from '../services/api.js';

export const getClubs = {
    initGetAllClubs: async function () {
        const container = document.getElementById("clubList");
        const clubError = document.getElementById("clubsError");
        const translation = langMap[currentLang];

        if (!container || !clubError) {
            console.warn("⛔ 'clubList' or 'clubsError' not found in the DOM.");
            return;
        }

        try {
            clearErrors(["clubError"]);
            container.innerHTML = "";
            clubError.textContent = "";

            const response = await apiGet("/clubs");

            if (response.success && response.data?.clubs?.length) {
                response.data.clubs.forEach(club => {
                    const label = document.createElement("label");
                    label.className = "club-checkbox-checkbox";
                    label.innerHTML = `
                        <input type="checkbox" value="${club.id}" />
                        <span class="club-checkbox-name">${club.club_name}</span>
                    `;
                    container.appendChild(label);
                });
            } else {
                const message = translation.no_clubs_found || "No clubs found.";
                clubError.textContent = message;

                const error = document.createElement("div");
                error.className = "clubs-list-error";
                error.textContent = message;
                container.appendChild(error);
            }
        } catch (err) {
            container.innerHTML = `<div class="clubs-list-error">Something went wrong while loading clubs.</div>`;
            console.error("❌ Error in getClubs.initGetAllClubs:", err);
        }
    }
};