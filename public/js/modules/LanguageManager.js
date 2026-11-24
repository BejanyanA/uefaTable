// Translations live in ../shared/langMap.js (pure data, also used by the
// server-side worker). Re-exported here so existing imports keep working.
import { langMap } from '../shared/langMap.js';
export { langMap };

function getLangFromURL() {
  const pathLang = window.location.pathname.split("/")[1];
  return langMap[pathLang] ? pathLang : "en";
}

let currentLang = getLangFromURL();

function updateURLWithLang(lang) {
  const { origin, pathname, search } = window.location;
  const segments = pathname.split("/").filter(Boolean);
  const hasLangPrefix = Object.prototype.hasOwnProperty.call(langMap, segments[0]);
  const routeSlug = (hasLangPrefix ? segments.slice(1) : segments).join("/");
  const newUrl = `${origin}/${lang}${routeSlug ? "/" + routeSlug : ""}${search || ""}`;
  window.history.replaceState(null, "", newUrl);
}

window.__APP_BOOTING__ = true;

function changeLang(lang, opts = {}) {
  const { silent = false } = opts;
  currentLang = lang;
  // <html lang> uses the ISO code; the URL prefix for Armenian is "am".
  document.documentElement.lang = lang === "am" ? "hy" : lang;
  updateURLWithLang(lang);
  updateIconTitles();
  buttonsTranslate();
  placeholderTranslate();
  friendStatusesAndSearch();
  updateFriendActionButtonTranslations();

  // Live Translation
  liveDataTranslation();
  translateEmptyResults();

  // Homepage Card
  hompageCardTranslations();

  // SEO content section
  seoContentTranslations();

  // 🔹 Notify all modules that language changed
  if (!window.__APP_BOOTING__ && !silent) {
    document.dispatchEvent(new CustomEvent('app:language-changed', { detail: { lang } }));
  };



  const t = langMap[lang];

  const leagueNotExistEl = document.getElementById("leagueNotExist");
  if (leagueNotExistEl) {
    leagueNotExistEl.textContent = langMap[currentLang].leagueNotExist || "No leagues found";
  }

  const noLeagueFound = langMap[currentLang].leagueNotExist || "No leagues found";
  document.querySelectorAll("#leagueNotExist").forEach(opt => {
    opt.textContent = noLeagueFound;
  });

  const myLeagues = langMap[currentLang].myCreatedLeagues || "My Leagues";
  document.querySelectorAll("#myLeaguesTab").forEach(opt => {
    opt.textContent = myLeagues;
  });

  const myInvitedLeagues = langMap[currentLang].myInvitedLeagues || "Invited Leagues";
  document.querySelectorAll("#invitedLeaguesTab").forEach(opt => {
    opt.textContent = myInvitedLeagues;
  });



  const selectUser = langMap[currentLang].selectUser || "Select Player";
  document.querySelectorAll("#selectUserDesk").forEach(opt => {
    opt.textContent = selectUser;
  });


  // Tabs
  const groupTabButton = langMap[currentLang].groupStageTitle || "Group Stage";
  document.querySelectorAll("#groupStageTitle").forEach(opt => {
    opt.textContent = groupTabButton;
  });
  const knockoutTabButton = langMap[currentLang].knockoutStageTitle || "Playoff";
  document.querySelectorAll("#knockoutStageTitle").forEach(opt => {
    opt.textContent = knockoutTabButton;
  });


  // Knockout rounds
  const round16Round = langMap[currentLang].round16 || "Round of 16";
  document.querySelectorAll("#round16Round").forEach(opt => {
    opt.textContent = round16Round;
  });
  const quarterFinalRound = langMap[currentLang].quarterFinal || "Quarter-finals";
  document.querySelectorAll("#quarterFinalRound").forEach(opt => {
    opt.textContent = quarterFinalRound;
  });
  const semiFinalRound = langMap[currentLang].semiFinal || "Semi-finals";
  document.querySelectorAll("#semiFinalRound").forEach(opt => {
    opt.textContent = semiFinalRound;
  });
  const finalRound = langMap[currentLang].final || "Final";
  document.querySelectorAll("#finalRound").forEach(opt => {
    opt.textContent = finalRound;
  });
  const leftSFWinner = langMap[currentLang].leftSFWinner || "Winner Left SF";
  document.querySelectorAll("#leftSFWinner").forEach(opt => {
    opt.textContent = leftSFWinner;
  });
  const rightSFWinner = langMap[currentLang].rightSFWinner || "Winner Right SF";
  document.querySelectorAll("#rightSFWinner").forEach(opt => {
    opt.textContent = rightSFWinner;
  });


  // Back Buttons
  const backButton1 = langMap[currentLang].backButton || "< Back";
  document.querySelectorAll("#backBtn").forEach(opt => {
    opt.innerText = backButton1;
  });
  const backButton2 = langMap[currentLang].backButton || "< Back";
  document.querySelectorAll("#stageBackBtn").forEach(opt => {
    opt.innerText = backButton2;
  });
  const backButton3 = langMap[currentLang].backButton || "< Back";
  document.querySelectorAll("#nationalBackBtn").forEach(opt => {
    opt.innerText = backButton3;
  });
  const backButton4 = langMap[currentLang].backButton || "< Back";
  document.querySelectorAll("#bannerBackBtn").forEach(opt => {
    opt.innerText = backButton4;
  });
  const backButton5 = langMap[currentLang].backButton || "< Back";
  document.querySelectorAll("#btnBackFromLive").forEach(opt => {
    opt.innerText = backButton5;
  });
  const homeButton = langMap[currentLang].homeButton || "< Home";
  document.querySelectorAll("#homeButton").forEach(opt => {
    opt.innerText = homeButton;
  });

  const myFriends = langMap[currentLang].myFriends || "Friends";
  document.querySelectorAll("#myFriendsTab").forEach(opt => {
    opt.textContent = myFriends;
  });

  const pendingUsersTab = langMap[currentLang].pendingUsers || "Pending";
  document.querySelectorAll("#pendingUsersTab").forEach(opt => {
    opt.textContent = pendingUsersTab;
  });

  const rejectedUsersTab = langMap[currentLang].rejectedUsers || "Rejected";
  document.querySelectorAll("#rejectedUsersTab").forEach(opt => {
    opt.textContent = rejectedUsersTab;
  });

  const noFriendsFound = langMap[currentLang].no_friends_found || "No friends found";
  document.querySelectorAll("#friendsNotExist").forEach(opt => {
    opt.textContent = noFriendsFound;
  });

  const noUsersFound = langMap[currentLang].usersNotExist || "No users found";
  document.querySelectorAll("#usersNotExist").forEach(opt => {
    opt.textContent = noUsersFound;
  });

  const deleteOption = langMap[currentLang].delete || "Delete";
  document.querySelectorAll("#delete").forEach(opt => {
    opt.textContent = deleteOption;
  });

  const rejectOption = langMap[currentLang].reject || "Reject";
  document.querySelectorAll("#reject").forEach(opt => {
    opt.textContent = rejectOption;
  });

  const approveOption = langMap[currentLang].approve || "Approve";
  document.querySelectorAll("#approve").forEach(opt => {
    opt.textContent = approveOption;
  });

  const username = langMap[currentLang].username || "Username";
  document.querySelectorAll("#username").forEach(opt => {
    opt.textContent = username;
  });

  const email = langMap[currentLang].email || "Email";
  document.querySelectorAll("#email").forEach(opt => {
    opt.textContent = email;
  });

  const currentPassword = langMap[currentLang].password || "Password";
  document.querySelectorAll("#currentPassword").forEach(opt => {
    opt.textContent = currentPassword;
  });

  const newPassword = langMap[currentLang].newPassword || "New Password";
  document.querySelectorAll("#newPassword").forEach(opt => {
    opt.textContent = newPassword;
  });


  const confirmNewPassword = langMap[currentLang].confirmNewPassword || "Confirm New Password";
  document.querySelectorAll("#confirmNewPassword").forEach(opt => {
    opt.textContent = confirmNewPassword;
  });


  // Messaging
  const messagesMyFriends = langMap[currentLang].myFriends || "Friends";
  document.querySelectorAll("#messagesMyFriends").forEach(opt => {
    opt.textContent = messagesMyFriends;
  });

  const messagesMyChats = langMap[currentLang].myChats || "Chats";
  document.querySelectorAll("#messagesMyChats").forEach(opt => {
    opt.textContent = messagesMyChats;
  });

  const noChatselected = langMap[currentLang].noChatSelected || "Select a chat to start messaging";
  document.querySelectorAll("#emptyChatState").forEach(opt => {
    opt.textContent = noChatselected;
  });

  const typeMessagePlaceholder = langMap[currentLang].typeMessagePlaceholder || "Type a message...";
  document.querySelectorAll("#messageInput").forEach(opt => {
    opt.textContent = typeMessagePlaceholder;
  });

  const emptyChat = langMap[currentLang].chatEmptyConversation || "No conversations yet";
  document.querySelectorAll("#emptyChat").forEach(opt => {
    opt.textContent = emptyChat;
  });

  const emptyFriends = langMap[currentLang].chatEmptyFriends || "No friends yet";
  document.querySelectorAll("#emptyFriends").forEach(opt => {
    opt.textContent = emptyFriends;
  });


  const dynamicLabels = {

    // Desktop
    standingsTabBtn: t.standings,
    matchesTabBtn: t.matches,
    teamDesk: t.teams,
    playedDesk: t.played,
    winDesk: t.win,
    drawDesk: t.draw,
    loseDesk: t.lose,
    goalForDesk: t.goalFor,
    goalAgainstDesk: t.goalAgainst,
    goalDifferDesk: t.goalDiffer,
    pointsDesk: t.points,
    playerDesk: t.player,
    teamDesk: t.team,
    playerDesk2: t.player,
    teamDesk2: t.team,
    selectUserDesk: t.selectUser,

    // Mobile
    teamMobile: t.teams,
    playedMob: t.played,
    goalDifferMob: t.goalDiffer,
    pointsMob: t.points,
    winMob: t.win,
    drawMob: t.draw,
    loseMob: t.lose,
    goalForMob: t.goalFor,
    goalAgainstMob: t.goalAgainst,
  };

  for (const [id, value] of Object.entries(dynamicLabels)) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  document.getElementById("loginBtn").innerText = t.login;
  document.getElementById("logoutBtn").innerText = t.logout;
  document.getElementById("registerBtn").innerText = t.registerBtn;
  document.getElementById("loginTitle").innerText = t.login;
  document.getElementById("registerTitle").innerText = t.register;
  document.getElementById("loginSubmit").innerText = t.login;
  document.getElementById("registerSubmit").innerText = t.registerSubmit;
  document.getElementById("createBtn").innerText = t.create;
  document.getElementById("openBtn").innerText = t.open;
  document.getElementById("actionTitle").innerText = t.tableActions;
  document.getElementById("confirmCreateBtn").innerText = t.registerSubmit;
  document.getElementById("competition-types").innerText = t.competitionTypes;
  document.getElementById("createCompetition").innerText = t.createCompetition;
  document.getElementById("clubCount").innerText = t.selectedCount;
  document.getElementById("backBtn").innerText = t.backButton;
  document.getElementById("stageBackBtn").innerText = t.backButton;
  document.getElementById("nationalBackBtn").innerText = t.backButton;
  document.getElementById("cancelBtn").innerText = t.cancel;
  document.getElementById("groupStage").innerText = t.groupStage;
  document.getElementById("knockoutStage").innerText = t.knockoutStage;
  document.getElementById("stage-types").innerText = t.stageType;
  document.getElementById("groupStage-title").innerText = t.groupStage;
  document.getElementById("knockoutStage-title").innerText = t.knockoutStage;
  document.getElementById("profile").innerText = t.profile;
  document.getElementById("friends").innerText = t.friends;

  // Labels
  document.getElementById("regUsernameLabel").textContent = t.username;
  document.getElementById("regEmailLabel").textContent = t.email;
  document.getElementById("regPasswordLabel").textContent = t.password;
  document.getElementById("regConfirmPasswordLabel").textContent = t.confirmPassword;
  document.getElementById("loginEmailLabel").textContent = t.email;
  document.getElementById("loginPasswordLabel").textContent = t.password;
  document.getElementById("leagueNameLabel").textContent = t.leagueName;
  document.getElementById("clubSearchLabel").textContent = t.clubSearch;
  document.getElementById("leagueNameEditlabel").textContent = t.leagueName;
  document.getElementById("countSelectLabel").textContent = t.selectTeamCount;
  document.getElementById("stageSelectLabel").textContent = t.stageType;

  const flag = document.getElementById("langTrigger");
  if (flag) flag.src = `assets/flags/${lang}.svg`;
}

