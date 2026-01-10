import { langMap, currentLang } from "./LanguageManager.js";
import { apiGet } from "../services/api.js";

let widgetsBootstrapped = false;
let currentTab = "allGames";
const API_KEY = "14108d2decc4cfb2cb970d4e9f28d479";
let leagueLogosMap = null;

// ---------- logos ----------
async function loadLeagueLogos() {
   if (leagueLogosMap) return leagueLogosMap;

   try {
      const res = await apiGet("/league-logos");
      if (!res?.success || !res?.data?.clubs) return {};

      leagueLogosMap = {};
      res.data.clubs.forEach((club) => {
         leagueLogosMap[club.league_name.toLowerCase()] = club.logo_url;
      });

      return leagueLogosMap;
   } catch (err) {
      console.error("Failed to load league logos", err);
      return {};
   }
}

async function injectLeagueLogos() {
   const logos = await loadLeagueLogos();
   if (!logos) return;

   document.querySelectorAll(".standingsLeagueBtn").forEach((btn) => {
      const nameEl = btn.querySelector(".leagueName");
      if (!nameEl) return;

      const leagueName = nameEl.textContent.trim().toLowerCase();
      const logoUrl = logos[leagueName];
      if (!logoUrl) return;

      // Prevent duplicate logos
      if (btn.querySelector("img.leagueLogo")) return;

      const img = document.createElement("img");
      img.className = "leagueLogo";
      img.src = logoUrl;
      img.alt = leagueName;

      btn.prepend(img);
   });
}

async function updateStandingsTitle(leagueName) {
   const title = document.getElementById("standingsTitle");
   if (!title) return;

   // Ensure text span exists
   let titleText = document.getElementById("standingsTitleText");
   if (!titleText) {
      titleText = document.createElement("span");
      titleText.id = "standingsTitleText";
      title.appendChild(titleText);
   }

   // Ensure logo img exists
   let titleLogo = document.getElementById("standingsTitleLogo");
   if (!titleLogo) {
      titleLogo = document.createElement("img");
      titleLogo.id = "standingsTitleLogo";
      titleLogo.className = "standingsTitleLogo";
      titleLogo.alt = "";
      title.prepend(titleLogo);
   }

   const logos = await loadLeagueLogos();
   const logoUrl = logos?.[leagueName.toLowerCase()];

   if (logoUrl) {
      titleLogo.src = logoUrl;
      titleLogo.alt = leagueName;
      titleLogo.style.display = "block";
   } else {
      titleLogo.style.display = "none";
   }
}






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

   if (tab === "allGames") {
      container.innerHTML = `
      <api-sports-widget
        data-type="games"
        data-target-game="modal"
        data-games-style="2"
        data-refresh="15"
        data-show-toolbar="true"
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

        <button class="standingsLeagueBtn active" type="button" data-league-id="2">
          <span class="leagueName">Champions League</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="140">
          <span class="leagueName">La Liga</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="39">
          <span class="leagueName">Premier League</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="61">
          <span class="leagueName">Ligue 1</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="135">
          <span class="leagueName">Serie A</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="78">
          <span class="leagueName">Bundesliga</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="88">
          <span class="leagueName">Eredivisie</span>
        </button>
        
        <button class="standingsLeagueBtn" type="button" data-league-id="3">
          <span class="leagueName">Europa League</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="1">
          <span class="leagueName">FIFA World Cup</span>
        </button>
        
        <button class="standingsLeagueBtn" type="button" data-league-id="5">
          <span class="leagueName">EURO</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="4">
          <span class="leagueName">Conference League</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="6">
          <span class="leagueName">Nations League</span>
        </button>



      </div>

      <!-- RIGHT: standings data -->
      <div class="standingsRight" id="standingsDataPane">
        <div class="standingsTitle" id="standingsTitle">
         <img id="standingsTitleLogo" class="standingsTitleLogo" alt="">
         <span id="standingsTitleText">Champions League</span>
        </div>


        <div id="standingsWidgetHost"></div>
      </div>

    </div>
  `;

      initStandingsPickerOnce();     // bind click once
      loadStandingsWidgetOnce();     // load default selected league
      injectLeagueLogos();
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

   updateStandingsTitle(leagueName);

   // Remove "Goals For : Against"
   removeColumnsByHeaders(host, [
      'th[data-title="Goals For : Against"]',
      'th[data-title="Last 5 games"]',
      'th[data-title="Form"]',
      'th[data-title="FORM"]',
   ]);
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



function removeColumnsByHeaders(scopeRoot, headerSelectors) {
   if (!scopeRoot) return;

   const apply = () => {
      const table = scopeRoot.querySelector("table");
      if (!table) return false;

      const headers = Array.from(table.querySelectorAll("th"))
         .filter((th) => headerSelectors.some((sel) => th.matches(sel)));

      if (!headers.length) return false;

      const indexes = [...new Set(
         headers.map((th) => Array.from(th.parentElement.children).indexOf(th))
      )].sort((a, b) => b - a);

      indexes.forEach((idx) => {
         table.querySelectorAll("tr").forEach((tr) => {
            const cell = tr.children[idx];
            if (cell) cell.remove();
         });
      });

      return true;
   };

   // Try now
   if (apply()) return;

   // Observe until content appears
   const obs = new MutationObserver(() => {
      if (apply()) obs.disconnect();
   });

   obs.observe(scopeRoot, { childList: true, subtree: true });

   setTimeout(apply, 300);
   setTimeout(apply, 800);
   setTimeout(apply, 1500);
}




// ---------- translations ----------
const widgetTranslations = {
   "No games available for this date.": (t) => t.live_empty_games,
   "Live": (t) => t.live_direct_games,
   "All": (t) => t.live_all_games,
   "Home": (t) => t.live_home_games,
   "Away": (t) => t.live_away_games,
   "Finished": (t) => t.live_finished_games,
   "Scheduled": (t) => t.live_scheduled_games,
   "No standings available for this league.": (t) => t.live_empty_standings,
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

   setActiveTab("allGames");
}

export function closeLiveData() {
   setLiveDataVisible(false);
   resetLiveWidgets(); // so next open -> widget recreated -> request sent again
}