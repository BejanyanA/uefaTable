// router.js
import { openLiveData, closeLiveData } from "./liveData.js";
import { isLoggedIn, setHomeOptionsVisible, setCustomCompetitionVisible } from "./HomeOptions.js";
import { showToast } from '../utils/toast.js';
import { ProfileManager } from "./ProfileManager.js";
import { FriendManager } from "./FriendManager.js";
import { renderLeagueTable, renderLeagueInstances } from './components/renderLeagueTable.js';
import { renderLeagueKnockoutsStage, renderLeagueOnlyKnockouts } from './components/renderLeagueKnockout.js';
import { renderLeagueGroupStandingsPage } from './components/renderLeagueStandings.js';
import { renderNationalTable, renderNationalInstances } from './components/renderNationalTable.js';
import { renderNationalKnockoutsStage, renderNationalOnlyKnockouts } from './components/renderNationalKnockout.js';
import { renderNationalGroupStandingsPage } from './components/renderNationalStandings.js';
import { openMessagesPage } from './Messages.js';
import { apiGet, apiPost } from '../services/api.js';
import { API_BASE } from '../services/config.js';
import { langMap, currentLang, changeLang } from './LanguageManager.js';
import {
    LEAGUE, ALL_ROUTE_KEYS, classifyRouteKey,
    leagueInstanceKey, leagueGroupDetailKey, isValidInstance,
} from '../shared/appRoutes.js';

// Every real path is prefixed with the current language ("/en/...", "/fr/...",
// "/am/..."), matching LanguageManager.js's existing getLangFromURL()/
// updateURLWithLang() convention. This splits a pathname into that language
// segment (if present/recognized) and the remaining route segments.
function splitLangAndRoute(pathname) {
    const segments = pathname.split('/').filter(Boolean);
    const hasLangPrefix = Object.prototype.hasOwnProperty.call(langMap, segments[0]);
    return {
        lang: hasLangPrefix ? segments[0] : null,
        routeSlug: (hasLangPrefix ? segments.slice(1) : segments).join('/'),
    };
}

// Current route (language segment stripped), e.g. "friends" or
// "ucl-basic-my-club-group-A-standing". Exposed for code outside router.js
// that needs to know the active route without re-deriving it (e.g. tab state).
export function getCurrentRouteRaw() {
    return splitLangAndRoute(location.pathname).routeSlug;
}