// Icon Titles
function updateIconTitles() {
  const translation = langMap[currentLang];

  document.querySelectorAll(".league-edit-icon").forEach(icon => {
    const isDisabled = icon.classList.contains("icon-disabled");
    icon.title = isDisabled
      ? translation.owner_edit || "Only the owner can edit"
      : translation.edit_league_title || "Edit League";
  });

  document.querySelectorAll(".league-delete-icon").forEach(icon => {
    const isDisabled = icon.classList.contains("icon-disabled");
    icon.title = isDisabled
      ? translation.owner_delete || "Only the owner can delete"
      : translation.delete || "Delete League";
  });
}


function buttonsTranslate() {
  const { delete: deleteLabel = "Delete" } = langMap[currentLang] || {};
  document.querySelectorAll(".action-delete").forEach(button => {
    button.textContent = deleteLabel;
  });

  const { reject: rejectLabel = "Reject" } = langMap[currentLang] || {};
  document.querySelectorAll(".action-reject").forEach(button => {
    button.textContent = rejectLabel;
  });

  const { approve: approveLabel = "Approve" } = langMap[currentLang] || {};
  document.querySelectorAll(".action-approve").forEach(button => {
    button.textContent = approveLabel;
  });

  const { addFriend: addFriend = "Add Friend" } = langMap[currentLang] || {};
  document.querySelectorAll(".action-add-friend").forEach(button => {
    button.textContent = addFriend;
  });

  const { update: update = "Update" } = langMap[currentLang] || {};
  document.querySelectorAll(".profile-save-button").forEach(button => {
    button.textContent = update;
  });

  const { personalDetails: personalDetails = "Personal Details" } = langMap[currentLang] || {};
  document.querySelectorAll("#personalDetailsBtn").forEach(button => {
    button.textContent = personalDetails;
  });

  const { achievements: achievements = "Achievements" } = langMap[currentLang] || {};
  document.querySelectorAll("#achievementsBtn").forEach(button => {
    button.textContent = achievements;
  });

}


