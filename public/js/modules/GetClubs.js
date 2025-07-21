import { clearErrors } from '../utils/helper.js';
import { langMap, currentLang } from './LanguageManager.js';
import { apiGet } from '../services/api.js';

export const getClubs = {
    initGetAllClubs: async function () {
        const container = document.getElementById("clubList");
        const clubError = document.getElementById("clubsError");
        const clubCount = document.getElementById("clubCount");
        const translation = langMap[currentLang];

        if (!container || !clubError || !clubCount) {
            console.warn("⛔ Required elements not found in the DOM.");
            return;
        }

        try {
            clearErrors(["clubError"]);
            container.innerHTML = "";
            clubError.textContent = "";
            clubCount.textContent = "";
            clubCount.textContent = `${translation.selectedCount} (0)`;

            const response = await apiGet("/clubs");

            if (response.success && response.data?.clubs?.length) {
                response.data.clubs.forEach(club => {
                    const label = document.createElement("label");
                    label.className = "club-checkbox-checkbox";
                    label.innerHTML = `
                        <input type="checkbox" class="club-checkbox" value="${club.id}" />
                        <span class="club-checkbox-name">${club.club_name}</span>
                    `;
                    container.appendChild(label);
                });

                // Update selected count on change
                container.querySelectorAll(".club-checkbox").forEach(cb => {
                    cb.addEventListener("change", () => {
                        const selected = container.querySelectorAll(".club-checkbox:checked");
                        const selectedCount = selected.length;
                        clubCount.textContent = `${translation.selectedCount}  (${selectedCount})`
                    });
                });

            } else {
                const message = translation.no_clubs_found || "No clubs found.";
                // clubError.textContent = message;

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