// Navigate to a real path. Accepts the same slugs previously passed to
// `location.hash = "..."` (with or without a leading "#"), so callers don't
// need to change their route strings. The current language is prepended
// automatically. pushState/replaceState don't fire any native event, so we
// call render() directly afterwards.
export function navigateTo(input, { replace = false } = {}) {
    const slug = String(input).replace(/^#/, '').replace(/^\//, '') || "home";
    const path = `/${currentLang}/${slug}`;

    // Setting location.hash to its current value used to be a silent no-op
    // (browsers don't fire hashchange), which is what made it safe for a
    // route's own onEnter to call this with its own route's slug (e.g.
    // openMessagesPage() re-asserting "messages"). pushState/replaceState
    // have no such built-in dedup, and render() re-invokes onEnter before
    // prevPath is updated -- so without this guard, that pattern recurses
    // forever. Skip the no-op case explicitly to preserve the old semantics.
    if (path === location.pathname + location.search) return;

    if (replace) history.replaceState(null, '', path);
    else history.pushState(null, '', path);
    render();
}

const guardLoggedIn = () => {
    if (!isLoggedIn()) { navigateTo("home"); return false; }
    return true;
};


// Club Leagues 
async function openClubLeagues({ bannerId, stageType, tab }) {
    const isGroup = stageType === 1;

    localStorage.setItem("currentBannerId", String(bannerId));
    localStorage.setItem("selectedStageType", String(stageType));
    localStorage.setItem("lastActiveLeagueTab", tab);

    const t = langMap[currentLang];

    try {
        const res = await apiPost("/leagues", { bannerId, isGroup });
        if (res?.success && res?.data) {
            renderLeagueTable(res.data);          // same renderer
        } else {
            showToast(t.not_found || "Not found", "info");
        }
    } catch (e) {
        showToast(t.something_went_wrong || "Something went wrong", "error");
        console.error(e);
    }
}


// National Leagues 
async function openNationalLeagues({ bannerId, stageType, tab }) {
    const isGroup = stageType === 1;

    localStorage.setItem("currentBannerId", String(bannerId));
    localStorage.setItem("selectedStageType", String(stageType));
    localStorage.setItem("lastActiveNationalLeagueTab", tab);

    const t = langMap[currentLang];

    try {
        const res = await apiPost("/leagues", { bannerId, isGroup });
        if (res?.success && res?.data) {
            renderNationalTable(res.data);
        } else {
            showToast(t.not_found || "Not found", "info");
        }
    } catch (e) {
        showToast(t.something_went_wrong || "Something went wrong", "error");
        console.error(e);
    }
}




// Club Instances + PlayOff
const COMP_TO_BANNER = { ucl: 1, uel: 2, euro: 3, wc: 4 };
const STAGE_TO_TYPE = { basic: 1, only: 2 };          // selectedStageType
const ACCESS_TO_TAB = { my: "owners", invited: "invited" };



function getLeagueKey({ comp, stage, access }) {
    return `${comp}-${stage}-${access}`; // unique for "ucl-basic-my", "wc-only-invited", etc.
}

export function setLeagueIdForContext(ctx, leagueId) {
    const key = getLeagueKey(ctx);
    localStorage.setItem(`leagueId:${key}`, String(leagueId));
    // optional: also store last context
    localStorage.setItem("lastLeagueKey", key);
}

export function getLeagueIdForContext(ctx) {
    const key = getLeagueKey(ctx);
    const v = localStorage.getItem(`leagueId:${key}`);
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
}




function setActiveInstancesTab(tab) {
    const groupBtn = document.getElementById("groupStageTitle");
    const koBtn = document.getElementById("knockoutStageTitle");
    const groupEl = document.getElementById("groupStageTab");
    const koEl = document.getElementById("knockoutTab");

    // buttons
    if (groupBtn) groupBtn.classList.toggle("active-tab", tab === "group");
    if (koBtn) koBtn.classList.toggle("active-tab", tab === "knockouts");

    // panes
    if (groupEl) groupEl.style.display = (tab === "group") ? "block" : "none";
    if (koEl) koEl.style.display = (tab === "knockouts") ? "block" : "none";
}

// Club Instances + Knockouts (same family)
async function openInstances({ comp, stage, access, tab }) {
    const bannerId = COMP_TO_BANNER[comp];
    const stageType = STAGE_TO_TYPE[stage];
    const leagueTab = ACCESS_TO_TAB[access];

    // knockout-only leagues cannot have group
    const effectiveTab = (stageType === 2) ? "knockouts" : tab;

    localStorage.setItem("currentBannerId", String(bannerId));
    localStorage.setItem("selectedStageType", String(stageType));
    localStorage.setItem("lastActiveLeagueTab", leagueTab);
    localStorage.setItem("lastActiveInstancesTab", effectiveTab);

    const leagueId = getLeagueIdForContext({ comp, stage, access });

    if (!leagueId) {
        navigateTo(`${comp}-${stage}-${access}`);
        return;
    }

    try {
        /* --------------------------------------------------
           ✅ GROUP TAB → fetch + render instances
        -------------------------------------------------- */
        if (effectiveTab === "group") {
            const res = await apiPost("/league-instances", { leagueId });
            if (!res?.success || !res?.data) {
                showToast("Failed to load instances", "error");
                return;
            }

            renderLeagueInstances(res.data);          // normal render (groups)
            setActiveInstancesTab("group");
            return;
        }

        /* --------------------------------------------------
           ✅ KNOCKOUT TAB → NO /league-instances call
        -------------------------------------------------- */
        // build base UI WITHOUT group data & WITHOUT auto KO render
        renderLeagueInstances({ leagueInstances: [] }, { autoRenderKnockouts: false });
        setActiveInstancesTab("knockouts");

        const koRoot = document.querySelector("#leagueType1 #knockoutTab");
        if (!koRoot) return;
        koRoot.innerHTML = "";

        if (stageType === 2) {
            await renderLeagueOnlyKnockouts(leagueId, koRoot);
        } else {
            await renderLeagueKnockoutsStage(leagueId, koRoot);
        }

    } catch (e) {
        console.error(e);
        showToast("Something went wrong", "error");
    }
}


// ✅ auto-register 32 routes
function registerInstanceRoutes(routes) {
    // Lists come from shared/appRoutes.js so the server (_worker.js) knows the same routes.
    const { clubComps: comps, stages, access, tabs } = LEAGUE;

    comps.forEach(comp => {
        stages.forEach(stage => {
            access.forEach(acc => {
                tabs.forEach(tab => {
                    const key = leagueInstanceKey(comp, stage, acc, "club", tab);
                    routes[key] = {
                        id: "leagueType1",          // league instances render inside leagueType1
                        guard: guardLoggedIn,
                        onEnter: () => openInstances({ comp, stage, access: acc, tab }),
                    };
                });
            });
        });
    });
}





// National Instances + PlayOff
const NAT_COMP_TO_BANNER = { euro: 3, wc: 4 };

function setActiveNationalInstancesTab(tab) {
    const groupBtn = document.querySelector("#leagueType2 #groupStageTitle");
    const koBtn = document.querySelector("#leagueType2 #knockoutStageTitle");
    const groupEl = document.querySelector("#leagueType2 #groupStageTab");
    const koEl = document.querySelector("#leagueType2 #knockoutTab");

    if (groupBtn) groupBtn.classList.toggle("active-tab", tab === "group");
    if (koBtn) koBtn.classList.toggle("active-tab", tab === "knockouts");

    if (groupEl) groupEl.style.display = (tab === "group") ? "block" : "none";
    if (koEl) koEl.style.display = (tab === "knockouts") ? "block" : "none";
}

async function openNationalInstances({ comp, stage, access, tab }) {
    const bannerId = NAT_COMP_TO_BANNER[comp];
    const stageType = STAGE_TO_TYPE[stage];
    const leagueTab = ACCESS_TO_TAB[access];

    // knockout-only leagues cannot have group
    const effectiveTab = (stageType === 2) ? "knockouts" : tab;

    localStorage.setItem("currentBannerId", String(bannerId));
    localStorage.setItem("selectedStageType", String(stageType));
    localStorage.setItem("lastActiveNationalLeagueTab", leagueTab);
    localStorage.setItem("lastActiveNationalInstancesTab", effectiveTab);

    const leagueId = getLeagueIdForContext({ comp, stage, access });

    if (!leagueId) {
        navigateTo(`${comp}-${stage}-${access}`);
        return;
    }

    try {
        /* --------------------------------------------------
           ✅ GROUP TAB → fetch + render instances
        -------------------------------------------------- */
        if (effectiveTab === "group") {
            const res = await apiPost("/national-instances", { leagueId });
            if (!res?.success || !res?.data) {
                showToast("Failed to load instances", "error");
                return;
            }

            renderNationalInstances(res.data);
            setActiveNationalInstancesTab("group");
            return;
        }

        /* --------------------------------------------------
           ✅ KNOCKOUT TAB → NO /national-instances call
        -------------------------------------------------- */
        // build base UI WITHOUT group data
        renderNationalInstances({ leagueInstances: [] }, { autoRenderKnockouts: false });
        setActiveNationalInstancesTab("knockouts");

        const koRoot = document.querySelector("#leagueType2 #knockoutTab");
        if (!koRoot) return;
        koRoot.innerHTML = "";

        if (stageType === 2) {
            await renderNationalOnlyKnockouts(leagueId, koRoot);
        } else {
            await renderNationalKnockoutsStage(leagueId, koRoot);
        }

    } catch (e) {
        console.error(e);
        showToast("Something went wrong", "error");
    }
}

function registerNationalInstanceRoutes(routes) {
    const { nationalComps: comps, stages, access, tabs } = LEAGUE;

    comps.forEach(comp => {
        stages.forEach(stage => {
            access.forEach(acc => {
                tabs.forEach(tab => {
                    // ✅ knockout-only → group route is invalid
                    if (!isValidInstance("national", stage, tab)) return;

                    const key = leagueInstanceKey(comp, stage, acc, "national", tab);
                    routes[key] = {
                        id: "leagueType2",
                        guard: guardLoggedIn,
                        onEnter: () => openNationalInstances({ comp, stage, access: acc, tab }),
                    };
                });
            });
        });
    });
}






export function getClubBackInstancesHash() {
    const bannerId = Number(localStorage.getItem("currentBannerId"));
    const stageType = Number(localStorage.getItem("selectedStageType")) || 1;
    const leagueTab = localStorage.getItem("lastActiveLeagueTab") || "owners";

    const comp =
        bannerId === 1 ? "ucl" :
            bannerId === 2 ? "uel" :
                bannerId === 3 ? "euro" :
                    bannerId === 4 ? "wc" : "ucl";

    const stage = stageType === 1 ? "basic" : "only";
    const access = leagueTab === "owners" ? "my" : "invited";

    return `#${comp}-${stage}-${access}-club-group`;
}

export function getNationalBackInstancesHash() {
    const bannerId = Number(localStorage.getItem("currentBannerId"));
    const stageType = Number(localStorage.getItem("selectedStageType")) || 1;
    const leagueTab = localStorage.getItem("lastActiveNationalLeagueTab") || "owners";

    const comp = bannerId === 3 ? "euro" : "wc";
    const stage = stageType === 1 ? "basic" : "only";
    const access = leagueTab === "owners" ? "my" : "invited";

    return `#${comp}-${stage}-${access}-national-group`;
}




export function setGroupIdForContext(ctx, groupId) {
    const key = getLeagueKey(ctx); // same comp-stage-access key
    localStorage.setItem(`groupId:${key}`, String(groupId));
}

export function getGroupIdForContext(ctx) {
    const key = getLeagueKey(ctx);
    const v = localStorage.getItem(`groupId:${key}`);
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
}


export function getGroupLetterFromName(groupName = "") {
    // supports "Group A", "A", "GROUP B", etc.
    const s = String(groupName).trim();
    const m = s.match(/\b([A-H])\b/i);
    return m ? m[1].toUpperCase() : ""; // "" if not found
}

function getGroupKey(ctx, groupLetter = "") {
    const base = getLeagueKey(ctx); // ucl-basic-my
    const letter = String(groupLetter || "").trim().toUpperCase();
    return letter ? `${base}-${letter}` : base; // ucl-basic-my-A
}

export function setGroupSelectionForContext(ctx, { groupId, groupName, groupLetter }) {
    const letter = groupLetter || getGroupLetterFromName(groupName);
    const key = getGroupKey(ctx, letter);

    localStorage.setItem(`groupId:${key}`, String(groupId));
    localStorage.setItem(`groupName:${key}`, String(groupName || ""));
    localStorage.setItem(`lastGroupLetter:${getLeagueKey(ctx)}`, String(letter || "")); // helpful
}

export function getGroupSelectionForContext(ctx, groupLetter) {
    const base = getLeagueKey(ctx);

    // if letter not provided, try last selected letter in this context
    const letter =
        (groupLetter || "").toUpperCase() ||
        (localStorage.getItem(`lastGroupLetter:${base}`) || "").toUpperCase();

    const key = getGroupKey(ctx, letter);

    const id = Number(localStorage.getItem(`groupId:${key}`));
    const groupId = Number.isFinite(id) && id > 0 ? id : 0;
    const groupName = (localStorage.getItem(`groupName:${key}`) || "").trim();

    return { groupId, groupName, groupLetter: letter };
}





function getStoredGroupId() {
    const v =
        localStorage.getItem("groupId") ??
        localStorage.getItem("currentGroupId") ??
        localStorage.getItem("selectedGroupId");
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

// ✅ Club: Group → Standing / Matches
async function openClubGroupDetail({ comp, stage, access, view, groupLetter }) {
    const stageType = STAGE_TO_TYPE[stage];
    if (stageType !== 1) {
        navigateTo(`${comp}-${stage}-${access}-club-knockouts`);
        return;
    }

    const leagueId = getLeagueIdForContext({ comp, stage, access });

    const ctx = { comp, stage, access };
    const { groupId, groupName } = getGroupSelectionForContext(ctx, groupLetter);

    if (!leagueId || !groupId) {
        navigateTo(`${comp}-${stage}-${access}-club-group`);
        return;
    }

    const initialTab = view === "standing" ? "standings" : "matches";
    await renderLeagueGroupStandingsPage(leagueId, groupId, groupName, { initialTab });
}

async function openNationalGroupDetail({ comp, stage, access, view, groupLetter }) {
    const stageType = STAGE_TO_TYPE[stage];
    if (stageType !== 1) {
        navigateTo(`${comp}-${stage}-${access}-national-knockouts`);
        return;
    }

    const leagueId = getLeagueIdForContext({ comp, stage, access });

    const ctx = { comp, stage, access };
    const { groupId, groupName } = getGroupSelectionForContext(ctx, groupLetter);

    if (!leagueId || !groupId) {
        navigateTo(`${comp}-${stage}-${access}-national-group`);
        return;
    }

    const initialTab = view === "standing" ? "standings" : "matches";
    await renderNationalGroupStandingsPage(leagueId, groupId, groupName, { initialTab });
}



// ✅ Club: auto-register group standing/matches routes
function registerClubGroupDetailRoutes(routes) {
    const { clubComps: comps, groupDetailStages: stages, access, views, letters } = LEAGUE;

    comps.forEach(comp => {
        stages.forEach(stage => {
            access.forEach(acc => {
                views.forEach(view => {
                    letters.forEach(letter => {
                        const key = leagueGroupDetailKey(comp, stage, acc, "club", letter, view);
                        routes[key] = {
                            id: "leagueType1",
                            guard: guardLoggedIn,
                            onEnter: () => openClubGroupDetail({ comp, stage, access: acc, view, groupLetter: letter }),
                        };
                    });
                });
            });
        });
    });
}

// ✅ National: auto-register group standing/matches routes
function registerNationalGroupDetailRoutes(routes) {
    const { nationalComps: comps, groupDetailStages: stages, access, views, letters } = LEAGUE;

    comps.forEach(comp => {
        stages.forEach(stage => {
            access.forEach(acc => {
                views.forEach(view => {
                    letters.forEach(letter => {
                        const key = leagueGroupDetailKey(comp, stage, acc, "national", letter, view);
                        routes[key] = {
                            id: "leagueType2",
                            guard: guardLoggedIn,
                            onEnter: () => openNationalGroupDetail({ comp, stage, access: acc, view, groupLetter: letter }),
                        };
                    });
                });
            });
        });
    });
}










const routes = {
    home: {
        id: "homePage",
        onEnter: () => {
            // Hide the home icon on the home page
            const homeIcon = document.getElementById("homePageIcon");
            if (homeIcon) homeIcon.style.display = "none";

            // Home always shows the two option banners. Other flows hide them
            // (e.g. logging in while on the Live page) and not every way back
            // to home restores them, so restore them here.
            setHomeOptionsVisible(true);
            setCustomCompetitionVisible(false);
        },
        onLeave: () => {
            // Show the home icon when leaving the home page
            const homeIcon = document.getElementById("homePageIcon");
            if (homeIcon) homeIcon.style.display = "block";
        }
    },

    live: {
        id: "liveDataPage",
        onEnter: ({ query } = {}) => {
            sessionStorage.setItem("actionForLive", "openLive");
            openLiveData("allGames", { date: query ? query.get("date") : null });
        },
        onLeave: () => {
            sessionStorage.removeItem("actionForLive");
            closeLiveData();
        }
    },

    "live-standings": {
        id: "liveDataPage",
        onEnter: () => {
            sessionStorage.setItem("actionForLive", "openLive");
            openLiveData("standings");
        },
        onLeave: () => {
            sessionStorage.removeItem("actionForLive");
            closeLiveData();
        }
    },

    "live-matches": {
        id: "liveDataPage",
        onEnter: () => {
            sessionStorage.setItem("actionForLive", "openLive");
            openLiveData("matches");
        },
        onLeave: () => {
            sessionStorage.removeItem("actionForLive");
            closeLiveData();
        }
    },


    messages: {
        id: "messagesPage",
        guard: () => {
            if (!isLoggedIn()) {
                navigateTo("home");
                return false;
            }
            return true;
        },

        onEnter: () => {
            setHomeOptionsVisible(false);
            openMessagesPage();
        },

        onLeave: () => {
            const messages = document.getElementById("messagesPage");
            if (messages) messages.style.display = "none";
            setHomeOptionsVisible(true);
        }
    },


    profile: {
        id: "profileContainer",
        guard: () => {
            if (!isLoggedIn()) {
                navigateTo("home");
                return false;
            }
            return true;
        },
        onEnter: () => {
            ProfileManager._renderProfileView();
            ProfileManager.__selectProfileTab?.("personal");
        },
    },

    achievements: {
        id: "profileContainer",
        guard: () => {
            if (!isLoggedIn()) {
                navigateTo("home");
                return false;
            }
            return true;
        },
        onEnter: () => {
            ProfileManager._renderProfileView();
            ProfileManager.__selectProfileTab?.("achievements");
        },
    },

    friends: {
        id: "friendsContainer",
        guard: () => {
            if (!isLoggedIn()) {
                navigateTo("home");
                return false;
            }
            return true;
        },
        onEnter: () => {
            FriendManager.openFriends();
            // markSeenIfUnread()
        },
        onLeave: () => {
            FriendManager.closeFriends?.(); // optional
        },
    },

    leagues: {
        id: "homePage", // IMPORTANT: keep homePage visible because bannerContainer is inside homePage in your layout
        guard: () => {
            if (!isLoggedIn()) {
                navigateTo("home");
                return false;
            }
            return true;
        },
        onEnter: () => {
            setHomeOptionsVisible(false);    // hide home options
            setCustomCompetitionVisible(true);   // show bannerContainer + banners
        },
        onLeave: () => {
            setCustomCompetitionVisible(false);  // hide bannerContainer
            setHomeOptionsVisible(true);         // show home options
        },
    },

    // ✅ League Types
    "champions-league": {
        id: "stageContainer", // IMPORTANT: keep homePage visible because bannerContainer is inside homePage in your layout
        guard: () => {
            if (!isLoggedIn()) {
                navigateTo("home");
                return false;
            }
            return true;
        },
    },

    "europe-league": {
        id: "stageContainer", // IMPORTANT: keep homePage visible because bannerContainer is inside homePage in your layout
        guard: () => {
            if (!isLoggedIn()) {
                navigateTo("home");
                return false;
            }
            return true;
        },
    },

    "euro-cup": {
        id: "stageContainer", // IMPORTANT: keep homePage visible because bannerContainer is inside homePage in your layout
        guard: () => {
            if (!isLoggedIn()) {
                navigateTo("home");
                return false;
            }
            return true;
        },
    },

    "world-cup": {
        id: "stageContainer", // IMPORTANT: keep homePage visible because bannerContainer is inside homePage in your layout
        guard: () => {
            if (!isLoggedIn()) {
                navigateTo("home");
                return false;
            }
            return true;
        },
    },


    // ✅ Champions League (bannerId=1)
    "ucl-basic-my": {
        id: "leagueType1",
        guard: guardLoggedIn,
        onEnter: () => openClubLeagues({ bannerId: 1, stageType: 1, tab: "owners" }),
    },
    "ucl-basic-invited": {
        id: "leagueType1",
        guard: guardLoggedIn,
        onEnter: () => openClubLeagues({ bannerId: 1, stageType: 1, tab: "invited" }),
    },
    "ucl-only-my": {
        id: "leagueType1",
        guard: guardLoggedIn,
        onEnter: () => openClubLeagues({ bannerId: 1, stageType: 2, tab: "owners" }),
    },
    "ucl-only-invited": {
        id: "leagueType1",
        guard: guardLoggedIn,
        onEnter: () => openClubLeagues({ bannerId: 1, stageType: 2, tab: "invited" }),
    },


    // ✅ Europa League (bannerId=2)
    "uel-basic-my": {
        id: "leagueType1",
        guard: guardLoggedIn,
        onEnter: () => openClubLeagues({ bannerId: 2, stageType: 1, tab: "owners" }),
    },
    "uel-basic-invited": {
        id: "leagueType1",
        guard: guardLoggedIn,
        onEnter: () => openClubLeagues({ bannerId: 2, stageType: 1, tab: "invited" }),
    },
    "uel-only-my": {
        id: "leagueType1",
        guard: guardLoggedIn,
        onEnter: () => openClubLeagues({ bannerId: 2, stageType: 2, tab: "owners" }),
    },
    "uel-only-invited": {
        id: "leagueType1",
        guard: guardLoggedIn,
        onEnter: () => openClubLeagues({ bannerId: 2, stageType: 2, tab: "invited" }),
    },


    // ✅ EURO CUP (bannerId = 3)
    "euro-basic-my": {
        id: "leagueType2",
        guard: guardLoggedIn,
        onEnter: () => openNationalLeagues({ bannerId: 3, stageType: 1, tab: "owners" }),
    },
    "euro-basic-invited": {
        id: "leagueType2",
        guard: guardLoggedIn,
        onEnter: () => openNationalLeagues({ bannerId: 3, stageType: 1, tab: "invited" }),
    },
    "euro-only-my": {
        id: "leagueType2",
        guard: guardLoggedIn,
        onEnter: () => openNationalLeagues({ bannerId: 3, stageType: 2, tab: "owners" }),
    },
    "euro-only-invited": {
        id: "leagueType2",
        guard: guardLoggedIn,
        onEnter: () => openNationalLeagues({ bannerId: 3, stageType: 2, tab: "invited" }),
    },


    // ✅ WORLD CUP (bannerId = 4)
    "wc-basic-my": {
        id: "leagueType2",
        guard: guardLoggedIn,
        onEnter: () => openNationalLeagues({ bannerId: 4, stageType: 1, tab: "owners" }),
    },
    "wc-basic-invited": {
        id: "leagueType2",
        guard: guardLoggedIn,
        onEnter: () => openNationalLeagues({ bannerId: 4, stageType: 1, tab: "invited" }),
    },
    "wc-only-my": {
        id: "leagueType2",
        guard: guardLoggedIn,
        onEnter: () => openNationalLeagues({ bannerId: 4, stageType: 2, tab: "owners" }),
    },
    "wc-only-invited": {
        id: "leagueType2",
        guard: guardLoggedIn,
        onEnter: () => openNationalLeagues({ bannerId: 4, stageType: 2, tab: "invited" }),
    },
};

registerInstanceRoutes(routes);
registerNationalInstanceRoutes(routes);

registerClubGroupDetailRoutes(routes);
registerNationalGroupDetailRoutes(routes);

// The server only serves the app for routes listed in shared/appRoutes.js;
// anything else is a real 404 on direct open or refresh. Flag any mismatch
// loudly during development instead of finding out from a broken link.
(function checkRoutesMatchSharedList() {
    const registered = Object.keys(routes);
    const missingOnServer = registered.filter((key) => !classifyRouteKey(key));
    const missingHandler = ALL_ROUTE_KEYS.filter((key) => !routes[key]);
    if (missingOnServer.length) {
        console.error("[router] Routes missing from js/shared/appRoutes.js (they will 404 on direct open):", missingOnServer);
    }
    if (missingHandler.length) {
        console.error("[router] Routes listed in js/shared/appRoutes.js without a handler in router.js:", missingHandler);
    }
})();










let prevKey = null;
let prevPath = null;

function render() {
    const { lang, routeSlug } = splitLangAndRoute(location.pathname);
    // Keep LanguageManager in sync when the URL's language segment changed
    // out from under us (e.g. browser back/forward across a language switch).
    if (lang && lang !== currentLang) changeLang(lang);

    const raw = (routeSlug + location.search) || "home";  // "friends?tab=pending"
    const [keyOnly, qs = ""] = raw.split("?");
    const key = keyOnly || "home";
    const nextKey = routes[key] ? key : "home";
    const next = routes[nextKey];

    const pathChanged = raw !== prevPath;

    // guard (auth check)
    if (next.guard && !next.guard()) return;

    // leave previous
    if (prevKey && routes[prevKey]?.onLeave && prevKey !== nextKey) {
        routes[prevKey].onLeave();
    }

    // hide all sections
    Object.values(routes).forEach((r) => {
        const el = document.getElementById(r.id);
        if (el) el.style.display = "none";
    });

    // show active
    const activeEl = document.getElementById(next.id);
    if (activeEl) activeEl.style.display = "block";

    // SEO content block belongs on the homepage only
    const seoContent = document.querySelector(".seo-content");
    if (seoContent) seoContent.style.display = (nextKey === "home") ? "block" : "none";

    // ✅ enter next ALSO when path changed (back/forward / tab change)
    if (next.onEnter && (prevKey !== nextKey || pathChanged)) {
        next.onEnter({ query: new URLSearchParams(qs), raw });
    }

    prevKey = nextKey;
    prevPath = raw;
}

export function initRouter() {
    // Normalize the boot URL once: always end up with "/<lang>/<route>",
    // folding in whichever of these are present:
    //  - an existing route path without a language prefix ("/leagues")
    //  - a language prefix from LanguageManager's old updateURLWithLang()
    //    paired with a legacy "#slug" hash route ("/fr#leagues")
    //  - a bare legacy "#slug" hash route with no path at all ("/#leagues")
    const { lang, routeSlug } = splitLangAndRoute(location.pathname);
    const legacyHashSlug = location.hash ? location.hash.slice(1) : '';
    const finalLang = lang || currentLang;
    // Bare domain / bare language prefix ("/", "/en") lands explicitly on "/home".
    const finalRouteSlug = routeSlug || legacyHashSlug || "home";
    const targetPath = `/${finalLang}/${finalRouteSlug}`;

    if (targetPath !== location.pathname || location.hash) {
        history.replaceState(null, '', `${targetPath}${location.search}`);
    }

    window.addEventListener("popstate", render);
    render();
}