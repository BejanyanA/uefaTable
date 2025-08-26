import { clearErrors } from '../utils/helper.js';
import { langMap, currentLang } from './LanguageManager.js';
import { apiGet, apiPost } from '../services/api.js';

let _clubsSearchAbort = null;
let _clubsDebounce = null;

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


    initSearchClubs(root = document) {
        // mark mode so only clubs reacts
        const host = root.getElementById ? root : document;
        const modal = host.getElementById("tableModal") || host;
        modal.dataset.searchType = "clubs";

        // teardown previous clubs listener (if any)
        if (_clubsSearchAbort) { _clubsSearchAbort.abort(); _clubsSearchAbort = null; }
        if (_clubsDebounce) { clearTimeout(_clubsDebounce); _clubsDebounce = null; }

        const ac = new AbortController();
        _clubsSearchAbort = ac;
        const { signal } = ac;

        const searchInput = root.querySelector("#clubSearch");         // shared input
        const container = root.querySelector("#clubList");
        const countEl = root.querySelector("#clubCount");
        const errorEl = root.querySelector("#clubsError");
        const translation = langMap[currentLang];

        if (!searchInput || !container || !countEl || !errorEl) {
            console.warn("⛔ Required elements not found for club search.");
            return;
        }

        const selectedIds = new Set();

        async function doSearch() {
            // ignore if another mode took over
            if (modal.dataset.searchType !== "clubs") return;

            try {
                container.querySelectorAll(".club-checkbox")?.forEach(cb => {
                    const id = parseInt(cb.value, 10);
                    if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
                });

                container.innerHTML = "";
                errorEl.textContent = "";
                countEl.textContent = `${translation.selectedCount} (${selectedIds.size})`;

                const term = searchInput.value.trim();
                const resp = term
                    ? await apiPost("/search-clubs", { search: term }, { showLoading: false })
                    : await apiGet("/clubs", { showLoading: false });

                const clubs = resp?.data?.clubs ?? [];
                if (resp?.success && clubs.length) {
                    clubs.forEach(club => {
                        const label = document.createElement("label");
                        label.className = "club-checkbox-checkbox";
                        label.innerHTML = `
              <input type="checkbox" class="club-checkbox" value="${club.id}" id="club-${club.id}" />
              <span class="club-checkbox-name">${club.club_name}</span>
            `;
                        container.appendChild(label);

                        const cb = label.querySelector("input");
                        if (selectedIds.has(club.id)) cb.checked = true;
                        cb.addEventListener("change", () => {
                            if (modal.dataset.searchType !== "clubs") return; // guard
                            if (cb.checked) selectedIds.add(club.id); else selectedIds.delete(club.id);
                            countEl.textContent = `${translation.selectedCount} (${selectedIds.size})`;
                        }, { signal });
                    });
                    countEl.textContent = `${translation.selectedCount} (${selectedIds.size})`;
                    // } else {
                    //     const message = translation.no_clubs_found || "No clubs found.";
                    //     const err = document.createElement("div");
                    //     err.className = "clubs-list-error";
                    //     err.textContent = message;
                    //     container.appendChild(err);
                }
            } catch (e) {
                const message = translation.no_clubs_found || "No clubs found.";
                const err = document.createElement("div");
                err.className = "clubs-list-error";
                err.textContent = message;
                container.appendChild(err);
            }
        }

        searchInput.addEventListener("input", () => {
            if (modal.dataset.searchType !== "clubs") return; // guard
            if (_clubsDebounce) clearTimeout(_clubsDebounce);
            _clubsDebounce = setTimeout(doSearch, 500);
        }, { signal });

        // initial fill
        doSearch();
    },

    teardownSearch() {
        if (_clubsSearchAbort) { _clubsSearchAbort.abort(); _clubsSearchAbort = null; }
        if (_clubsDebounce) { clearTimeout(_clubsDebounce); _clubsDebounce = null; }
    }
}
