import { apiGet } from '../services/api.js';
import { initNotifications } from './NotificationManager.js';
import { customLeagues } from './CustomLeagues.js';
import { connectChatSocket } from './Messages.js';
import { connectPresenceSocket } from './UserStatus.js';
import { STORAGE_KEYS, clearAuthSession, clearActiveLeagueTabs } from '../utils/storageKeys.js';
import { navigateTo } from './router.js';

// 🔹 JWT Check on Load
export async function checkLoggedIn() {
   const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
   const authButtons = document.getElementById("authButtons");
   const bannerSection = document.querySelector(".banner-container");

   if (!token) {
      if (authButtons) authButtons.style.display = "flex";
      return;
   } else {
      initNotifications();
   }

   try {
      const data = await apiGet("/me");
      if (data.success && data.user) {
         connectChatSocket();
         connectPresenceSocket();

         document.getElementById("headerUsername").style.display = "block";
         document.getElementById("notificationBell").style.display = "block";
         document.getElementById("profileMenu").style.display = "block";
         document.getElementById("messagesBtn").style.display = "block";
         // document.getElementById("homePageIcon").style.display = "none";
         localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
         clearActiveLeagueTabs();

         const usernameEl = document.getElementById("headerUsernameTitle");
         if (usernameEl && data.user.username) {
            usernameEl.textContent = data.user.username;
         }

      } else {
         clearAuthSession();
         if (authButtons) authButtons.style.display = "flex";
      }
   } catch (err) {
      console.error("Token check failed", err);
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      if (authButtons) authButtons.style.display = "flex";
      if (bannerSection) bannerSection.style.display = "none";
   }
}

export function homepage() {
   const homeButton = document.getElementById("homePageIcon");

   homeButton.addEventListener("click", async () => {
      const authButtons = document.getElementById("authButtons");
      navigateTo("home");

      try {
         const response = await apiGet("/me");
         if (response.success && response.user) {
            connectChatSocket();
            connectPresenceSocket();

            document.getElementById("headerUsername").style.display = "block";
            document.getElementById("notificationBell").style.display = "block";
            document.getElementById("profileMenu").style.display = "block";
            document.getElementById("messagesBtn").style.display = "block";
            document.getElementById("homePageIcon").style.display = "none";
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.user));
            clearActiveLeagueTabs();

            const usernameEl = document.getElementById("headerUsernameTitle");
            if (usernameEl && response.user.username) {
               usernameEl.textContent = response.user.username;
            }

         } else {
            clearAuthSession();
            if (authButtons) authButtons.style.display = "flex";

         }
      } catch (err) {
         console.error("🔴 Error in Back button to /me:", err);
         localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
         if (authButtons) authButtons.style.display = "flex";
      }
   });
}

// 🔹 Logout
export function logout() {
   navigateTo("home");

   clearAuthSession();
   [
      "groupId",
      "groupId:ucl-basic-my-A",
      "groupName",
      "groupName:ucl-basic-my-A",
      "lastActiveInstancesTab",
      "lastGroupLetter:ucl-basic-my",
      "lastLeagueKey",
      "leagueId:ucl-basic-my",
      "leagueId:wc-basic-my",
      "lastActiveNationalInstancesTab"
   ].forEach(key => localStorage.removeItem(key));

   requestAnimationFrame(() => {
      location.reload();
   });
}