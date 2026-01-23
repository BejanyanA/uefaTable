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
import { apiGet, apiPost } from '../services/api.js';


const guardLoggedIn = () => {
    if (!isLoggedIn()) { location.hash = "#home"; return false; }
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
            window.showToast?.(t.not_found || "Not found", "info");
        }
    } catch (e) {
        window.showToast?.(t.something_went_wrong || "Something went wrong", "error");
        console.error(e);
    }
}




// Club Instances + PlayOff
const COMP_TO_BANNER = { ucl: 1, uel: 2, euro: 3, wc: 4 };
const STAGE_TO_TYPE = { basic: 1, only: 2 };          // selectedStageType
const ACCESS_TO_TAB = { my: "owners", invited: "invited" };

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

    const leagueId = Number(localStorage.getItem("leagueId"));
    if (!leagueId) {
        location.hash = `#${comp}-${stage}-${access}`;
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
    const comps = ["ucl", "uel", "euro", "wc"];
    const stages = ["basic", "only"];
    const access = ["my", "invited"];
    const tabs = ["group", "knockouts"];

    comps.forEach(comp => {
        stages.forEach(stage => {
            access.forEach(acc => {
                tabs.forEach(tab => {
                    const key = `${comp}-${stage}-${acc}-club-${tab}`;
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

    const leagueId = Number(localStorage.getItem("leagueId"));
    if (!leagueId) {
        location.hash = `#${comp}-${stage}-${access}`;
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
    const comps = ["euro", "wc"];
    const stages = ["basic", "only"];
    const access = ["my", "invited"];
    const tabs = ["group", "knockouts"];

    comps.forEach(comp => {
        stages.forEach(stage => {
            access.forEach(acc => {
                tabs.forEach(tab => {
                    // ✅ knockout-only → group route is invalid
                    if (stage === "only" && tab === "group") return;

                    const key = `${comp}-${stage}-${acc}-national-${tab}`;
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





function getStoredGroupId() {
    const v =
        localStorage.getItem("groupId") ??
        localStorage.getItem("currentGroupId") ??
        localStorage.getItem("selectedGroupId");
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

// ✅ Club: Group → Standing / Matches
async function openClubGroupDetail({ comp, stage, access, view }) {
    const stageType = STAGE_TO_TYPE[stage];
    if (stageType !== 1) {
        location.hash = `#${comp}-${stage}-${access}-club-knockouts`;
        return;
    }

    const leagueId = Number(localStorage.getItem("leagueId")) || 0;
    const groupId = getStoredGroupId();

    if (!leagueId || !groupId) {
        location.hash = `#${comp}-${stage}-${access}-club-group`;
        return;
    }

    // ✅ view -> your tab names
    const initialTab = view === "standing" ? "standings" : "matches";

    // ✅ use your existing renderer (it contains both tabs)
    await renderLeagueGroupStandingsPage(leagueId, groupId, { initialTab });
}

async function openNationalGroupDetail({ comp, stage, access, view }) {
    const stageType = STAGE_TO_TYPE[stage];
    if (stageType !== 1) {
        location.hash = `#${comp}-${stage}-${access}-national-knockouts`;
        return;
    }

    const leagueId = Number(localStorage.getItem("leagueId")) || 0;
    const groupId = getStoredGroupId();

    if (!leagueId || !groupId) {
        location.hash = `#${comp}-${stage}-${access}-national-group`;
        return;
    }

    const initialTab = view === "standing" ? "standings" : "matches";

    await renderNationalGroupStandingsPage(leagueId, groupId, { initialTab });
}



// ✅ Club: auto-register group standing/matches routes
function registerClubGroupDetailRoutes(routes) {
    const comps = ["ucl", "uel", "euro", "wc"];
    const stages = ["basic", "only"];
    const access = ["my", "invited"];
    const views = ["standing", "matches"];

    comps.forEach(comp => {
        stages.forEach(stage => {
            access.forEach(acc => {
                views.forEach(view => {
                    // group standing/matches only for "basic"
                    if (stage === "only") return;

                    const key = `${comp}-${stage}-${acc}-club-group-${view}`;
                    routes[key] = {
                        id: "leagueType1",
                        guard: guardLoggedIn,
                        onEnter: () => openClubGroupDetail({ comp, stage, access: acc, view }),
                    };
                });
            });
        });
    });
}

// ✅ National: auto-register group standing/matches routes
function registerNationalGroupDetailRoutes(routes) {
    const comps = ["euro", "wc"];
    const stages = ["basic", "only"];
    const access = ["my", "invited"];
    const views = ["standing", "matches"];

    comps.forEach(comp => {
        stages.forEach(stage => {
            access.forEach(acc => {
                views.forEach(view => {
                    if (stage === "only") return;

                    const key = `${comp}-${stage}-${acc}-national-group-${view}`;
                    routes[key] = {
                        id: "leagueType2",
                        guard: guardLoggedIn,
                        onEnter: () => openNationalGroupDetail({ comp, stage, access: acc, view }),
                    };
                });
            });
        });
    });
}





















const routes = {
    home: {
        id: "homePage"
    },

    live: {
        id: "liveDataPage",
        onEnter: openLiveData,
        onLeave: closeLiveData
    },


    profile: {
        id: "profileContainer",
        guard: () => {
            if (!isLoggedIn()) {
                location.hash = "home";
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
                location.hash = "home";
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
                location.hash = "home";
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
                location.hash = "home";
                return false;
            }
            return true;
        },
        onEnter: () => {
            setHomeOptionsVisible(false);        // hide home options
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
                location.hash = "home";
                return false;
            }
            return true;
        },
    },

    "europe-league": {
        id: "stageContainer", // IMPORTANT: keep homePage visible because bannerContainer is inside homePage in your layout
        guard: () => {
            if (!isLoggedIn()) {
                location.hash = "home";
                return false;
            }
            return true;
        },
    },

    "euro-cup": {
        id: "stageContainer", // IMPORTANT: keep homePage visible because bannerContainer is inside homePage in your layout
        guard: () => {
            if (!isLoggedIn()) {
                location.hash = "home";
                return false;
            }
            return true;
        },
    },

    "world-cup": {
        id: "stageContainer", // IMPORTANT: keep homePage visible because bannerContainer is inside homePage in your layout
        guard: () => {
            if (!isLoggedIn()) {
                location.hash = "home";
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










export function initRouter() {
    let prevKey = null;
    let prevHash = null; // ✅ NEW

    function render() {
        const raw = (location.hash || "#home").slice(1);        // "friends?tab=pending"
        const [keyOnly, qs = ""] = raw.split("?");              // ✅ NEW
        const key = keyOnly || "home";
        const nextKey = routes[key] ? key : "home";
        const next = routes[nextKey];

        const hashChanged = raw !== prevHash;                   // ✅ NEW

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

        // ✅ enter next ALSO when hash changed (back/forward / tab change)
        if (next.onEnter && (prevKey !== nextKey || hashChanged)) {
            next.onEnter({ query: new URLSearchParams(qs), raw });
        }

        prevKey = nextKey;
        prevHash = raw; // ✅ NEW
    }

    window.addEventListener("hashchange", render);
    render();
}