import { langMap, currentLang } from "./LanguageManager.js";
import { apiGet } from "../services/api.js";
import { navigateTo } from "./router.js";

const TAB_TO_ROUTE = { allGames: "live", standings: "live-standings", matches: "live-matches" };

let widgetsBootstrapped = false;
let currentTab = "allGames";
const API_KEY = "14108d2decc4cfb2cb970d4e9f28d479";
let leagueLogosMap = null;

// ---------- logos ----------
let leagueLogosCache = null;
let leagueLogosPromise = null;

const leagueLogos = {
   140: "assets/league_logos/laliga.png",
   39: "assets/league_logos/premierLeague.png",
   61: "assets/league_logos/frenchLigue1.png",
   135: "assets/league_logos/serieA.png",
   78: "assets/league_logos/bundesliga.png",
   88: "assets/league_logos/eredivisie.png",

   2: "assets/league_logos/championsLeague.png",
   3: "assets/league_logos/europaLeague.png",

   1: "assets/league_logos/worldCup.png",
   4: "assets/league_logos/euro.png",
   5: "assets/league_logos/nationsLeague.png",

   21: "assets/league_logos/confederationsCup.png",
};

export async function loadLeagueLogos() {
   // ✅ return cached results
   if (leagueLogosCache) return leagueLogosCache;

   // ✅ if a request is already running, await it (prevents double fetch)
   if (leagueLogosPromise) return leagueLogosPromise;

   leagueLogosPromise = (async () => {
      const res = await apiGet("/league-logos"); // your existing apiGet
      const list = res?.data?.clubs || [];

      // normalize to map: "la liga" -> url
      const map = {};
      list.forEach((x) => {
         if (!x?.league_name || !x?.logo_url) return;
         map[String(x.league_name).trim().toLowerCase()] = x.logo_url;
      });

      leagueLogosCache = map;
      leagueLogosPromise = null;
      return leagueLogosCache;
   })();

   return leagueLogosPromise;
}

// ---------- public API ----------
// The day view: our own screen for the first tab. Loaded only when Live is
// opened, so the home page does not carry it.
let dayViewModule = null;
let matchViewModule = null;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MATCH_RE = /^[A-Za-z0-9_-]{1,40}$/;

// The match open on top of the day view, from the address (?match=).
let openMatch = null; // { id, date, fromList, preview }
// Where the day's list was scrolled to when a match was opened from it.
let listScrollY = 0;

function liveAddress({ date = null, match = null } = {}) {
   const params = new URLSearchParams();
   if (date) params.set("date", date);
   if (match) params.set("match", match);
   const query = params.toString();
   return query ? `live?${query}` : "live";
}

async function showDayView(date, matchId = null) {
   const container = document.getElementById("leaguesWidgetContainer");
   if (!container) return;
   dayViewModule = dayViewModule || await import("../live/views/dayView.js");
   // The visitor may have moved to another tab while the module loaded.
   if (currentTab !== "allGames") return;
   const day = DATE_RE.test(date || "") ? date : null;
   dayViewModule.showDay(container, {
      date: day,
      // The chosen day goes into the address, so Back and shared links work.
      onPickDate: (pick) => navigateTo(liveAddress({ date: pick })),
      // So does an opened match; Back closes it again.
      matchLink: (id, onDate) => `/${currentLang}/${liveAddress({ date: onDate, match: id })}`,
      onOpenMatch: (id, onDate, preview) => {
         listScrollY = currentScrollY();
         openMatch = { id, date: onDate, fromList: true, preview };
         navigateTo(liveAddress({ date: onDate, match: id }));
      },
   });
   await showMatchView(container, MATCH_RE.test(matchId || "") ? matchId : null, day);
}

async function showMatchView(container, matchId, date) {
   if (!matchId) {
      const wasOpen = Boolean(matchViewModule && matchViewModule.isMatchOpen());
      if (matchViewModule) matchViewModule.hideMatch();
      // Back on the day's list where it was left.
      if (wasOpen && openMatch && openMatch.fromList) {
         const y = listScrollY;
         requestAnimationFrame(() => scrollToY(y));
      }
      openMatch = null;
      return;
   }
   // Opened straight from an address (a shared link, a reload).
   if (!openMatch || openMatch.id !== matchId) openMatch = { id: matchId, date, fromList: false };
   matchViewModule = matchViewModule || await import("../live/views/matchView.js");
   if (currentTab !== "allGames" || !openMatch || openMatch.id !== matchId) return;
   matchViewModule.showMatch(container, { id: matchId, preview: openMatch.preview || null });
   scrollToY(0);
}

