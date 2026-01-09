import { langMap, currentLang } from './LanguageManager.js';
import { apiGet } from '../services/api.js';



let widgetsBootstrapped = false;     // config injected once per LiveData open
let currentTab = "live";             // default tab

function setLiveDataVisible(isVisible) {
   const livePage = document.getElementById("liveDataPage");
   if (!livePage) return;
   livePage.style.display = isVisible ? "block" : "none";
}

// ✅ Create config ONCE per open, NOT inside every tab.
function ensureConfigWidget() {
   if (widgetsBootstrapped) return;

   // Put config widget once (best inside container or body)
   const container = document.getElementById("leaguesWidgetContainer");
   if (!container) return;

   // We inject config FIRST time only, and then tab content will be swapped under it.
   // We'll keep config outside of the tab content by placing it in a separate holder.
   let cfgHolder = document.getElementById("apiSportsConfigHolder");
   if (!cfgHolder) {
      cfgHolder = document.createElement("div");
      cfgHolder.id = "apiSportsConfigHolder";
      document.body.appendChild(cfgHolder);
   }

   cfgHolder.innerHTML = `
    <api-sports-widget
      data-type="config"
      data-key="14108d2decc4cfb2cb970d4e9f28d479"
      data-sport="football"
      data-show-logos="true"
      data-favorite="true"
      data-theme="dark"
      data-refresh="15">
    </api-sports-widget>
  `;

   widgetsBootstrapped = true;
}

function renderTab(tab) {
   const container = document.getElementById("leaguesWidgetContainer");
   if (!container) return;

   // swap only the content widget
   if (tab === "live") {
      container.innerHTML = `
      <api-sports-widget data-type="games" data-target-game="modal"></api-sports-widget>
    `;
      return;
   }

   if (tab === "standings") {
      container.innerHTML = `
      <api-sports-widget data-type="standings"></api-sports-widget>
   `;
      return;
   }

   // fallback
   container.innerHTML = `<div>Unknown tab</div>`;
}

function setActiveTab(tab) {
   currentTab = tab;

   // UI active state
   document.querySelectorAll(".liveTabBtn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
   });

   // render tab content
   renderTab(tab);
}

// When leaving Live page, we want next open to send request again.
// ✅ We reset tab content + allow re-render on next open.
function resetLiveWidgets() {
   const container = document.getElementById("leaguesWidgetContainer");
   if (container) container.innerHTML = "";

   // IMPORTANT:
   // We keep config injected (it doesn't cost requests frequently),
   // BUT if you want FULL reset including config, set widgetsBootstrapped=false and clear holder.
   // widgetsBootstrapped = false;
}

function initLiveTabsOnce() {
   const livePage = document.getElementById("liveDataPage");
   if (!livePage) return;

   // Event delegation (only bind once)
   if (livePage.dataset.tabsBound === "1") return;
   livePage.dataset.tabsBound = "1";

   livePage.addEventListener("click", (e) => {
      const btn = e.target.closest(".liveTabBtn");
      if (!btn) return;
      setActiveTab(btn.dataset.tab);
   });
}






function observeWidgetTabsSafe() {
   const root = document.getElementById("liveDataPage") || document.body;

   let scheduled = false;
   let observer = null;

   const schedule = () => {
      if (scheduled) return;
      scheduled = true;

      requestAnimationFrame(() => {
         scheduled = false;

         if (observer) observer.disconnect();
         try {
            reorderAndSelectTabs();
         } finally {
            observer.observe(root, { childList: true, subtree: true });
         }
      });
   };

   observer = new MutationObserver(schedule);
   observer.observe(root, { childList: true, subtree: true });

   // Run once immediately
   schedule();
}