function friendStatusesAndSearch() {
  const t = langMap[currentLang] || {};
  let successfulResultFound = false;
  document.querySelectorAll('.status-badge').forEach(badge => {
    const rawStatus = badge.dataset.statusKey;

    if (rawStatus) {
      const translatedStatus = t[rawStatus] || rawStatus;
      badge.textContent = translatedStatus;
      successfulResultFound = true;
    }
  });

  const searchResultElements = document.querySelectorAll(".search-result-item");
  const userSearchFailedKey = 'usersNotExist';
  const searchUsernameResult = t[userSearchFailedKey] || "User not found.";

  if (successfulResultFound) {
    return;
  }

  searchResultElements.forEach(resultElement => {
    if (resultElement && resultElement.classList.contains('status-rejected')) {
      const isSimpleFailureMessage = resultElement.children.length === 0;

      if (isSimpleFailureMessage) {
        resultElement.innerHTML = searchUsernameResult;
      }
    }
  });
}

function placeholderTranslate() {
  const { friendsSearchPlaceholder: searchUserByUsername = "Search or Enter Username..." } = langMap[currentLang] || {};
  document.querySelectorAll("#friendsSearchInput").forEach(inputElement => {
    inputElement.placeholder = searchUserByUsername;
  });

  const { typeMessagePlaceholder: typeMessagePlaceholder = "Type a message..." } = langMap[currentLang] || {};
  document.querySelectorAll("#messageInput").forEach(inputElement => {
    inputElement.placeholder = typeMessagePlaceholder;
  });
}



