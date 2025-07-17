import { showToast } from '../utils/toast.js';
import { isValidPassword } from '../utils/validators.js';
import { setError, clearErrors } from '../utils/helper.js';
import { langMap, currentLang } from '../modules/LanguageManager.js';
import { renderLeagueTable } from './components/renderTable.js';
import { apiPost } from '../services/api.js';

export const TableManager = {
  init: function () {

    // 🔹 Banner click logic
    document.querySelectorAll(".banner").forEach(banner => {
      banner.addEventListener("click", () => {
        const id = banner.getAttribute("banner-id");
        document.getElementById("tableModal").dataset.bannerId = id;

        window.openModal("tableModal");

        // Reset view
        document.getElementById("actionButtons").style.display = "flex";
        document.getElementById("openTableSection").style.display = "none";
        document.getElementById("confirmOpenBtn").style.display = "none";
        document.getElementById("tablePassword").value = "";
        document.getElementById("tablePasswordError").textContent = "";
      });
    });

    // 🔹 "Open" button: hide options, show password
    document.getElementById("openBtn").addEventListener("click", () => {
      document.getElementById("actionButtons").style.display = "none";
      document.getElementById("confirmOpenBtn").style.display = "flex";
      document.getElementById("openTableSection").style.display = "block";
    });

    // 🔹 Submit password
    const openBtn = document.getElementById("confirmOpenBtn");
    if (openBtn) {
      openBtn.addEventListener("click", async () => {
        const translation = langMap[currentLang];
        clearErrors(["tablePasswordError"]);

        const bannerId = parseInt(document.getElementById("tableModal").dataset.bannerId);
        const password = document.getElementById("tablePassword").value.trim();
        const errorField = document.getElementById("tablePasswordError");

        let hasError = false;

        if (!password) {
          setError("tablePasswordError", translation.required);
          hasError = true;
        } else if (!isValidPassword(password)) {
          setError("tablePasswordError", translation.invalidPassword);
          hasError = true;
        }

        if (hasError) return;

        try {
          const data = await apiPost("/open-table", { bannerId, password });

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
    }
  }
};