function reorderAndSelectTabs() {
   const scope = document.getElementById("liveDataPage") || document.body;

   // If you have multiple widgets, narrow this selector to your container:
   // const widget = document.getElementById("leaguesWidgetContainer")?.querySelector("api-sports-widget");
   const widget = scope.querySelector("api-sports-widget");
   if (!widget) return;

   const allBtn = widget.querySelector('[data-action="all"]');
   const liveBtn = widget.querySelector('[data-action="live"]');
   const finishedBtn = widget.querySelector('[data-action="finished"]');
   const scheduledBtn = widget.querySelector('[data-action="scheduled"]');

   // Need at least ALL to do anything meaningful
   if (!allBtn) return;

   const parent = (liveBtn || allBtn).parentElement;
   if (!parent) return;

   // 1) Reorder (only if LIVE exists)
   const desiredOrder = liveBtn
      ? [liveBtn, allBtn, finishedBtn, scheduledBtn].filter(Boolean) // LIVE | ALL | FINISHED
      : [allBtn, finishedBtn, scheduledBtn].filter(Boolean);         // ALL | FINISHED (LIVE missing)

   // Avoid reordering if already correct
   const current = Array.from(parent.children);
   const same =
      current.length === desiredOrder.length &&
      current.every((n, i) => n === desiredOrder[i]);

   if (!same) {
      parent.replaceChildren(...desiredOrder);
   }

   // 2) Make default selected: LIVE if exists else ALL
   const preferred = liveBtn || allBtn;

   // If it's already selected, do nothing
   const alreadyActive =
      preferred.classList.contains("active") ||
      preferred.getAttribute("aria-selected") === "true";

   if (!alreadyActive) {
      // Remove selection from siblings (safe)
      parent.querySelectorAll(".active").forEach((el) => el.classList.remove("active"));
      parent.querySelectorAll('[aria-selected="true"]').forEach((el) => el.setAttribute("aria-selected", "false"));

      // Apply selection
      preferred.classList.add("active");
      preferred.setAttribute("aria-selected", "true");

      // Optional: trigger the real click so widget actually switches the data
      // (Recommended, because "active" may be visual only depending on widget implementation)
      preferred.click();
   }
}



// Translations 
const widgetTranslations = {
   "No games available for this date.": (t) => t.live_empty_games,
   "Live": (t) => t.live_direct_games,
   "All": (t) => t.live_all_games,
   "Finished": (t) => t.live_finished_games,
   "Scheduled": (t) => t.live_scheduled_games,
};

function translateWidgetTexts() {
   const t = langMap[currentLang];
   if (!t) return;

   // 1) Empty states
   document.querySelectorAll(".empty-result").forEach((el) => {
      const original = (el.textContent || "").trim();
      const fn = widgetTranslations[original];
      if (!fn) return;

      const translated = fn(t);
      if (translated && el.textContent !== translated) el.textContent = translated;
   });

   // 2) Widget tabs/buttons (Live / All / Finished / Scheduled)
   document
      .querySelectorAll('api-sports-widget button.btn-widget-link[data-action]')
      .forEach((btn) => {
         const original = (btn.textContent || "").trim();
         const fn = widgetTranslations[original];
         if (!fn) return;

         const translated = fn(t);
         if (translated && btn.textContent !== translated) btn.textContent = translated;
      });
}

let widgetTranslationObserverStarted = false;

function initWidgetTranslationObserver() {
   if (widgetTranslationObserverStarted) return;
   widgetTranslationObserverStarted = true;

   const root = document.getElementById("liveDataPage") || document.body;

   const observer = new MutationObserver(() => {
      translateWidgetTexts();
   });

   observer.observe(root, {
      childList: true,
      subtree: true,
   });

   // ✅ run immediately (page refresh)
   translateWidgetTexts();

   // ✅ run again after widget async render
   requestAnimationFrame(translateWidgetTexts);
   setTimeout(translateWidgetTexts, 300);
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

         setHomeOptionsVisible(false);
         setCustomCompetitionVisible(false);
         document.getElementById("homePage").style.display = "none";

         setLiveDataVisible(true);

         // tabs init + config once
         initLiveTabsOnce();
         ensureConfigWidget();
         observeWidgetTabsSafe();

         // Translations
         initWidgetTranslationObserver();
         translateWidgetTexts();

         // default tab each time you open (or keep last tab if you want)
         setActiveTab("live");
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
         setLiveDataVisible(false);

         // ✅ so next open → widget re-created → request sent again
         resetLiveWidgets();

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
   const backBtn = document.getElementById("bannerBackBtn");
   backBtn.textContent = translation.backButton;

   backBtn.addEventListener("click", async () => {
      setCustomCompetitionVisible(false);
      setHomeOptionsVisible(true);
   });

}