function updateFriendActionButtonTranslations() {
  const t = langMap[currentLang] || {};

  document.querySelectorAll('.friend-actions button, .friend-actions-menu button.menu-item').forEach(button => {

    const desktopButton = button.closest('.friend-item')?.querySelector('.friend-actions button');
    const labelKey = button.dataset.labelKey || desktopButton?.dataset.labelKey;
    const fallback = button.dataset.fallback || desktopButton?.dataset.fallback;

    if (!labelKey) return;

    const friendId = button.closest('[data-friend-id]')?.dataset.friendId;
    const actionType = button.className.match(/action-([a-z]+)/)?.[1];

    const newOriginalText = t[labelKey] || fallback;

    if (button.classList.contains('confirming-action') && friendId) {

      if (confirmationTimers[`timer-${friendId}`]) {
        clearTimeout(confirmationTimers[`timer-${friendId}`]);
      }
      const resetFunction = confirmationTimers[`reset-${friendId}`];
      if (resetFunction) {
        resetFunction();
        const confirmWord = t.confirm || "Confirm";
        const newConfirmationText = `${confirmWord} ${actionType.charAt(0).toUpperCase() + actionType.slice(1)}?`;

        button.textContent = newConfirmationText;
        button.classList.add('confirming-action');
        confirmationTimers[friendId] = actionType;

        const newTimerId = setTimeout(resetFunction, 2000);
        confirmationTimers[`timer-${friendId}`] = newTimerId;

      }


    } else {
      button.textContent = newOriginalText;
    }
  });
}


