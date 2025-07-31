import { showToast } from '../utils/toast.js';
import { setError, clearErrors } from '../utils/helper.js';
import { langMap, currentLang } from './LanguageManager.js';
import { renderLeagueTable } from './components/renderTable.js';
import { getFriends } from './GetFriends.js';
import { getClubs } from './GetClubs.js';
import { apiPost } from '../services/api.js';

export const LeagueManager = {
  initCreate: function () {

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
        document.getElementById("teamCountError").style.display = "none";
        document.getElementById("clubList").style.display = "none";
        document.getElementById("clubsError").style.display = "none";
        document.getElementById("clubCount").innerHTML = "";
        document.getElementById("clubSearch").style.display = "none";
        document.getElementById("clubSearchLabel").style.display = "none";
      });
    });

    // 🔹 "Create" button: hide options, show password
    document.getElementById("createBtn").addEventListener("click", () => {
      const modal = document.getElementById("tableModal");
      const bannerId = parseInt(modal.dataset.bannerId);

      if (bannerId === 1 || bannerId === 2) {
        getFriends.initGetAllFriends();
        getClubs.initGetAllClubs();
      } // TO DO EUROPE AND WORLD 

      document.getElementById("actionTitle").style.display = "none";
      document.getElementById("createCompetition").style.display = "block";
      document.getElementById("actionButtons").style.display = "none";
      document.getElementById("confirmCreateBtn").style.display = "flex";
      document.getElementById("openCreateSection").style.display = "block";
      document.getElementById("count-select").style.display = "block";
      document.getElementById("user-select").style.display = "block";
      document.getElementById("teamCountError").style.display = "block";
      document.getElementById("clubList").style.display = "block";
      document.getElementById("clubsError").style.display = "block";
      document.getElementById("clubCount").style.display = "block";
      document.getElementById("clubSearch").style.display = "block";
      document.getElementById("clubSearchLabel").style.display = "block";
    });

    // 🔹 Submit password
    const createBtn = document.getElementById("confirmCreateBtn");
    if (createBtn) {
      createBtn.addEventListener("click", async () => {
        const translation = langMap[currentLang];
        clearErrors(["leagueNameError", "teamCountError", "clubsError"]);

        let hasError = false;

        const modal = document.getElementById("tableModal");
        const bannerId = parseInt(modal.dataset.bannerId);
        const name = document.getElementById("leagueName").value.trim()
        const teamCount = parseInt(document.getElementById("count-select").value);
        const selectedClubIds = Array.from(document.querySelectorAll('#clubList input[type="checkbox"]:checked'))
          .map(cb => parseInt(cb.value));
        const clubIds = selectedClubIds;

        const leagueNameError = document.getElementById("leagueNameError");
        const teamCountError = document.getElementById("teamCountError");
        const clubsError = document.getElementById("clubsError");

        if (!name) {
          setError("leagueNameError", translation.required);
          hasError = true;
        } else if (name.length < 3) {
          setError("leagueNameError", translation.shortLeagueName);
          hasError = true;
        } else if (name.length > 30) {
          setError("leagueNameError", translation.longLeagueName);
          hasError = true;
        }

        if (!teamCount) {
          setError("teamCountError", translation.required);
          hasError = true;
        }

        if (!clubIds.length) {
          setError("clubsError", translation.required);
          hasError = true;
        } else if (clubIds.length < teamCount) {
          setError("clubsError", translation.lessClubCount);
          hasError = true;
        } else if (clubIds.length > teamCount) {
          setError("clubsError", translation.largeClubCount);
          hasError = true;
        }

        // Selected Friends
        const selectedFriendIds = Array.from(document.querySelectorAll('#user-select input[type="checkbox"]:checked'))
          .map(cb => cb.value);

        let friendIds = selectedFriendIds.map(id => parseInt(id));
        if (!friendIds.length) {
          friendIds = null
        }


        if (hasError) return;

        leagueNameError.textContent = "";
        teamCountError.textContent = "";
        clubsError.textContent = "";

        try {
          const createLeague = await apiPost("/create-leagues", { bannerId, name, teamCount, friendIds, clubIds });


          if (createLeague.success && createLeague.data) {
            try {
              const data = await apiPost("/leagues", { bannerId });

              if (data.success && data.data) {
                window.closeModal("tableModal");
                showToast(translation.league_create_success || "League Successfully Created", "success");
                document.getElementById("bannerContainer").style.display = "none";
                renderLeagueTable(data.data);
              } else {
                showToast(translation.not_found || "Not found", "info");
              }
            } catch (err) {
              showToast(translation.something_went_wrong || "Something went wrong", "error");
              console.error("Error opening table:", err);
            }
          } else {

            const error = createLeague.error;
            if (error === "creation_failed") {
              showToast(translation.league_creation_failed || "League Creation failed", "error");
            }
          }
        } catch (err) {
          showToast(translation.something_went_wrong, "error");
          console.error(err);
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
      localStorage.setItem("currentBannerId", bannerId);


      try {
        const data = await apiPost("/leagues", { bannerId });

        if (data.success && data.data) {
          window.closeModal("tableModal");
          document.getElementById("bannerContainer").style.display = "none";
          renderLeagueTable(data.data);
        } else {
          showToast(translation.not_found || "Not found", "info");
        }
      } catch (err) {
        showToast(translation.something_went_wrong || "Something went wrong", "error");
        console.error("Error opening table:", err);
      }
    });
  },




  initEdit: async function (leagueId, currentLeagueName) {
    const modal = document.getElementById("editModal");
    const input = document.getElementById("leagueNameInput");
    const error = document.getElementById("leagueNameError");
    const accessContainer = document.getElementById("accessUsersContainer");
    const friendsContainer = document.getElementById("friendsListContainer");
    const cancelBtn = document.getElementById("cancelEditBtn");
    const confirmBtn = document.getElementById("confirmEditBtn");

    let hasError = false;

    const translation = langMap[currentLang];
    
    modal.classList.remove("hidden");
    input.value = currentLeagueName;
    error.textContent = "";
    accessContainer.innerHTML = "";
    friendsContainer.innerHTML = "";

    // Fetch access + friends data
    const response = await apiPost("/friends", { leagueId })
    const accessUserIds = response?.data?.accessUserIds || [];
    const friends = response?.data?.friends || [];

    const selectedFriendIds = new Set(accessUserIds.map(f => f.id));
    const denyFriendIds = new Set();

    const createUserPill = (user, isExisting = true) => {
      const pill = document.createElement("div");
      pill.className = "user-pill";
      pill.textContent = user.username;

      const removeBtn = document.createElement("span");
      removeBtn.textContent = "✖";
      removeBtn.className = "remove-btn";
      removeBtn.onclick = () => {
        accessContainer.removeChild(pill);
        selectedFriendIds.delete(user.id);
        denyFriendIds.add(user.id);
        // Enable the friend button again
        const friendBtn = friendsContainer.querySelector(`[data-id="${user.id}"]`);
        if (friendBtn) friendBtn.disabled = false;
      };

      pill.appendChild(removeBtn);
      accessContainer.appendChild(pill);
    };

    // Render existing access users
    accessUserIds.forEach(user => createUserPill(user));

    // Render friends list
    friends.forEach(friend => {
      const btn = document.createElement("button");
      btn.textContent = friend.username;
      btn.className = "add-friend-btn";
      btn.disabled = selectedFriendIds.has(friend.id);
      btn.dataset.id = friend.id;

      btn.onclick = () => {
        if (!selectedFriendIds.has(friend.id)) {
          selectedFriendIds.add(friend.id);
          denyFriendIds.delete(friend.id);
          createUserPill(friend, false);
          btn.disabled = true;
        }
      };

      friendsContainer.appendChild(btn);
    });

    // Cancel button
    cancelBtn.onclick = () => {
      modal.classList.add("hidden");
    };

    // Confirm update
    confirmBtn.onclick = async () => {
      const name = input.value;

      if (!name) {
        setError("leagueNameError", translation.required);
        hasError = true;
      } else if (name.length < 3) {
        setError("leagueNameError", translation.shortLeagueName);
        hasError = true;
      } else if (name.length > 30) {
        setError("leagueNameError", translation.longLeagueName);
        hasError = true;
      }

      const friendIds = Array.from(selectedFriendIds);
      const denyIds = Array.from(denyFriendIds);

      try {
        const res = await apiPost("/update-leagues", {
          leagueId,
          name,
          friendIds,
          denyFriendIds: denyIds
        });

        if (res.success) {
          modal.classList.add("hidden");
          showToast(translation.league_updated || "League updated", "success");

          const bannerId = parseInt(document.getElementById("tableModal").dataset.bannerId);
          localStorage.setItem("currentBannerId", bannerId);
          const data = await apiPost("/leagues", { bannerId });

          if (data.success && data.data) {
            window.closeModal("tableModal");
            document.getElementById("bannerContainer").style.display = "none";
            renderLeagueTable(data.data);
          }
        } else {
          showToast(translation.update_failed || "Update failed", "error");
        }
      } catch (err) {
        console.error(err);
        showToast(translation.something_went_wrong || "Something went wrong", "error");
      }
    };
  },


  initDelete: async function (leagueId) {
    const translation = langMap[currentLang];

    const modal = document.getElementById("deleteModal");
    const title = document.getElementById("deleteModalTitle");
    const message = document.getElementById("deleteModalText");
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    const cancelBtn = document.getElementById("cancelDeleteBtn");

    // Set translation-based text
    title.textContent = translation.confirm_delete_title || "Confirm Deletion";
    message.textContent = translation.confirm_delete_text || "Are you sure you want to delete this league?";
    confirmBtn.textContent = translation.delete || "Delete";
    cancelBtn.textContent = translation.cancel || "Cancel";

    modal.classList.remove("hidden");

    // 🔁 Remove previous click handler (clone & replace)
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    // ✅ On confirm
    newConfirmBtn.addEventListener("click", async () => {
      modal.classList.add("hidden");

      try {
        const response = await apiPost("/delete-league", { leagueId });
        if (response.success) {
          showToast(translation.league_delete_success || "League deleted successfully", "success");

          const bannerId = parseInt(document.getElementById("tableModal").dataset.bannerId);
          localStorage.setItem("currentBannerId", bannerId);
          const data = await apiPost("/leagues", { bannerId });

          if (data.success && data.data) {
            window.closeModal("tableModal");
            document.getElementById("bannerContainer").style.display = "none";
            renderLeagueTable(data.data);
          }
        } else {
          showToast(translation.league_delete_failed || "Failed to delete league", "error");
        }
      } catch (err) {
        console.error("Error deleting league:", err);
        showToast("Server error", "error");
      }
    });

    // On cancel
    cancelBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }
};