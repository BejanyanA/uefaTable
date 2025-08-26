import { clearErrors } from '../utils/helper.js';
import { langMap, currentLang } from './LanguageManager.js';
import { apiGet, apiPost } from '../services/api.js';

let _europeCountriesSearchAbort = null;
let _europeCountriesDebounce = null;

export const getEuropeCountries = {
    initGetEuropeCountries: async function () {
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

            const response = await apiGet("/europe-countries");

            if (response.success && response.data?.countries?.length) {
                response.data.countries.forEach(country => {
                    const label = document.createElement("label");
                    label.className = "club-checkbox-checkbox";
                    label.innerHTML = `
                        <input type="checkbox" class="club-checkbox" value="${country.id}" />
                        <span class="club-checkbox-name">${country.country_name}</span>
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
                const message = translation.no_countries_found || "No clubs found.";
                // clubError.textContent = message;

                const error = document.createElement("div");
                error.className = "clubs-list-error";
                error.textContent = message;
                container.appendChild(error);
            }
        } catch (err) {
            container.innerHTML = `<div class="clubs-list-error">Something went wrong while loading clubs.</div>`;
            console.error("❌ Error in getCountries.initGetAllCountries:", err);
        }
    },


    initSearchEuropeCountries(root = document) {
        // mark mode so only countries reacts
        const host = root.getElementById ? root : document;
        const modal = host.getElementById("tableModal") || host;
        modal.dataset.searchType = "countries";

        // teardown previous countries listener (if any)
        if (_europeCountriesSearchAbort) { _europeCountriesSearchAbort.abort(); _europeCountriesSearchAbort = null; }
        if (_europeCountriesDebounce) { clearTimeout(_europeCountriesDebounce); _europeCountriesDebounce = null; }

        const ac = new AbortController();
        _europeCountriesSearchAbort = ac;
        const { signal } = ac;

        // same shared elements as clubs (you said they’re the same)
        const searchInput = root.querySelector("#clubSearch");
        const container = root.querySelector("#clubList");
        const countEl = root.querySelector("#clubCount");
        const errorEl = root.querySelector("#clubsError");
        const translation = langMap[currentLang];

        if (!searchInput || !container || !countEl || !errorEl) {
            console.warn("⛔ Required elements not found for country search.");
            return;
        }

        const selectedIds = new Set();

        function renderWorldCountryList(countries) {
            container.innerHTML = "";

            countries.forEach(country => {
                const label = document.createElement("label");
                label.className = "club-checkbox-checkbox";
                label.innerHTML = `
          <input type="checkbox" class="club-checkbox" value="${country.id}" id="country-${country.id}" />
          <span class="club-checkbox-name">${country.country_name}</span>
        `;
                container.appendChild(label);

                const checkbox = label.querySelector("input");

                if (selectedIds.has(country.id)) checkbox.checked = true;

                checkbox.addEventListener("change", () => {
                    if (modal.dataset.searchType !== "countries") return; // guard
                    if (checkbox.checked) selectedIds.add(country.id);
                    else selectedIds.delete(country.id);
                    countEl.textContent = `${translation.selectedCount} (${selectedIds.size})`;
                }, { signal });
            });

            countEl.textContent = `${translation.selectedCount} (${selectedIds.size})`;
        }

        async function doSearch() {
            // ignore if another mode took over
            if (modal.dataset.searchType !== "countries") return;

            try {
                container.querySelectorAll(".club-checkbox")?.forEach(cb => {
                    const id = parseInt(cb.value, 10);
                    if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
                });

                container.innerHTML = "";
                errorEl.textContent = "";
                countEl.textContent = `${translation.selectedCount} (${selectedIds.size})`;

                const term = searchInput.value.trim();
                const response = term
                    ? await apiPost("/search-europe-countries", { search: term }, { showLoading: false })
                    : await apiGet("/europe-countries", { showLoading: false });

                const countries = response?.data?.countries ?? [];
                if (response?.success && countries.length) {
                    renderWorldCountryList(countries);
                } else {
                    const message = translation.no_clubs_found || "No countries found.";
                    const error = document.createElement("div");
                    error.className = "clubs-list-error";
                    error.textContent = message;
                    container.appendChild(error);
                }
            } catch (err) {
                if (err?.name === "AbortError") return;
                container.innerHTML = `<div class="clubs-list-error">Something went wrong during search.</div>`;
                console.error("❌ Error in getCountries.initSearchWorldCountries:", err);
            }
        }

        searchInput.addEventListener("input", () => {
            if (modal.dataset.searchType !== "countries") return; // guard
            if (_europeCountriesDebounce) clearTimeout(_europeCountriesDebounce);
            _europeCountriesDebounce = setTimeout(doSearch, 500);
        }, { signal });

        // initial populate
        doSearch();
    },

    teardownSearch() {
        if (_europeCountriesSearchAbort) { _europeCountriesSearchAbort.abort(); _europeCountriesSearchAbort = null; }
        if (_europeCountriesDebounce) { clearTimeout(_europeCountriesDebounce); _europeCountriesDebounce = null; }
    }
}