// Live Data
function liveDataTranslation() {

  const { live_all_games: liveAllMatches = "All" } = langMap[currentLang] || {};
  document.querySelectorAll("#live_all_matches").forEach(element => {
    element.textContent = liveAllMatches;
  });

  const { live_direct_games: liveDirectMatches = "Live" } = langMap[currentLang] || {};
  document.querySelectorAll("#live_direct_matches").forEach(element => {
    element.textContent = liveDirectMatches;
  });

  const { live_standings: liveStanding = "Standings" } = langMap[currentLang] || {};
  document.querySelectorAll("#live_standings").forEach(element => {
    element.textContent = liveStanding;
  });

  const { live_fixtures: liveMatches = "Matches" } = langMap[currentLang] || {};
  document.querySelectorAll("#live_matches").forEach(element => {
    element.textContent = liveMatches;
  });

  const { live_all_games: liveAllGames = "All" } = langMap[currentLang] || {};
  document.querySelectorAll('api-sports-widget button.btn-widget-link[data-action="all"]').forEach(element => {
    element.textContent = liveAllGames;
  });

  const { live_direct_games: liveDirectGames = "Live" } = langMap[currentLang] || {};
  document.querySelectorAll('api-sports-widget button.btn-widget-link[data-action="live"]').forEach(element => {
    element.textContent = liveDirectGames;
  });

  const { live_home_games: liveHomeGames = "Home" } = langMap[currentLang] || {};
  document.querySelectorAll('api-sports-widget button.btn-widget-link[data-action="home"]').forEach(element => {
    element.textContent = liveHomeGames;
  });

  const { live_away_games: liveAwayGames = "Away" } = langMap[currentLang] || {};
  document.querySelectorAll('api-sports-widget button.btn-widget-link[data-action="away"]').forEach(element => {
    element.textContent = liveAwayGames;
  });


  const { live_finished_games: liveFinishedGames = "Finished" } = langMap[currentLang] || {};
  document.querySelectorAll('api-sports-widget button.btn-widget-link[data-action="finished"]').forEach(element => {
    element.textContent = liveFinishedGames;
  });

  const { live_scheduled_games: liveScheduledGames = "Scheduled" } = langMap[currentLang] || {};
  document.querySelectorAll('api-sports-widget button.btn-widget-link[data-action="scheduled"]').forEach(element => {
    element.textContent = liveScheduledGames;
  });

  const { liveTitleFootball: allAboutFootball = "All About Football" } = langMap[currentLang] || {};
  document.querySelectorAll("#liveTitleFootball").forEach(element => {
    element.textContent = allAboutFootball;
  });
}

