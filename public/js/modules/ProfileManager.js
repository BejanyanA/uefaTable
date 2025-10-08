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

export const ProfileManager = {
  openFriends: async function () {
    const translation = langMap[currentLang];
    const section = document.getElementById("friendsContainer");
    section.innerHTML = ""; // Clear previous content
    section.style.display = "block";

    // 🔹 Friends click logic
    const friendsLink = document.getElementById("friends");
    friendsLink.addEventListener("click", () => {

      document.getElementById("headerUsername").style.display = "block";
      document.getElementById("profileMenu").style.display = "block";
      document.getElementById("bannerContainer").style.display = "none";
      localStorage.removeItem("lastActiveLeagueTab");
      localStorage.removeItem("leaguesActiveTab");
      localStorage.removeItem("lastActiveNationalLeagueTab");
      localStorage.removeItem("currentBannerId");
      localStorage.removeItem("leagueId");
      localStorage.removeItem("selectedStageType");

      getFriends.initGetAllFriends();

      const backBtn = document.createElement("button");
      backBtn.textContent = translation.backButton;
      backBtn.id = "backBtn";

      backBtn.addEventListener("click", async () => {
        const token = localStorage.getItem("authToken");

        try {
          const response = await apiGet("/me", token);
          if (response.success && response.user) {
            document.getElementById("headerUsername").style.display = "block";
            document.getElementById("profileMenu").style.display = "block";
            document.getElementById("homePage").style.display = "block";
            document.getElementById("bannerContainer").style.display = "block";
            document.getElementById("loginBtn").style.display = "none";
            document.getElementById("registerBtn").style.display = "none";
            document.getElementById("friendsContainer").style.display = "none";
          } else {
            localStorage.removeItem("authToken");
            if (authButtons) authButtons.style.display = "flex";
            document.getElementById("bannerContainer").style.display = "none";
          }
        } catch (err) {
          console.error("🔴 Error in Back button to /me:", err);
          localStorage.removeItem("authToken");
          if (authButtons) authButtons.style.display = "flex";
        }
      });

      section.appendChild(backBtn); // Add Back button


      // ✅ Tabs header (always shown now since we have some data)
      const tabsHeader = document.createElement("div");
      tabsHeader.className = "tab-switcher";
      tabsHeader.id = "leaguesTabs";
      tabsHeader.setAttribute("role", "tablist");

      const myTabBtn = document.createElement("button");
      myTabBtn.className = "tab-btn";
      myTabBtn.dataset.tab = "owners";
      myTabBtn.id = "myLeaguesTab";
      myTabBtn.setAttribute("role", "tab");
      myTabBtn.setAttribute("aria-controls", "leaguesRow");
      myTabBtn.textContent = translation.myCreatedLeagues || "Friends";

      const invitedTabBtn = document.createElement("button");
      invitedTabBtn.className = "tab-btn";
      invitedTabBtn.dataset.tab = "invited";
      invitedTabBtn.id = "invitedLeaguesTab";
      invitedTabBtn.setAttribute("role", "tab");
      invitedTabBtn.setAttribute("aria-controls", "leaguesRow");
      invitedTabBtn.textContent = translation.myInvitedLeagues || "Friend Requests";

      tabsHeader.appendChild(myTabBtn);
      tabsHeader.appendChild(invitedTabBtn);
      section.appendChild(tabsHeader);

    });

  },






};