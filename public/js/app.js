import { AuthManager } from './modules/AuthManager.js';
import { LeagueManager } from './modules/LeagueManager.js';
import { getFriends } from './modules/GetFriends.js';
import { getClubs } from './modules/GetClubs.js';
import { changeLang, currentLang } from './modules/LanguageManager.js';
import { ModalManager } from './modules/ModalManager.js';
import { apiGet } from './services/api.js'; 

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
   changeLang(currentLang);
   checkLoggedIn();
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

// 🔹 JWT Check on Load
async function checkLoggedIn() {
   const token = localStorage.getItem("authToken");
   const authButtons = document.getElementById("authButtons");
   const bannerSection = document.querySelector(".banner-container");

   if (!token) {
      if (authButtons) authButtons.style.display = "flex";
      return;
   }

   try {
      const data = await apiGet("/me", token); // ✅ Cleaner
      if (data.success && data.user) {
         document.getElementById("logoutButtn").style.display = "block";
         document.getElementById("homePage").style.display = "block";
      } else {
         localStorage.removeItem("authToken");
         if (authButtons) authButtons.style.display = "flex";
      }
   } catch (err) {
      console.error("Token check failed", err);
      localStorage.removeItem("authToken");
      if (authButtons) authButtons.style.display = "flex";
      if (bannerSection) bannerSection.style.display = "none";
   }
}

// 🔹 Logout
window.logout = function () {
   localStorage.removeItem("authToken");
   location.reload();

   document.getElementById("homePage").style.display = "none";
   document.getElementById("welcomeUser").innerText = "";

   document.getElementById("loginBtn").style.display = "inline-block";
   document.getElementById("registerBtn").style.display = "inline-block";
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