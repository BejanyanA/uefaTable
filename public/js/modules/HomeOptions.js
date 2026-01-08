import { langMap, currentLang } from './LanguageManager.js';
import { apiGet } from '../services/api.js';

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
}

export function initHomeOptionButtons() {
   // Initial state on load
   setHomeOptionsVisible(true);
   setCustomCompetitionVisible(false);

   // Live Data
   document.getElementById("btnLiveData")?.addEventListener("click", () => {
      console.log("Live Data clicked");
      // next step: show liveDataPage
   });

   // Custom League
   document.getElementById("btnCustomData")?.addEventListener("click", () => {
      if (!isLoggedIn()) {
         sessionStorage.setItem("postLoginAction", "openCustom"); // ✅ add
         openModal("loginModal");
         return;
      }

      setHomeOptionsVisible(false);
      setCustomCompetitionVisible(true);
   });


   const translation = langMap[currentLang];
   const section = document.getElementById("bannerContainer");
   const backBtn = document.getElementById("bannerBackBtn");
   backBtn.textContent = translation.backButton;

   backBtn.addEventListener("click", async () => {
      setCustomCompetitionVisible(false);
      setHomeOptionsVisible(true);
   });

}