import { langMap, currentLang } from "./LanguageManager.js";
import { openLiveData, closeLiveData } from "./liveData.js";

export function isLoggedIn() {
   const token = localStorage.getItem("authToken");
   return !!(token && token !== "null" && token !== "undefined");
}

export function setCustomCompetitionVisible(visible) {
   const title = document.getElementById("customCompetitionBlock");
   const banners = document.getElementById("customCompetitionBlockBanners");
   document.getElementById("bannerContainer").style.display = "block";
   if (title) title.style.display = visible ? "block" : "none";
   if (banners) banners.style.display = visible ? "block" : "none";
}

export function setHomeOptionsVisible(visible) {
   const el = document.getElementById("homeOptionsBlock");
   if (el) el.style.display = visible ? "grid" : "none";
   document.getElementById("bannerContainer").style.display = "none";
}

function showHomePage() {
   document.getElementById("homePage").style.display = "block";
   setHomeOptionsVisible(true);
   setCustomCompetitionVisible(false);
   document.getElementById("bannerContainer").style.display = "none";
}

function hideHomePage() {
   document.getElementById("homePage").style.display = "none";
   setHomeOptionsVisible(false);
   setCustomCompetitionVisible(false);
   document.getElementById("bannerContainer").style.display = "none";
}

export function initHomeOptionButtons() {
   // initial state
   showHomePage();
   closeLiveData(); // ensures liveDataPage hidden

   // Live Data button
   document.getElementById("btnLiveData")?.addEventListener("click", () => {
      hideHomePage();
      openLiveData();
   });

   // Back button from Live page
   document.getElementById("btnBackFromLive")?.addEventListener("click", () => {
      closeLiveData();
      showHomePage();
   });

   // Custom League
   document.getElementById("btnCustomData")?.addEventListener("click", () => {
      if (!isLoggedIn()) {
         sessionStorage.setItem("postLoginAction", "openCustom");
         openModal("loginModal"); // uses your existing modal function
         return;
      }

      setHomeOptionsVisible(false);
      setCustomCompetitionVisible(true);
   });

   // Banner back (custom league back)
   const translation = langMap[currentLang];
   const backBtn = document.getElementById("bannerBackBtn");
   if (backBtn) {
      backBtn.textContent = translation.backButton;
      backBtn.addEventListener("click", () => {
         setCustomCompetitionVisible(false);
         setHomeOptionsVisible(true);
         document.getElementById("bannerContainer").style.display = "none";
      });
   }
}