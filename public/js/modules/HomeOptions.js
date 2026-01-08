import { langMap, currentLang } from './LanguageManager.js';
import { apiGet } from '../services/api.js';


let leaguesWidgetLoaded = false;

function setLiveDataVisible(isVisible) {
   const livePage = document.getElementById("liveDataPage");
   if (!livePage) return;
   livePage.style.display = isVisible ? "block" : "none";
}

function ensureLeaguesWidgetLoaded() {
   if (leaguesWidgetLoaded) return;

   const container = document.getElementById("leaguesWidgetContainer");
   if (!container) {
      console.warn("Missing #leaguesWidgetContainer in HTML");
      return;
   }

   // IMPORTANT:
   // 1) Do NOT keep any wg-api-football-lives div anywhere.
   // 2) Only ONE config widget total (we inject it once here).
   container.innerHTML = `
    <api-sports-widget data-type="games" data-target-game="modal"></api-sports-widget>

   <api-sports-widget
   data-type="config"
   data-key="14108d2decc4cfb2cb970d4e9f28d479"
   data-sport="football"
   data-show-logos=true
   data-favorite=true
   data-refresh=10
   ></api-sports-widget>
  `;

   leaguesWidgetLoaded = true;
}




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
   setLiveDataVisible(false);

   // Live Data button
   const btnLive = document.getElementById("btnLiveData");
   if (btnLive) {
      btnLive.addEventListener("click", () => {
         console.log("Live Data clicked");

         // Hide other sections (your existing logic)
         setHomeOptionsVisible(false);
         setCustomCompetitionVisible(false);
         document.getElementById("homePage").style.display = "none";

         // Show Live Data page
         setLiveDataVisible(true);

         // Load widget ONCE (prevents duplicate requests)
         ensureLeaguesWidgetLoaded();
      });
   }

   function resetLeaguesWidget() {
      const container = document.getElementById("leaguesWidgetContainer");
      if (container) container.innerHTML = "";   // remove widget DOM
      leaguesWidgetLoaded = false;               // allow ensureLeaguesWidgetLoaded() again
   }

   // Back button from Live page
   const btnBack = document.getElementById("btnBackFromLive");
   if (btnBack) {
      btnBack.addEventListener("click", () => {
         // Hide Live Data page
         setLiveDataVisible(false);

         resetLeaguesWidget();

         // Show home options again
         document.getElementById("homePage").style.display = "block";
         setHomeOptionsVisible(true);
         setCustomCompetitionVisible(false);
      });
   }






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