import { showToast } from '../utils/toast.js';
import { setError, clearErrors } from '../utils/helper.js';
import { langMap, currentLang } from './LanguageManager.js';
import { renderLeagueTable } from './components/renderTable.js';
import { getFriends } from './GetFriends.js';
import { apiPost } from '../services/api.js';

export const LeagueManager = {
  initCreate: function () { //TO DO

    // 🔹 Banner click logic
    document.querySelectorAll(".banner").forEach(banner => {
      banner.addEventListener("click", () => {

        window.openModal("tableModal");

        // Reset view
        document.getElementById("actionButtons").style.display = "flex";
        document.getElementById("openCreateSection").style.display = "none";
        document.getElementById("confirmCreateBtn").style.display = "none";
        document.getElementById("createCompetition").style.display = "none";
        document.getElementById("leagueName").value = "";
        document.getElementById("leagueNameError").textContent = "";
        document.getElementById("count-select").style.display = "none";
        document.getElementById("user-select").style.display = "none";
      });
    });

    // 🔹 "Create" button: hide options, show password
    document.getElementById("createBtn").addEventListener("click", () => {
      getFriends.initGetAllFriends();
      
      document.getElementById("actionTitle").style.display = "none";
      document.getElementById("createCompetition").style.display = "block";
      document.getElementById("actionButtons").style.display = "none";
      document.getElementById("confirmCreateBtn").style.display = "flex";
      document.getElementById("openCreateSection").style.display = "block";
      document.getElementById("count-select").style.display = "block";
      document.getElementById("user-select").style.display = "block";
    });

    // 🔹 Submit password
    const createBtn = document.getElementById("confirmCreateBtn");
    if (createBtn) {
      createBtn.addEventListener("click", async () => {
        const translation = langMap[currentLang];
        clearErrors(["leagueNameError"]);

        let hasError = false;

        const modal = document.getElementById("tableModal");
        const bannerId = modal.dataset.bannerId;
        const leagueNameInput = document.getElementById("leagueName").value.trim()
        const teamCount = document.getElementById("count-select").value;

        const leagueNameError = document.getElementById("leagueNameError");

        if (!leagueNameInput) {
          setError("leagueNameError", translation.required);
          hasError = true;
        } else if (leagueNameInput.length < 3) {
          setError("leagueNameError", translation.shortLeagueName);
          hasError = true;
        } else if (leagueNameInput.length > 30) {
          setError("leagueNameError", translation.longLeagueName);
          hasError = true;
        }

        if (hasError) return;

        leagueNameError.textContent = "";

        try {
          const data = await apiPost("/create-leagues", { bannerId, leagueNameInput, teamCount });
          console.log(leagueNameInput)

          if (data.success && data.data) {
            window.closeModal("tableModal");
            document.getElementById("bannerContainer").style.display = "none";

            renderLeagueTable(data.data); // 💡 Your custom function to render match data
          } else {
            errorField.textContent = translation.invalid_table_password || "Incorrect password or table not found.";
          }
        } catch (err) {
          showToast(translation.something_went_wrong || "Something went wrong.", "error");
          console.error("Error opening table:", err);
        }
      });
    };
  },







  initOpen: async function () {

    // 🔹 Banner click logic
    document.querySelectorAll(".banner").forEach(banner => {
      banner.addEventListener("click", () => {
        const id = banner.getAttribute("banner-id");

        document.getElementById("tableModal").dataset.bannerId = id;

        window.openModal("tableModal");

        // Reset view
        document.getElementById("actionButtons").style.display = "flex";
        document.getElementById("openCreateSection").style.display = "none";
        document.getElementById("confirmCreateBtn").style.display = "none";
        document.getElementById("leagueName").value = "";
        document.getElementById("leagueNameError").textContent = "";
      });
    });

    // 🔹 "Open" button: hide options, show password
    document.getElementById("openBtn").addEventListener("click", async () => {
      document.getElementById("tableModal").style.display = "none";

      const bannerId = parseInt(document.getElementById("tableModal").dataset.bannerId);
      const translation = langMap[currentLang];


      try {
        const data = await apiPost("/leagues", { bannerId });

        if (data.success && data.data) {
          window.closeModal("tableModal");
          document.getElementById("bannerContainer").style.display = "none";
          renderLeagueTable(data.data);
        } else {
          errorField.textContent = translation.invalid_table_password || "Incorrect password or table not found.";
        }
      } catch (err) {
        showToast(translation.something_went_wrong || "Something went wrong.", "error");
        console.error("Error opening table:", err);
      }
    });
  }
};