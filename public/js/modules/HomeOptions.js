import { langMap, currentLang } from "./LanguageManager.js";
import { apiGet } from '../services/api.js';
import { customLeagues } from './CustomLeagues.js';
import { checkLoggedIn } from './MeHomepage.js';

export function isLoggedIn() {
   const token = localStorage.getItem("authToken");
   return !!(token && token !== "null" && token !== "undefined");
}

export function setCustomCompetitionVisible(visible) {
   const container = document.getElementById("bannerContainer");
   const title = document.getElementById("customCompetitionBlock");
   const banners = document.getElementById("customCompetitionBlockBanners");

   if (container) container.style.display = visible ? "block" : "none";
   if (title) title.style.display = visible ? "block" : "none";
   if (banners) banners.style.display = visible ? "block" : "none";
}

export function setHomeOptionsVisible(visible) {
   const el = document.getElementById("homeOptionsBlock");
   if (el) el.style.display = visible ? "grid" : "none";
}

export function setLiveVisible(visible) {
   const livePage = document.getElementById("liveDataPage");
   if (livePage) livePage.style.display = visible ? "grid" : "none";
}

function showHomePage() {
   // document.getElementById("homePage").style.display = "block";
   // document.getElementById("homeOptionsBlock").style.display = "block";
   setHomeOptionsVisible(true);
   setCustomCompetitionVisible(false);
   document.getElementById("bannerContainer").style.display = "none";
}

function hideHomePage() {
   document.getElementById("homePage").style.display = "none";
   setHomeOptionsVisible(false);
   setCustomCompetitionVisible(false);
   document.getElementById("bannerContainer").style.display = "none";
   document.getElementById("homePage").style.display = "none";
}

export function initHomeOptionButtons() {

   // Live Data button
   document.getElementById("btnLiveData")?.addEventListener("click", () => {
      if (!isLoggedIn()) {
         sessionStorage.setItem("actionForLive", "openLive");
      }
      location.hash = "live";   // router will show liveDataPage
   });

   // Back button from Live page
   document.getElementById("btnBackFromLive")?.addEventListener("click", () => {
      location.hash = "home";   // router will show homePage
      sessionStorage.removeItem("actionForLive");
      setHomeOptionsVisible(true);
   });

   // Custom League
   document.getElementById("btnCustomData")?.addEventListener("click", async () => {
      if (!isLoggedIn()) {
         sessionStorage.setItem("postLoginAction", "openCustom");
         openModal("loginModal");
         return;
      }

      try {
         customLeagues()
         location.hash = "leagues";
      } catch (error) {
         console.error("Failed to load custom leagues:", error);
         showToast("Failed to load leagues", "error");
      }
   });

   // Banner back (custom league back)
   const translation = langMap[currentLang];
   const backBtn = document.getElementById("bannerBackBtn");
   if (backBtn) {
      backBtn.textContent = translation.backButton;
      backBtn.addEventListener("click", async () => {
         location.hash = "home";
         if (!checkLoggedIn()) {
            showHomePage()
         }
      });
   }
}