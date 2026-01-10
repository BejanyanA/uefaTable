import { langMap, currentLang } from "./LanguageManager.js";

let widgetsBootstrapped = false;
let currentTab = "live";
const API_KEY = "14108d2decc4cfb2cb970d4e9f28d479";

// ---------- visibility ----------
function setLiveDataVisible(isVisible) {
   const livePage = document.getElementById("liveDataPage");
   if (!livePage) return;
   livePage.style.display = isVisible ? "block" : "none";
}

// ---------- widgets ----------
function ensureConfigWidget() {
   if (widgetsBootstrapped) return;

   // If you still want a config holder, keep it
   let cfgHolder = document.getElementById("apiSportsConfigHolder");
   if (!cfgHolder) {
      cfgHolder = document.createElement("div");
      cfgHolder.id = "apiSportsConfigHolder";
      document.body.appendChild(cfgHolder);
   }

   widgetsBootstrapped = true;
}

function renderTab(tab) {
   const container = document.getElementById("leaguesWidgetContainer");
   if (!container) return;

   if (tab === "live") {
      container.innerHTML = `
      <api-sports-widget
        data-type="games"
        data-target-game="modal"
        data-games-style="2"
        data-refresh="15"
        data-show-toolbar="false"
        data-tab="live"
      ></api-sports-widget>

      <api-sports-widget
        data-type="config"
        data-key="${API_KEY}"
        data-sport="football"
        data-lang="en"
        data-theme="dark"
        data-show-logos="true"
        data-favorite="false"
      ></api-sports-widget>
    `;
      return;
   }

   if (tab === "standings") {
      container.innerHTML = `
    <div class="standingsLayout">

      <!-- LEFT: leagues list -->
      <div class="standingsLeft" id="standingsLeaguesList">
        <button class="standingsLeagueBtn active" type="button" data-league-id="140">
          La Liga
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="61">
          Ligue 1
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="39">
          Premier League
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="135">
          Serie A
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="78">
          Bundesliga
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="2">
          Champions League
        </button>
        
        <button class="standingsLeagueBtn" type="button" data-league-id="3">
          Europa League
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="1">
          FIFA World Cup
        </button>
        
        <button class="standingsLeagueBtn" type="button" data-league-id="5">
          EURO
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="4">
          Conference League
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="6">
          Nations League
        </button>





      </div>

      <!-- RIGHT: standings data -->
      <div class="standingsRight" id="standingsDataPane">
        <div class="standingsTitle" id="standingsTitle">UEFA Champions League</div>
        <div id="standingsWidgetHost"></div>
      </div>

    </div>
  `;

      initStandingsPickerOnce();     // bind click once
      loadStandingsWidgetOnce();     // load default selected league
      return;
   }

   container.innerHTML = `<div>Unknown tab</div>`;
}

function setActiveTab(tab) {
   currentTab = tab;

   document.querySelectorAll(".liveTabBtn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
   });

   renderTab(tab);
}

function resetLiveWidgets() {
   const container = document.getElementById("leaguesWidgetContainer");
   if (container) container.innerHTML = "";
}

// ---------- tabs init ----------
function initLiveTabsOnce() {
   const livePage = document.getElementById("liveDataPage");
   if (!livePage) return;

   if (livePage.dataset.tabsBound === "1") return;
   livePage.dataset.tabsBound = "1";

   livePage.addEventListener("click", (e) => {
      const btn = e.target.closest(".liveTabBtn");
      if (!btn) return;
      setActiveTab(btn.dataset.tab);
   });
}


function getCurrentSeasonYear() {
   // Most football seasons: starts around Aug; adjust if you want
   const now = new Date();
   const month = now.getMonth() + 1; // 1-12
   const year = now.getFullYear();
   return month < 7 ? year - 1 : year; // Jan-Jun => previous year
}