// Back from a match: to the list it was opened from, or to its day.
function closeMatch() {
   if (!openMatch) return;
   if (openMatch.fromList) history.back();
   else navigateTo(liveAddress({ date: openMatch.date }), { replace: true });
}

// While a match is open, the Live Back buttons (the page's own and the
// arrow in the phone tab bar, which clicks it) close the match instead of
// leaving Live. Escape does the same.
document.addEventListener("click", (e) => {
   if (!openMatch || !e.target.closest || !e.target.closest("#btnBackFromLive")) return;
   e.preventDefault();
   e.stopImmediatePropagation();
   closeMatch();
}, true);
document.addEventListener("keydown", (e) => {
   if (e.key !== "Escape" || !openMatch || e.defaultPrevented) return;
   // An open menu or sheet takes Escape first.
   if (document.querySelector(".lv-menu, .lv-sheet")) return;
   closeMatch();
});

function hideDayView() {
   if (matchViewModule) matchViewModule.hideMatch();
   openMatch = null;
   if (dayViewModule) dayViewModule.hideDay();
}

// The whole site scrolls on one element (the body), so without care Live
// would open where the home page was scrolled to, and the home page would
// come back where Live was. Live starts at its own top, and leaving it puts
// the page you came from back where it was.
const currentScrollY = () => document.body.scrollTop || document.documentElement.scrollTop || window.scrollY || 0;
function scrollToY(y) {
   document.body.scrollTo({ top: y, behavior: "instant" });
   window.scrollTo({ top: y, behavior: "instant" });
}
// Where the last page outside Live was scrolled to. Kept up to date while
// that page is on screen, because by the time Live opens the page has
// already been swapped out.
let liveIsOpen = false;
let outside = { path: location.pathname, y: 0 };
let comeBackTo = null;
document.addEventListener("scroll", () => {
   if (!liveIsOpen) outside = { path: location.pathname, y: currentScrollY() };
}, { passive: true, capture: true });

function enterLiveScroll() {
   if (comeBackTo) return; // only moving between Live tabs
   comeBackTo = outside;
   scrollToY(0);
}

function leaveLiveScroll() {
   // Wait for the next page to be on screen. Moving to another Live tab
   // opens Live again before then, and nothing is restored.
   requestAnimationFrame(() => {
      if (liveIsOpen || !comeBackTo) return;
      const back = comeBackTo;
      comeBackTo = null;
      scrollToY(back.path === location.pathname ? back.y : 0);
   });
}

// The tabs mirrored in the site header once the page is scrolled
// (public/js/live/headerTabs.js). Loaded with Live, not with the home page.
let headerTabs = null;

async function enableHeaderTabs() {
   liveIsOpen = true;
   if (!headerTabs) {
      const page = document.getElementById("liveDataPage");
      const tabs = page && page.querySelector(".liveTabs");
      if (!tabs) return;
      const { mountHeaderTabs } = await import("../live/headerTabs.js");
      headerTabs = mountHeaderTabs({
         page,
         tabs,
         back: document.getElementById("btnBackFromLive"),
         content: document.getElementById("leaguesWidgetContainer"),
      });
   }
   // Live may have been closed again while the module was loading.
   if (headerTabs) headerTabs.setEnabled(liveIsOpen);
}

function disableHeaderTabs() {
   liveIsOpen = false;
   if (headerTabs) headerTabs.setEnabled(false);
}

export async function openLiveData(tab = "allGames", { date = null, match = null } = {}) {
   setLiveDataVisible(true);
   // The styles lay the page out a little differently for our own day view.
   const livePage = document.getElementById("liveDataPage");
   if (livePage) livePage.dataset.liveTab = tab;
   enterLiveScroll();
   document.body.classList.add("live-open");
   enableHeaderTabs();

   if (tab === "allGames") {
      initLiveTabsOnce();
      currentTab = tab;
      document.querySelectorAll(".liveTabBtn").forEach((btn) => {
         btn.classList.toggle("active", btn.dataset.tab === tab);
      });
      await showDayView(date, match);
      return;
   }

   hideDayView();
   await loadApiSportsWidgetsOnce();

   initLiveTabsOnce();

   setActiveTab(tab);

   await new Promise(requestAnimationFrame);

   ensureConfigWidget();
   remountApiSportsWidgets();

   initPopupTranslationHooks();
   translateWidgetTexts();
   // initApiSportsModalX();
}