// Live empty results
//
// Two different "empty" states need two different messages:
//
//   • `.widgetUnavailable` - our OWN element, injected by watchWidgetHost() only
//     when the widget genuinely failed to load (stuck / never mounted, e.g. the
//     API subscription ended). -> "Data is currently unavailable".
//
//   • the widget's OWN `.empty-result` inside <standing-component> /
//     <games-component> - the widget loaded fine but there are simply no
//     standings/matches for the current selection (e.g. a league with no
//     fixtures today / off-season). This is NOT a failure, so it must NOT say
//     "unavailable"; it shows "No standings/matches available for this league".
function translateEmptyResults() {
  const t = langMap[currentLang] || {};
  const unavailable =
    t.live_subscription_expired || "Data is currently unavailable";
  const noStandings =
    t.live_empty_standings || "No standings available for this league";
  const noMatches =
    t.live_empty_matches || "No matches available for this league";

  // NOTE: setting `.textContent` replaces child nodes and emits a childList
  // mutation EVEN WHEN the value is unchanged. Because this runs from a
  // document.body MutationObserver, an unconditional write re-triggers the
  // observer -> writes again -> infinite microtask loop that freezes the UI.
  // Only write when the value actually changes.
  const setText = (el, target) => {
    if (el.textContent !== target) el.textContent = target;
  };

  // Genuine load failure (our element).
  document
    .querySelectorAll(".widgetUnavailable")
    .forEach((el) => setText(el, unavailable));

  // Widget loaded, just no data for this selection. `:not(.widgetUnavailable)`
  // guards against our own element (which also carries `.empty-result`).
  document
    .querySelectorAll("standing-component .empty-result:not(.widgetUnavailable)")
    .forEach((el) => setText(el, noStandings));
  document
    .querySelectorAll("games-component .empty-result:not(.widgetUnavailable)")
    .forEach((el) => setText(el, noMatches));
}

const observer = new MutationObserver(() => {
  translateEmptyResults();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});