function renderStandingsWidget(leagueId, leagueName) {
   const host = document.getElementById("standingsWidgetHost");
   const title = document.getElementById("standingsTitle");
   if (!host) return;

   const season = getCurrentSeasonYear();
   if (title) title.textContent = leagueName;

   // Re-create widget element (most custom elements refresh better this way)
   host.innerHTML = `
      <api-sports-widget
      data-type="standings"
      data-key="${API_KEY}"
      data-league="${leagueId}"
      data-season="${season}"
      data-refresh="15"
      ></api-sports-widget>
      
<!-- Configuration -->
      <api-sports-widget data-type="config"
      data-key="${API_KEY}"
      data-sport="football"
      data-lang="en"
      data-theme="dark"
      data-show-logos="true"
      data-favorite="false"
      ></api-sports-widget>
  `;

   // Remove "Goals For : Against"
   removeColumnByHeader(
      host,
      'th[data-title="Goals For : Against"]'
   );

   // Remove "Form / Last 5 games"
   removeColumnByHeader(
      host,
      'th[data-title="Last 5 games"], th[data-title="Form"], th[data-title="FORM"]'
   );
}

let standingsPickerBound = false;

function initStandingsPickerOnce() {
   if (standingsPickerBound) return;
   standingsPickerBound = true;

   document.addEventListener("click", (e) => {
      const btn = e.target.closest(".standingsLeagueBtn");
      if (!btn) return;

      // ✅ Prevent clicking the already active league
      if (btn.classList.contains("active")) {
         return;
      }

      // Remove active from others
      document.querySelectorAll(".standingsLeagueBtn").forEach((b) => {
         b.classList.remove("active");
      });

      btn.classList.add("active");

      const leagueId = btn.dataset.leagueId;
      const leagueName = btn.textContent.trim();

      renderStandingsWidget(leagueId, leagueName);
   });
}

function loadStandingsWidgetOnce() {
   const first = document.querySelector(".standingsLeagueBtn.active") ||
      document.querySelector(".standingsLeagueBtn");
   if (!first) return;

   renderStandingsWidget(first.dataset.leagueId, (first.textContent || "").trim());
}




function removeColumnByHeader(widgetRoot, headerSelector) {
   if (!widgetRoot) return;

   const apply = () => {
      const header = widgetRoot.querySelector(headerSelector);
      if (!header) return false;

      const index =
         Array.from(header.parentElement.children).indexOf(header);

      // Remove header cell
      header.remove();

      // Remove all td cells in that column
      widgetRoot.querySelectorAll("tr").forEach((tr) => {
         const cell = tr.children[index];
         if (cell) cell.remove();
      });

      return true;
   };

   // Try immediately
   if (apply()) return;

   // Observe until table is rendered
   const obs = new MutationObserver(() => {
      if (apply()) obs.disconnect();
   });

   obs.observe(widgetRoot, { childList: true, subtree: true });

   // Fallback retries
   setTimeout(apply, 300);
   setTimeout(apply, 800);
   setTimeout(apply, 1500);
}





// ---------- translations ----------
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

   document.querySelectorAll(".empty-result").forEach((el) => {
      const original = (el.textContent || "").trim();
      const fn = widgetTranslations[original];
      if (!fn) return;

      const translated = fn(t);
      if (translated && el.textContent !== translated) el.textContent = translated;
   });

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

   observer.observe(root, { childList: true, subtree: true });

   translateWidgetTexts();
   requestAnimationFrame(translateWidgetTexts);
   setTimeout(translateWidgetTexts, 300);
}

// ---------- public API ----------
export function openLiveData() {
   setLiveDataVisible(true);

   initLiveTabsOnce();
   ensureConfigWidget();

   initWidgetTranslationObserver();
   translateWidgetTexts();

   setActiveTab("live");
}

export function closeLiveData() {
   setLiveDataVisible(false);
   resetLiveWidgets(); // so next open -> widget recreated -> request sent again
}