export function closeLiveData() {
   setLiveDataVisible(false);
   disableHeaderTabs();
   document.body.classList.remove("live-open");
   leaveLiveScroll();
   hideDayView();
   resetLiveWidgets(); // so next open -> widget recreated -> request sent again
}

async function injectLeagueLogos() {
   document.querySelectorAll(".standingsLeagueBtn").forEach((btn) => {
      const leagueId = btn.dataset.leagueId;
      const logoUrl = leagueLogos[leagueId];

      if (!logoUrl) return;
      if (btn.querySelector("img.leagueLogo")) return;

      const img = document.createElement("img");
      img.className = "leagueLogo";
      img.src = logoUrl;
      img.alt = "";

      btn.prepend(img);
   });
}

async function updateStandingsTitle(leagueName, leagueId) {
   const title = document.getElementById("standingsTitle");
   if (!title) return;

   let titleText = document.getElementById("standingsTitleText");
   if (!titleText) {
      titleText = document.createElement("span");
      titleText.id = "standingsTitleText";
      title.appendChild(titleText);
   }

   let titleLogo = document.getElementById("standingsTitleLogo");
   if (!titleLogo) {
      titleLogo = document.createElement("img");
      titleLogo.id = "standingsTitleLogo";
      titleLogo.className = "standingsTitleLogo";
      titleLogo.alt = "";
      title.prepend(titleLogo);
   }

   titleText.textContent = leagueName;

   const logos = await loadLeagueLogos();

   // use ID instead of text
   const logoUrl = leagueLogos[leagueId];

   if (logoUrl) {
      titleLogo.src = logoUrl;
      titleLogo.alt = leagueName;
      titleLogo.style.display = "block";
   } else {
      titleLogo.style.display = "none";
   }
}

async function updateMatchesTitle(title, logoName) {
   const text = document.getElementById("matchesTitleText");
   const logo = document.getElementById("matchesTitleLogo");

   if (text) text.textContent = title;

   const logos = await loadLeagueLogos();
   const url = logos?.[(logoName || title).toLowerCase()];

   if (!logo) return;

   if (url) {
      logo.src = url;
      logo.alt = title;
      logo.style.display = "block";
   } else {
      logo.style.display = "none";
   }
}

