import { clearErrors } from '../utils/helper.js';
import { langMap, currentLang } from './LanguageManager.js';
import { apiGet, apiPost } from '../services/api.js';

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
    },


    initSearchClubs: function () {
        const searchInput = document.getElementById("clubSearch");
        const container = document.getElementById("clubList");
        const clubCount = document.getElementById("clubCount");
        const clubError = document.getElementById("clubsError");
        const translation = langMap[currentLang];

        if (!searchInput || !container || !clubCount || !clubError) {
            console.warn("⛔ Required elements not found for search.");
            return;
        }

        const selectedClubIds = new Set(); // ✅ Track selected clubs
        let timeout = null;

        searchInput.addEventListener("input", () => {
            const search = searchInput.value.trim();

            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                try {
                    container.innerHTML = "";
                    clubError.textContent = "";
                    clubCount.textContent = `${translation.selectedCount} (${selectedClubIds.size})`;

                    let response;
                    if (!search) {
                        response = await apiGet("/clubs", { showLoading: false });
                    } else {
                        response = await apiPost("/search-clubs", { search }, { showLoading: false });
                    }

                    if (response.success && response.data?.clubs?.length) {
                        renderClubList(response.data.clubs, container, clubCount, translation);
                    } else {
                        const message = translation.no_clubs_found || "No clubs found.";
                        const error = document.createElement("div");
                        error.className = "clubs-list-error";
                        error.textContent = message;
                        container.appendChild(error);
                    }

                } catch (err) {
                    container.innerHTML = `<div class="clubs-list-error">Something went wrong during search.</div>`;
                    console.error("❌ Error in getClubs.initSearchClubs:", err);
                }
            }, 500);
        });

        // ✅ Internal reusable renderer with selection tracking
        function renderClubList(clubs, container, countEl, translation) {
            container.innerHTML = "";

            clubs.forEach(club => {
                const label = document.createElement("label");
                label.className = "club-checkbox-checkbox";
                label.innerHTML = `
        <input type="checkbox" class="club-checkbox" value="${club.id}" id="club-${club.id}" />
        <span class="club-checkbox-name">${club.club_name}</span>
      `;
                container.appendChild(label);

                const checkbox = label.querySelector("input");

                // ✅ Restore previous selection
                if (selectedClubIds.has(club.id)) {
                    checkbox.checked = true;
                }

                // ✅ Track new changes
                checkbox.addEventListener("change", () => {
                    if (checkbox.checked) {
                        selectedClubIds.add(club.id);
                    } else {
                        selectedClubIds.delete(club.id);
                    }

                    countEl.textContent = `${translation.selectedCount} (${selectedClubIds.size})`;
                });
            });

            // ✅ Update count after rendering
            countEl.textContent = `${translation.selectedCount} (${selectedClubIds.size})`;
        }
    }
}
