import { checkLoggedIn, logout } from './modules/MeHomepage.js';
import { AuthManager } from './modules/AuthManager.js';
import { LeagueManager } from './modules/LeagueManager.js';
import { ProfileManager } from './modules/ProfileManager.js';
import { changeLang, currentLang } from './modules/LanguageManager.js';
import { ModalManager } from './modules/ModalManager.js';

// ✅ Register modal methods globally
window.openModal = ModalManager.open;
window.closeModal = ModalManager.close;
window.togglePassword = ModalManager.togglePassword;

// ✅ Init App
document.addEventListener('DOMContentLoaded', () => {
   AuthManager.initLogin();
   AuthManager.initRegister();
   LeagueManager.initCreate();
   LeagueManager.initOpen();
   ProfileManager.openFriends();
   changeLang(currentLang);
   
   checkLoggedIn();
   window.logout = logout;
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