async function injectMatchesLogos() {
   const logos = await loadLeagueLogos();
   if (!logos) return;

   const applyToBtn = (btn) => {
      const logoName =
         (btn.dataset.logoName || btn.querySelector(".matchBtnText")?.textContent || btn.textContent || "")
            .trim()
            .toLowerCase();

      const url = logos[logoName];
      if (!url) return;

      if (btn.querySelector("img.matchLogo")) return;

      const img = document.createElement("img");
      img.className = "matchLogo";
      img.src = url;
      img.alt = logoName;

      btn.prepend(img);
   };

   // ✅ Singles
   document.querySelectorAll(".matchMenuSingleBtn").forEach(applyToBtn);

   // ✅ Dropdown children
   document.querySelectorAll(".matchMenuChildBtn").forEach(applyToBtn);

   // ✅ Dropdown parents (Spain/England/etc.)
   document.querySelectorAll(".matchMenuParentBtn").forEach(applyToBtn);
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
      // The day view is our own screen (public/js/live); openLiveData mounts it.
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

        <button class="standingsLeagueBtn" type="button" data-league-id="140">
          <span class="leagueName">La Liga</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="3">
          <span class="leagueName">Europa League</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="1">
          <span class="leagueName">FIFA World Cup</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="4">
          <span class="leagueName">EURO</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="21">
          <span class="leagueName">Confederations Cup</span>
        </button>

        <button class="standingsLeagueBtn" type="button" data-league-id="5">
          <span class="leagueName">Nations League</span>
        </button>



      </div>

      <!-- RIGHT: standings data -->
      <div class="standingsRight" id="standingsDataPane">




        <div id="standingsWidgetHost"></div>
      </div>

    </div>
  `;

      // <div class="standingsRight" id="standingsDataPane">
      //   <div class="standingsTitle" id="standingsTitle">
      //    <img id="standingsTitleLogo" class="standingsTitleLogo" alt="">
      //    <span id="standingsTitleText">Champions League</span>
      //   </div>

      //     <div id="standingsWidgetHost"></div>
      // </div>

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
      navigateTo(TAB_TO_ROUTE[btn.dataset.tab] || "live");
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

   const currentYearLeagues = ["1", "4", "5", "6"];

   const season = currentYearLeagues.includes(String(leagueId))
      ? new Date().getFullYear()
      : getCurrentSeasonYear();
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
   watchWidgetHost(host, 5000, "standings");
   updateStandingsTitle(leagueName, leagueId);

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
      const tables = scopeRoot.querySelectorAll("table");
      if (!tables.length) return false;

      let removedAny = false;

      tables.forEach((table) => {
         const headers = Array.from(table.querySelectorAll("th"))
            .filter((th) => headerSelectors.some((sel) => th.matches(sel)));

         if (!headers.length) return;

         const indexes = [...new Set(
            headers.map((th) => Array.from(th.parentElement.children).indexOf(th))
         )].sort((a, b) => b - a);

         indexes.forEach((idx) => {
            table.querySelectorAll("tr").forEach((tr) => {
               const cell = tr.children[idx];
               if (cell) cell.remove();
            });
         });

         removedAny = true;
      });

      return removedAny;
   };

   if (apply()) return;

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
   leagueId: "2",
   leagueTitle: "Champions League",
   logoUrl: "assets/league_logos/championsLeague.png",
};

const MATCHES_MENU = [
   { key: "ucl", title: "Champions League", leagueId: 2, logoUrl: "assets/league_logos/championsLeague.png" },
   {
      key: "spain",
      title: "Spain",
      logoLeagueName: "Spain",
      options: [
         { title: "La Liga", leagueId: 140, logoUrl: "assets/league_logos/laliga.png" },
         { title: "Super Cup", leagueId: 556, logoUrl: "assets/league_logos/spanishSuperCup.png" },
         { title: "Copa del Rey", leagueId: 143, logoUrl: "assets/league_logos/copaDelRey.png" },
      ],
   },
   {
      key: "england",
      title: "England",
      logoLeagueName: "England",
      options: [
         { title: "Premier League", leagueId: 39, logoUrl: "assets/league_logos/premierLeague.png" },
         { title: "Community Shield", leagueId: 528, logoUrl: "assets/league_logos/communityShield.png" },
         { title: "FA Cup", leagueId: 45, logoUrl: "assets/league_logos/faCup.png" },
      ],
   },
   {
      key: "france",
      title: "France",
      logoLeagueName: "France",
      options: [
         { title: "Ligue 1", leagueId: 61, logoUrl: "assets/league_logos/frenchLigue1.png" },
         { title: "Trophée des Champions", leagueId: 526, logoUrl: "assets/league_logos/tropheeDesChampions.png" },
         { title: "Coupe de France", leagueId: 66, logoUrl: "assets/league_logos/coupeDeFrance.png" },
      ],
   },
   {
      key: "italy",
      title: "Italy",
      logoLeagueName: "Italy",
      options: [
         { title: "Serie A", leagueId: 135, logoUrl: "assets/league_logos/serieA.png" },
         { title: "Super Cup", leagueId: 547, logoUrl: "assets/league_logos/italianSuperCup.png" },
         { title: "Coppa Italia", leagueId: 137, logoUrl: "assets/league_logos/coppaItalia.png" },
      ],
   },
   {
      key: "germany",
      title: "Germany",
      logoLeagueName: "Germany",
      options: [
         { title: "Bundesliga", leagueId: 78, logoUrl: "assets/league_logos/bundesliga.png" },
         { title: "Super Cup", leagueId: 529, logoUrl: "assets/league_logos/germanySuperCup.png" },
         { title: "DFB Pokal", leagueId: 81, logoUrl: "assets/league_logos/germanyDfbCup.png" },
      ],
   },
   {
      key: "netherlands",
      title: "Netherlands",
      logoLeagueName: "Netherlands",
      options: [
         { title: "Eredivisie", leagueId: 88, logoUrl: "assets/league_logos/eredivisie.png" },
         { title: "Super Cup", leagueId: 543, logoUrl: "assets/league_logos/nethSuperCup.png" },
         { title: "KNVB Beker", leagueId: 90, logoUrl: "assets/league_logos/knvbBeker.png" },
      ],
   },
   { key: "uel", title: "Europa League", leagueId: 3, logoUrl: "assets/league_logos/europaLeague.png" },
   { key: "worldcup", title: "World Cup", leagueId: 1, logoUrl: "assets/league_logos/worldCup.png" },
   { key: "uecl", title: "EURO", leagueId: 4, logoUrl: "assets/league_logos/euro.png" },
   { key: "uecl", title: "Confederations Cup", leagueId: 21, logoUrl: "assets/league_logos/confederationsCup.png" },
   { key: "uecl", title: "Nations League", leagueId: 5, logoUrl: "assets/league_logos/nationsLeague.png" },
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

  <div class="matchMenuParentLeft">
    <img
      class="matchLogo"
      src="assets/country_logos/${item.logoLeagueName}.png"
      alt="${item.title}"
    >

    <span class="matchMenuParentText">${item.title}</span>
  </div>

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
  data-logo-url="${opt.logoUrl || ""}"
>
  ${opt.logoUrl ? `<img class="matchLogo" src="${opt.logoUrl}" alt="">` : ""}
  <span>${opt.title}</span>
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
  data-logo-url="${item.logoUrl || ""}"
>
  ${item.logoUrl ? `<img class="matchLogo" src="${item.logoUrl}" alt="">` : ""}
  <span>${item.title}</span>
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

   watchWidgetHost(host, 5000, "matches");
}

function openDefaultMatches() {
   // 1️⃣ Try to find the default flat league button (Champions League) explicitly
   const defaultBtn = document.querySelector(
      '.matchMenuSingleBtn[data-league-id="' + DEFAULT_MATCH_LEAGUE.leagueId + '"]'
   );

   if (defaultBtn) {
      defaultBtn.classList.add("active");

      renderMatchesWidget(
         DEFAULT_MATCH_LEAGUE.leagueId,
         DEFAULT_MATCH_LEAGUE.leagueTitle,
         DEFAULT_MATCH_LEAGUE.logoName
      );

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
   "Live": (t) => t.live_direct_games,
   "All": (t) => t.live_all_games,
   "Home": (t) => t.live_home_games,
   "Away": (t) => t.live_away_games,
   "Finished": (t) => t.live_finished_games,
   "Scheduled": (t) => t.live_scheduled_games,
   // NOTE: standings AND matches empties are handled by translateEmptyResults()
   // in LanguageManager.js — for the leagues we show, an empty result from
   // either widget always means a load failure, so it renders "Data is
   // currently unavailable" rather than a "no standings/matches" message. Don't
   // map those empty strings here or the two translators fight over the element.
};

function setActionButtonLabelGlobal(action, translatedText) {
   const buttons = document.querySelectorAll(
      `button.btn-widget-link[data-action="${action}"]`
   );

   let changed = false;

   buttons.forEach((btn) => {
      // Create label span once
      let label = btn.querySelector(":scope > span.btnLabel");
      if (!label) {
         label = document.createElement("span");
         label.className = "btnLabel";
         btn.appendChild(label);
      }

      // Update label text
      if (label.textContent !== translatedText) {
         label.textContent = translatedText;
         changed = true;
      }

      // Remove only loose text nodes (keep SVG)
      Array.from(btn.childNodes).forEach((node) => {
         if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            node.textContent = " ";
         }
      });
   });

   return changed;
}

function translatePopupActionsNow() {
   const t = langMap[currentLang] || {};

   setActionButtonLabelGlobal("events", t.live_events || "Events");
   setActionButtonLabelGlobal("statistics", t.live_statistics || "Statistics");
   setActionButtonLabelGlobal("lineups", t.live_lineups || "Lineups");
}

// Fast burst translator for async popup rendering
function burstTranslatePopupActions(durationMs = 1500, intervalMs = 50) {
   const start = Date.now();
   const timer = setInterval(() => {
      translatePopupActionsNow();

      if (Date.now() - start >= durationMs) {
         clearInterval(timer);
      }
   }, intervalMs);
}

let popupTranslateInitDone = false;
function initPopupTranslationHooks() {
   if (popupTranslateInitDone) return;
   popupTranslateInitDone = true;

   // 1) Any click inside the widget likely opens the popup => burst translate
   document.addEventListener("click", (e) => {
      if (e.target.closest("api-sports-widget")) {
         burstTranslatePopupActions(1500, 50);
      }
   });

   // 2) Observe body because popup is often appended to BODY
   const obs = new MutationObserver(() => {
      translatePopupActionsNow();
   });

   obs.observe(document.body, { childList: true, subtree: true });

   // 3) Initial run
   translatePopupActionsNow();

   // 4) On language change (instant)
   window.addEventListener("lang:changed", () => {
      translatePopupActionsNow();
      burstTranslatePopupActions(800, 50);
   });
}

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

function watchWidgetHost(host, timeoutMs = 5000, type = "standings") {
   if (!host) return;

   // Hide the widget (including the matches toolbar tabs) until we know whether
   // it has data. Without this, the matches widget paints its toolbar
   // immediately and the tabs flash on screen before we can replace a failed
   // widget with the "Data is currently unavailable" message.
   host.classList.add("liveWidgetPending");

   // Real, successful content: a standings table OR matches game rows.
   const hasData = () => !!host.querySelector("table, .game-teams");
   // The widget library's own loading spinner.
   const isLoading = () => !!host.querySelector(".loading-block, .loading");
   // The widget's own empty placeholder.
   const hasEmpty = () => !!host.querySelector(".empty-result");
   // Has the widget rendered its UI yet? (matches toolbar, or either custom
   // element). Lets us tell "still bootstrapping" from "settled with no data".
   const hasMounted = () =>
      !!host.querySelector(
         "standing-component, games-component, .btn-widget-link, .widget-toolbar"
      );

   let settleTimer = null;
   const clearSettle = () => {
      if (settleTimer) {
         clearTimeout(settleTimer);
         settleTimer = null;
      }
   };

   const done = () => {
      clearTimeout(timer);
      clearSettle();
      obs.disconnect();
      host.classList.remove("liveWidgetPending");
   };

   const succeed = () => done(); // reveal the widget (class removed)

   const fail = () => {
      done();
      // Replace the ENTIRE host (not just the empty-result text) so the matches
      // toolbar tabs are removed too, giving the same clean UI as standings.
      renderWidgetError(host, type);
   };

   const evaluate = () => {
      if (hasData()) return succeed();

      // No table/game rows yet. We must distinguish two very different states:
      //
      //   • SETTLED EMPTY — the widget mounted its UI and shows its own empty
      //     placeholder (or rendered nothing and is no longer loading). The
      //     request SUCCEEDED, there are simply no games/standings for this
      //     selection (e.g. a league with no fixtures today / off-season). This
      //     is NOT a failure — we REVEAL the widget so its own (translated)
      //     "no matches/standings" state shows.
      //
      //   • STUCK / NEVER MOUNTED — the widget never renders its UI and keeps
      //     loading. THAT is the real failure (e.g. subscription ended), handled
      //     by the backstop timer below.
      //
      // Debounce so a transient empty frame mid-(re)load isn't mistaken for the
      // settled state; if real data lands first, hasData() -> succeed().
      const settledEmpty = hasEmpty() || (hasMounted() && !isLoading());
      if (settledEmpty) {
         if (!settleTimer) {
            settleTimer = setTimeout(() => {
               settleTimer = null;
               if (isLoading()) return;   // went back to loading; let backstop decide
               succeed();                 // settled with no data => reveal "no games"
            }, 800);
         }
      } else {
         clearSettle();
      }
   };

   const obs = new MutationObserver(evaluate);
   // Backstop: only reached if the widget NEVER settled — stuck loading or never
   // mounted at all. THAT is a genuine load failure (e.g. subscription ended).
   const timer = setTimeout(() => {
      if (hasData()) succeed();
      else fail();
   }, timeoutMs);
   obs.observe(host, { childList: true, subtree: true, attributes: false });
   evaluate();
}

function renderWidgetError(host, type = "standings") {
   const t = langMap[currentLang] || {};
   const message = t.live_subscription_expired || "Data is currently unavailable";

   // IMPORTANT: do NOT use the widget library's custom elements
   // (<standing-component> / <games-component>) here. Injecting a bare one
   // re-runs its lifecycle, which boots into its own loading spinner with no
   // data to resolve it — causing the "infinite loader" this is meant to fix.
   // Use plain markup so nothing re-bootstraps a widget.
   host.innerHTML = `
      <div class="widgetUnavailable empty-result">${message}</div>
   `;
}