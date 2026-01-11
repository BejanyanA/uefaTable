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

   if (tab === "matches") {
      container.innerHTML = `
    <div class="matchesLayout">

      <!-- LEFT: Countries/Competitions list -->
      <div class="matchesLeft" id="matchesList"></div>

      <!-- RIGHT: Matches data -->
      <div class="matchesRight">
        <div class="matchesTitle" id="matchesTitle">
          <img id="matchesTitleLogo" class="matchesTitleLogo" alt="">
          <span id="matchesTitleText">Matches</span>
        </div>

        <div id="matchesWidgetHost"></div>
      </div>

    </div>
  `;

      renderMatchesMenu();          // builds left list (with dropdowns)
      initMatchesMenuClickOnce();   // binds clicks once
      openDefaultMatches();         // loads default league
      injectMatchesLogos();         // optional: uses /league-logos like standings
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




//// Standings
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





//// Matches
const DEFAULT_MATCH_LEAGUE = {
   leagueId: "140",           // La Liga (API-Football)
   leagueTitle: "La Liga",
   logoName: "La Liga",
};

const MATCHES_MENU = [
   {
      key: "spain",
      title: "Spain",
      logoLeagueName: "La Liga",
      options: [
         {
            title: "La Liga",
            leagueId: 140,
            logoName: "La Liga",
         },
         {
            title: "Super Cup",
            leagueId: 556,
            logoName: "Spain Super Cup",
         },
         {
            title: "Copa del Rey",
            leagueId: 143,
            logoName: "Copa del Rey",
         },
      ],
   },
   {
      key: "england",
      title: "England",
      logoLeagueName: "Premier League",
      options: [
         {
            title: "Premier League",
            leagueId: 39,
            logoName: "Premier League",
         },
         {
            title: "Community Shield",
            leagueId: 528,
            logoName: "Community Shield",
         },
         {
            title: "FA Cup",
            leagueId: 45,
            logoName: "FA Cup",
         },
      ],
   },
   {
      key: "france",
      title: "France",
      logoLeagueName: "Ligue 1",
      options: [
         {
            title: "Ligue 1",
            leagueId: 61,
            logoName: "Ligue 1",
         },
         {
            title: "Trophée des Champions",
            leagueId: 526,
            logoName: "Trophée des Champions",
         },
         {
            title: "Coupe de France",
            leagueId: 66,
            logoName: "Coupe de France",
         },
      ],
   },
   {
      key: "italy",
      title: "Italy",
      logoLeagueName: "Serie A",
      options: [
         {
            title: "Serie A",
            leagueId: 135,
            logoName: "Serie A",
         },
         {
            title: "Super Cup",
            leagueId: 547,
            logoName: "Italy Super Cup",
         },
         {
            title: "Coppa Italia",
            leagueId: 137,
            logoName: "Coppa Italia",
         },
      ],
   },
   {
      key: "germany",
      title: "Germany",
      logoLeagueName: "Bundesliga",
      options: [
         {
            title: "Bundesliga",
            leagueId: 78,
            logoName: "Bundesliga",
         },
         {
            title: "Super Cup",
            leagueId: 529,
            logoName: "Germany Super Cup",
         },
         {
            title: "DFB Pokal",
            leagueId: 81,
            logoName: "DFB Pokal",
         },
      ],
   },
   {
      key: "netherlands",
      title: "Netherlands",
      logoLeagueName: "Eredivisie",
      options: [
         {
            title: "Eredivisie",
            leagueId: 88,
            logoName: "Eredivisie",
         },
         {
            title: "Super Cup",
            leagueId: 543,
            logoName: "Johan Cruyff Shield",
         },
         {
            title: "KNVB Beker",
            leagueId: 90,
            logoName: "KNVB Beker",
         },
      ],
   },

   // ✅ Singles (no dropdown)
   {
      key: "ucl",
      title: "Champions League",
      leagueId: 2,
      logoName: "Champions League",
   },
   {
      key: "uel",
      title: "Europa League",
      leagueId: 3,
      logoName: "Europa League",
   },
   {
      key: "uecl",
      title: "Conference League",
      leagueId: 4,
      logoName: "Conference League",
   },
];



function renderMatchesMenu() {
   const list = document.getElementById("matchesList");
   if (!list) return;

   const html = MATCHES_MENU.map((item) => {
      // Dropdown (country -> 2 options)
      if (item.options?.length) {
         return `
        <div class="matchMenuGroup" data-key="${item.key}">
          <button class="matchMenuParentBtn" type="button" data-action="toggle">
            <span class="matchMenuParentText">${item.title}</span>
            <span class="matchMenuChevron">▾</span>
          </button>

          <div class="matchMenuChildren" style="display:none;">
            ${item.options
               .map(
                  (opt) => `
                <button
                  class="matchMenuChildBtn"
                  type="button"
                  data-action="open"
                  data-league-id="${opt.leagueId}"
                  data-league-title="${opt.title}"
                  data-logo-name="${opt.logoName || opt.title}"
                >
                  ${opt.title}
                </button>
              `
               )
               .join("")}
          </div>
        </div>
      `;
      }

      // Single item (no dropdown)
      return `
      <button
        class="matchMenuSingleBtn"
        type="button"
        data-action="open"
        data-league-id="${item.leagueId}"
        data-league-title="${item.title}"
        data-logo-name="${item.logoLeagueName || item.title}"
      >
        ${item.title}
      </button>
    `;
   }).join("");

   list.innerHTML = html;
}


let matchesMenuBound = false;

function initMatchesMenuClickOnce() {
   if (matchesMenuBound) return;
   matchesMenuBound = true;

   document.addEventListener("click", (e) => {
      // Toggle dropdown
      const parentBtn = e.target.closest(".matchMenuParentBtn");
      if (parentBtn) {
         const group = parentBtn.closest(".matchMenuGroup");
         const children = group?.querySelector(".matchMenuChildren");
         if (!children) return;

         const isOpen = children.style.display === "block";
         closeAllMatchDropdowns(group); // ✅ close others

         children.style.display = isOpen ? "none" : "block";
         return;
      }

      // Open matches
      const openBtn = e.target.closest('[data-action="open"]');
      if (!openBtn) return;

      const clickedInsideDropdown = !!openBtn.closest(".matchMenuChildren");
      if (!clickedInsideDropdown) closeAllMatchDropdowns();

      const leagueId = openBtn.dataset.leagueId;
      const leagueTitle = openBtn.dataset.leagueTitle || "Matches";
      const logoName = openBtn.dataset.logoName || leagueTitle;

      // prevent reloading same selection
      if (openBtn.classList.contains("active")) return;

      // active state (only within matches left)
      document.querySelectorAll(".matchMenuChildBtn, .matchMenuSingleBtn").forEach((b) => {
         b.classList.remove("active");
      });
      openBtn.classList.add("active");

      renderMatchesWidget(leagueId, leagueTitle, logoName);
   });
}


function renderMatchesWidget(leagueId, leagueTitle, logoName) {
   const host = document.getElementById("matchesWidgetHost");
   if (!host) return;

   // Title
   updateMatchesTitle(leagueTitle, logoName);

   // Widget
   const season = getCurrentSeasonYear();
   host.innerHTML = `
      <api-sports-widget
        data-type="games"
        data-target-game="modal"
        data-games-style="2"
        data-refresh="15"
        data-league="${leagueId}"
        data-show-toolbar="true"
        data-tab="all"
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

}


async function updateMatchesTitle(title, logoLeagueName) {
   const text = document.getElementById("matchesTitleText");
   const logo = document.getElementById("matchesTitleLogo");

   if (text) text.textContent = title;

   const logos = await loadLeagueLogos(); // from your existing /league-logos logic
   const url = logos?.[(logoLeagueName || title).toLowerCase()];

   if (logo) {
      if (url) {
         logo.src = url;
         logo.alt = title;
         logo.style.display = "block";
      } else {
         logo.style.display = "none";
      }
   }
}

async function injectMatchesLogos() {
   const logos = await loadLeagueLogos();
   if (!logos) return;

   document.querySelectorAll(".matchMenuSingleBtn").forEach((btn) => {
      const name = (btn.dataset.logoName || btn.textContent || "").trim().toLowerCase();
      const url = logos[name];
      if (!url) return;
      if (btn.querySelector("img.matchLogo")) return;

      const img = document.createElement("img");
      img.className = "matchLogo";
      img.src = url;
      img.alt = name;
      btn.prepend(img);
   });
}

function openDefaultMatches() {
   // 1️⃣ Try to find Spain → La Liga button explicitly
   const defaultBtn = document.querySelector(
      '.matchMenuChildBtn[data-league-id="' + DEFAULT_MATCH_LEAGUE.leagueId + '"]'
   );

   if (defaultBtn) {
      defaultBtn.classList.add("active");

      renderMatchesWidget(
         DEFAULT_MATCH_LEAGUE.leagueId,
         DEFAULT_MATCH_LEAGUE.leagueTitle,
         DEFAULT_MATCH_LEAGUE.logoName
      );

      // Ensure parent dropdown (Spain) is open
      const group = defaultBtn.closest(".matchMenuGroup");
      const children = group?.querySelector(".matchMenuChildren");
      if (children) children.style.display = "block";

      return;
   }

   // 2️⃣ Fallback (in case something changes)
   const fallback =
      document.querySelector(".matchMenuChildBtn") ||
      document.querySelector(".matchMenuSingleBtn");

   if (!fallback) return;

   fallback.classList.add("active");
   renderMatchesWidget(
      fallback.dataset.leagueId,
      fallback.dataset.leagueTitle || fallback.textContent.trim(),
      fallback.dataset.logoName || fallback.textContent.trim()
   );
}

function closeAllMatchDropdowns(exceptGroup = null) {
   document.querySelectorAll(".matchMenuGroup .matchMenuChildren").forEach((el) => {
      if (exceptGroup && exceptGroup.contains(el)) return;
      el.style.display = "none";
   });
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