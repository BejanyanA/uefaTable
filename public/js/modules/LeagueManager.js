import { showToast } from '../utils/toast.js';
import { setError, clearErrors } from '../utils/helper.js';
import { langMap, currentLang } from './LanguageManager.js';
import { renderLeagueTable } from './components/renderLeagueTable.js';
import { getFriends } from './GetFriends.js';
import { getClubs } from './GetClubs.js';
import { getCountries } from './GetWorldCountries.js';
import { getEuropeCountries } from './GetEuropeCountries.js';
import { apiGet, apiPost } from '../services/api.js';
import { renderNationalTable } from './components/renderNationalTable.js';


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
        document.getElementById("stageSelect").style.display = "none";
        document.getElementById("stageError").style.display = "none";
        document.getElementById("dropdownRow").style.display = "none";
      });
    });

    // 🔹 "Create" button: hide options, show password
    document.getElementById("createBtn").addEventListener("click", () => {
      const modal = document.getElementById("tableModal");
      const bannerId = parseInt(modal.dataset.bannerId);

      getFriends.initGetAllFriends();

      // 🔧 Teardown everything first (idempotent if not active)
      getClubs?.teardownSearch?.();
      getEuropeCountries?.teardownSearch?.();
      getCountries?.teardownSearch?.();

      if (bannerId === 1 || bannerId === 2) {
        getClubs.initSearchClubs(modal);
      } else if (bannerId === 3) {
        getEuropeCountries.initSearchEuropeCountries(modal);
      } else if (bannerId === 4) {
        getCountries.initSearchWorldCountries(modal);
      }

      // show/hide UI as you already do...
      document.getElementById("actionTitle").style.display = "none";
      document.getElementById("createCompetition").style.display = "block";
      document.getElementById("actionButtons").style.display = "none";
      document.getElementById("confirmCreateBtn").style.display = "flex";
      document.getElementById("openCreateSection").style.display = "block";
      document.getElementById("count-select").style.display = "block";
      document.getElementById("user-select").style.display = "block";
      document.getElementById("stageSelect").style.display = "block";
      document.getElementById("teamCountError").style.display = "block";
      document.getElementById("clubList").style.display = "block";
      document.getElementById("clubsError").style.display = "block";
      document.getElementById("clubCount").style.display = "block";
      document.getElementById("clubSearch").style.display = "block";
      document.getElementById("clubSearchLabel").style.display = "block";
      document.getElementById("stageError").style.display = "block";
      document.getElementById("dropdownRow").style.display = "flex";
    });

    // 🔹 Submit password
    const createBtn = document.getElementById("confirmCreateBtn");
    if (createBtn) {
      createBtn.addEventListener("click", async () => {
        const translation = langMap[currentLang];
        clearErrors(["leagueNameError", "teamCountError", "clubsError", "stageError"]);

        let hasError = false;

        const modal = document.getElementById("tableModal");
        const bannerId = parseInt(modal.dataset.bannerId);
        const name = document.getElementById("leagueName").value.trim()
        const teamCount = parseInt(document.getElementById("count-select").value);
        const selectedClubIds = Array.from(document.querySelectorAll('#clubList input[type="checkbox"]:checked'))
          .map(cb => parseInt(cb.value));
        const clubIds = selectedClubIds;
        const rawValue = document.getElementById("stageSelect").value;
        const isGroup = rawValue === "true";

        const leagueNameError = document.getElementById("leagueNameError");
        const teamCountError = document.getElementById("teamCountError");
        const clubsError = document.getElementById("clubsError");
        const stageError = document.getElementById("stageError");

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

        if (rawValue === "") {
          setError("stageError", translation.required);
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
        stageError.textContent = "";

        try {

          if (!isGroup) {
            // Knockout-only flow (mirror createLeague handling)
            const createKnockout = await apiPost("/create-knockouts", {
              bannerId, name, teamCount, friendIds, clubIds, isGroup
            });

            if (createKnockout.success && createKnockout.data) {
              try {
                const data = await apiPost("/leagues", { bannerId, isGroup });

                if (data.success && data.data) {
                  window.closeModal("tableModal");
                  showToast(translation.league_create_success || "League Successfully Created", "success");
                  document.getElementById("bannerContainer").style.display = "none";

                  if (bannerId === 1 || bannerId === 2) {
                    renderLeagueTable(data.data);
                  } else {
                    renderNationalTable(data.data);
                  }
                } else {
                  showToast(translation.not_found || "Not found", "info");
                }
              } catch (err) {
                showToast(translation.something_went_wrong || "Something went wrong", "error");
                console.error("Error opening table:", err);
              }
            } else {
              const error = createKnockout.error;
              if (error === "creation_failed") {
                showToast(translation.league_creation_failed || "League Creation failed", "error");
              } else {
                showToast(translation.something_went_wrong || "Something went wrong", "error");
              }
            }
            return; // stop here; skip /create-leagues
          }

          const createLeague = await apiPost("/create-leagues", { bannerId, name, teamCount, friendIds, clubIds, isGroup });

          if (createLeague.success && createLeague.data) {
            try {
              const data = await apiPost("/leagues", { bannerId, isGroup });

              if (data.success && data.data) {
                window.closeModal("tableModal");
                showToast(translation.league_create_success || "League Successfully Created", "success");
                document.getElementById("bannerContainer").style.display = "none";

                if (bannerId === 1 || bannerId === 2) {
                  renderLeagueTable(data.data);
                } else {
                  renderNationalTable(data.data);
                }
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

    const translation = langMap[currentLang];
    const section = document.getElementById("stageContainer");
    const backBtn = document.getElementById("stageBackBtn");
    backBtn.textContent = translation.backButton;

    backBtn.addEventListener("click", async () => {
      location.hash = "leagues";
      const token = localStorage.getItem("authToken");

      // try {
      //   const response = await apiGet("/me", token);
      //   if (response.success && response.user) {
      //     document.getElementById("bannerContainer").style.display = "block";
      //     document.getElementById("stageContainer").style.display = "none";
      //   } else {
      //     localStorage.removeItem("authToken");
      //     if (authButtons) authButtons.style.display = "flex";
      //   }
      // } catch (err) {
      //   console.error("🔴 Error in Back button to /me:", err);
      //   localStorage.removeItem("authToken");
      //   if (authButtons) authButtons.style.display = "flex";
      // }
    });

    // 🔹 "Open"
    document.getElementById("openBtn").addEventListener("click", () => {
      const modal = document.getElementById("tableModal");
      modal.style.display = "none";

      const bannerId = Number(modal.dataset.bannerId);
      if (!bannerId) return;

      localStorage.setItem("currentBannerId", bannerId);

      if (bannerId === 1) location.hash = "#champions-league";
      else if (bannerId === 2) location.hash = "#europe-league";
      else if (bannerId === 3) location.hash = "#euro-cup";
      else if (bannerId === 4) location.hash = "#world-cup";

    });

    section.appendChild(backBtn);

    // ✅ Event listeners for stage banners
    document.getElementById("stageBanner1").addEventListener("click", () => {
      const bannerId = Number(localStorage.getItem("currentBannerId"));

      if (bannerId === 1) location.hash = "#ucl-basic-my";  // default tab = my
      else if (bannerId === 2) location.hash = "#uel-basic-my";
      else if (bannerId === 3) location.hash = "#euro-basic-my";  // default tab = my
      else if (bannerId === 4) location.hash = "#wc-basic-my";
    });

    document.getElementById("stageBanner2").addEventListener("click", () => {
      const bannerId = Number(localStorage.getItem("currentBannerId"));

      if (bannerId === 1) location.hash = "#ucl-only-my";
      else if (bannerId === 2) location.hash = "#uel-only-my";
      else if (bannerId === 3) location.hash = "#euro-only-my";
      else if (bannerId === 4) location.hash = "#wc-only-my";
    });
  },



  initEdit: async function (leagueId, currentLeagueName) {
    const translation = langMap[currentLang];

    const modal = document.getElementById("editModal");
    const title = document.getElementById("editLeagueTitle");
    const input = document.getElementById("leagueNameEdit");
    const leagueNameError = document.getElementById("leagueNameUpdateError");
    const accessContainer = document.getElementById("accessUsersContainer");
    const friendsContainer = document.getElementById("friendsListContainer");
    const frineds = document.getElementById("friends");
    const usersWithAccess = document.getElementById("usersWithAccess");
    const cancelBtn = document.getElementById("cancelEditBtn");
    const confirmBtn = document.getElementById("confirmEditBtn");

    title.textContent = translation.edit_league_title || "Edit League";
    usersWithAccess.textContent = translation.usersWithAccess || "Users with Access";
    frineds.textContent = translation.friends || "Friends";
    confirmBtn.textContent = translation.update || "Update";
    cancelBtn.textContent = translation.cancel || "Cancel";
    clearErrors(["leagueNameUpdateError"]);

    modal.classList.remove("hidden");
    input.value = currentLeagueName;
    accessContainer.innerHTML = "";
    friendsContainer.innerHTML = "";

    const messageFriend = translation.no_friends_found || "No friends found.";
    const messageAccess = translation.no_friends_found || "No friends found.";

    const accessMsg = document.createElement("div");
    accessMsg.textContent = messageAccess;
    accessMsg.className = "no-access-msg";

    const friendMsg = document.createElement("div");
    friendMsg.textContent = messageFriend;
    friendMsg.className = "no-friend-msg";

    // Fetch access + friends data
    const response = await apiPost("/friends", { leagueId });
    const accessUserIds = response?.data?.accessUserIds || [];
    const friends = response?.data?.friends || [];

    const selectedFriendIds = new Set(accessUserIds.map(f => f.id));
    const denyFriendIds = new Set();

    const createUserPill = (user, isExisting = true) => {
      // Remove placeholder if shown
      if (accessContainer.contains(accessMsg)) {
        accessContainer.removeChild(accessMsg);
      }

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

        const friendBtn = friendsContainer.querySelector(`[data-id="${user.id}"]`);
        if (friendBtn) friendBtn.disabled = false;

        // Re-add placeholder if container is empty
        if (accessContainer.querySelectorAll(".user-pill").length === 0) {
          accessContainer.appendChild(accessMsg);
        }
      };

      pill.appendChild(removeBtn);
      accessContainer.appendChild(pill);
    };

    // Render existing access users
    if (accessUserIds.length > 0) {
      accessUserIds.forEach(user => createUserPill(user));
    } else {
      accessContainer.appendChild(accessMsg);
    }

    // Render friends list
    if (friends.length > 0) {
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

            // Remove placeholder if shown
            if (accessContainer.contains(accessMsg)) {
              accessContainer.removeChild(accessMsg);
            }

            createUserPill(friend, false);
            btn.disabled = true;
          }
        };

        friendsContainer.appendChild(btn);
      });
    } else {
      friendsContainer.appendChild(friendMsg);
    }

    // Cancel button
    cancelBtn.onclick = () => {
      modal.classList.add("hidden");
    };

    // Confirm update
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener("click", async () => {
      const name = document.getElementById("leagueNameEdit").value.trim();

      let hasError = false;

      if (!name) {
        setError("leagueNameUpdateError", translation.required);
        hasError = true;
      } else if (name.length < 3) {
        setError("leagueNameUpdateError", translation.shortLeagueName);
        hasError = true;
      } else if (name.length > 30) {
        setError("leagueNameUpdateError", translation.longLeagueName);
        hasError = true;
      }

      if (hasError) return;
      leagueNameError.textContent = "";

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
          showToast(translation.league_update_success || "League updated", "success");

          const bannerId = parseInt(document.getElementById("tableModal").dataset.bannerId);
          localStorage.setItem("currentBannerId", bannerId);

          const stageBannerId = parseInt(localStorage.getItem("selectedStageType"));
          const isGroup = stageBannerId === 1;

          const data = await apiPost("/leagues", { bannerId, isGroup });

          if (data.success && data.data) {
            window.closeModal("tableModal");
            document.getElementById("bannerContainer").style.display = "none";
            if (bannerId === 1 || bannerId === 2) {
              renderLeagueTable(data.data);
            } else {
              renderNationalTable(data.data);
            }
          }
        } else {
          showToast(translation.league_update_failed || "Update failed", "error");
        }
      } catch (err) {
        console.error(err);
        showToast(translation.something_went_wrong || "Something went wrong", "error");
      }
    });
  },



  initDelete: async function (leagueId) {
    const translation = langMap[currentLang];

    const modal = document.getElementById("deleteModal");
    const title = document.getElementById("deleteModalTitle");
    const message = document.getElementById("deleteModalText");
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    const cancelBtn = document.getElementById("cancelBtn");

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

          const stageBannerId = parseInt(localStorage.getItem("selectedStageType"));
          const isGroup = stageBannerId === 1;

          const data = await apiPost("/leagues", { bannerId, isGroup });

          if (data.success && data.data) {
            window.closeModal("tableModal");
            document.getElementById("bannerContainer").style.display = "none";
            if (bannerId === 1 || bannerId === 2) {
              renderLeagueTable(data.data);
            } else {
              renderNationalTable(data.data);
            }
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