// Homepage Cards
function hompageCardTranslations() {
  const { liveFootball: live_Football = "Scores & Classement" } = langMap[currentLang] || {};
  document.querySelectorAll("#liveFootball").forEach(element => {
    element.textContent = live_Football;
  });

  const { liveFootballTitle: live_FootballTitle = "Live scores, Upcoming matches, Results" } = langMap[currentLang] || {};
  document.querySelectorAll("#liveFootballTitle").forEach(element => {
    element.textContent = live_FootballTitle;
  });

  const { liveFootballDescription: live_FootballDescription = "Stay connected with live matches, real-time scores, and instant game updates from leagues around the world. Everything updates automatically as the action happens." } = langMap[currentLang] || {};
  document.querySelectorAll("#liveFootballDescription").forEach(element => {
    element.textContent = live_FootballDescription;
  });

  const { openLiveFootball: live_FootballOpen = "Open Live Football" } = langMap[currentLang] || {};
  document.querySelectorAll("#openLiveFootball").forEach(element => {
    element.textContent = live_FootballOpen;
  });

  const { customLeague: custome_league = "Custom League" } = langMap[currentLang] || {};
  document.querySelectorAll("#customLeague").forEach(element => {
    element.textContent = custome_league;
  });

  const { customLeagueTitle: custome_leagueTitle = "Create & Manage your own leagues" } = langMap[currentLang] || {};
  document.querySelectorAll("#customLeagueTitle").forEach(element => {
    element.textContent = custome_leagueTitle;
  });

  const { customLeagueDescription: custome_leagueDescription = "Build your own league, invite friends, assign teams, and track standings and matches in one place. You control the rules, results, and competition format." } = langMap[currentLang] || {};
  document.querySelectorAll("#customLeagueDescription").forEach(element => {
    element.textContent = custome_leagueDescription;
  });

  const { openCustomleague: custome_leagueOpen = "Open Custom Leagues" } = langMap[currentLang] || {};
  document.querySelectorAll("#openCustomleague").forEach(element => {
    element.textContent = custome_leagueOpen;
  });
}


// SEO content section
function seoContentTranslations() {
  const t = langMap[currentLang] || {};
  const setText = (id, value) => {
    if (value == null) return;
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("seoH1", t.seoH1);
  setText("seoHeading", t.seoHeading);
  setText("seoIntro", t.seoIntro);
  setText("seoCustomHeading", t.seoCustomHeading);
  setText("seoCustomText", t.seoCustomText);
  setText("seoFeaturesHeading", t.seoFeaturesHeading);
  setText("seoFeat1Label", t.seoFeat1Label);
  setText("seoFeat1Text", t.seoFeat1Text);
  setText("seoFeat2Label", t.seoFeat2Label);
  setText("seoFeat2Text", t.seoFeat2Text);
  setText("seoFeat3Label", t.seoFeat3Label);
  setText("seoFeat3Text", t.seoFeat3Text);
  setText("seoFeat4Label", t.seoFeat4Label);
  setText("seoFeat4Text", t.seoFeat4Text);
  setText("seoLinkLive", t.seoLinkLive);
  setText("seoLinkCustom", t.seoLinkCustom);

  // Point internal landing-page links at the version for the current language
  // (en -> /live-scores, am -> /am/live-scores, fr -> /fr/live-scores)
  const prefix = currentLang === "en" ? "" : `/${currentLang}`;
  const liveLink = document.getElementById("seoLinkLive");
  if (liveLink) liveLink.setAttribute("href", `${prefix}/live-scores/`);
  const customLink = document.getElementById("seoLinkCustom");
  if (customLink) customLink.setAttribute("href", `${prefix}/custom-leagues/`);

  setText("footerAbout", t.footerAbout);
  setText("footerContact", t.footerContact);
  setText("footerPrivacy", t.footerPrivacy);

  const footerAboutEl = document.getElementById("footerAbout");
  if (footerAboutEl) footerAboutEl.setAttribute("href", `${prefix}/about/`);
  const footerContactEl = document.getElementById("footerContact");
  if (footerContactEl) footerContactEl.setAttribute("href", `${prefix}/contact/`);
  const footerPrivacyEl = document.getElementById("footerPrivacy");
  if (footerPrivacyEl) footerPrivacyEl.setAttribute("href", `${prefix}/privacy/`);
}


// Export + global registration
export { changeLang, currentLang };
window.changeLang = changeLang;
window.langMap = langMap;
window.currentLang = currentLang;

// Immediately apply
changeLang(currentLang, { silent: true });
window.__APP_BOOTING__ = false;

window.addEventListener("lang:changed", () => {
  translateWidgetActionButtons();
  requestAnimationFrame(translateWidgetActionButtons);
  setTimeout(translateWidgetActionButtons, 200);
});