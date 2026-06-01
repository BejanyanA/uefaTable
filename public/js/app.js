import { checkLoggedIn, logout } from './modules/MeHomepage.js';
import { AuthManager } from './modules/AuthManager.js';
import { LeagueManager } from './modules/LeagueManager.js';
import { FriendManager } from './modules/FriendManager.js';
import { ProfileManager } from './modules/ProfileManager.js';
import { changeLang, currentLang } from './modules/LanguageManager.js';
import { ModalManager } from './modules/ModalManager.js';
import { initHomeOptionButtons } from './modules/HomeOptions.js';
import { initRouter } from "../js/modules/router.js"; // adjust path if needed
import { initMessagesPage, connectChatSocket, updateHeaderMessagesBadge } from "./modules/Messages.js";
import { refreshPresenceTexts } from "./modules/UserStatus.js";

// ✅ Register modal methods globally
window.openModal = ModalManager.open;
window.closeModal = ModalManager.close;
window.togglePassword = ModalManager.togglePassword;

// ✅ Init App
document.addEventListener('DOMContentLoaded', async () => {
   AuthManager.initLogin();
   AuthManager.initRegister();
   LeagueManager.initCreate();
   LeagueManager.initOpen();
   FriendManager.openFriends();
   FriendManager.closeFriends();
   ProfileManager.openProfile();
   changeLang(currentLang);

   initRouter();
   checkLoggedIn();
   initHomeOptionButtons();
   initMessagesPage();
   window.logout = logout;

   await initGlobalUserState();

   const action = sessionStorage.getItem("postLogoutAction");
   if (action === "openLogin") {
      sessionStorage.removeItem("postLogoutAction");
      sessionStorage.removeItem("postLoginAction");
      // make sure openModal is available by now
      openModal("loginModal");
   }


   window.addEventListener("hashchange", () => {
      if (window.ym) {
         ym(106431737, "hit", location.pathname + location.hash);
      }
   });

   // optional: send initial page view once
   if (typeof window.ym === "function") {
      ym(106431737, "hit", location.pathname + (location.hash || "#home"));
   }
});

// 🔹 Language Dropdown
window.toggleDropdown = function () {
   const dropdown = document.getElementById("langDropdown");
   dropdown.classList.toggle("show");
};

window.setLanguage = function (lang) {
   const flag = document.getElementById("langTrigger");
   flag.src = `assets/flags/${lang}.svg`;

   const dropdown = document.getElementById("langDropdown");
   if (dropdown) dropdown.classList.remove("show");

   if (typeof changeLang === "function") {
      changeLang(lang);
   }

   refreshPresenceTexts();
};

// 🔹 Close lang dropdown on outside click
document.addEventListener("click", function (e) {
   const dropdown = document.getElementById("langDropdown");
   const trigger = document.getElementById("langTrigger");

   if (
      dropdown && trigger &&
      !dropdown.contains(e.target) &&
      !trigger.contains(e.target) &&
      !e.target.closest(".language-option")
   ) {
      dropdown.classList.remove("show");
   }
});

// ✅ Close ALL opened popups/modals on ESC
document.addEventListener('keydown', (event) => {
   if (event.key !== 'Escape') return;

   const openModals = [...document.querySelectorAll('.modal')]
      .filter(modal => window.getComputedStyle(modal).display !== 'none');

   openModals.forEach(modal => {
      closeModal(modal.id);
   });
});

async function initGlobalUserState() {
   const token = localStorage.getItem("authToken");

   if (!token) return;

   connectChatSocket();

   await updateHeaderMessagesBadge();
}