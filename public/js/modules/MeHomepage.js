import { apiGet } from '../services/api.js';
import { initNotifications } from './NotificationManager.js';
import { customLeagues } from './CustomLeagues.js';
import { connectChatSocket } from './Messages.js';
import { connectPresenceSocket } from './UserStatus.js';

// 🔹 JWT Check on Load
export async function checkLoggedIn() {
   const token = localStorage.getItem("authToken");
   const authButtons = document.getElementById("authButtons");
   const bannerSection = document.querySelector(".banner-container");

   if (!token) {
      if (authButtons) authButtons.style.display = "flex";
      return;
   } else {
      initNotifications();
   }

   try {
      const data = await apiGet("/me", token); // ✅ Cleaner
      if (data.success && data.user) {
         connectChatSocket();
         connectPresenceSocket();

         document.getElementById("headerUsername").style.display = "block";
         document.getElementById("notificationBell").style.display = "block";
         document.getElementById("profileMenu").style.display = "block";
         document.getElementById("messagesBtn").style.display = "block";
         document.getElementById("homePageIcon").style.display = "none";
         localStorage.setItem('user', JSON.stringify(data.user));
         localStorage.removeItem("lastActiveLeagueTab");
         localStorage.removeItem("lastActiveNationalLeagueTab");

         const usernameEl = document.getElementById("headerUsernameTitle");
         if (usernameEl && data.user.username) {
            usernameEl.textContent = data.user.username;
         }

      } else {
         localStorage.removeItem("authToken");
         localStorage.removeItem("leaguesActiveTab");
         localStorage.removeItem("lastActiveLeagueTab");
         localStorage.removeItem("lastActiveNationalLeagueTab");
         localStorage.removeItem("user");
         localStorage.removeItem("currentBannerId");
         localStorage.removeItem("leagueId");
         localStorage.removeItem("selectedStageType");
         if (authButtons) authButtons.style.display = "flex";
      }
   } catch (err) {
      console.error("Token check failed", err);
      localStorage.removeItem("authToken");
      if (authButtons) authButtons.style.display = "flex";
      if (bannerSection) bannerSection.style.display = "none";
   }
}

export function homepage() {
   const homeButton = document.getElementById("homePageIcon");

   homeButton.addEventListener("click", async () => {
      const token = localStorage.getItem("authToken");
      location.hash = "home";

      try {
         const response = await apiGet("/me", token);
         if (response.success && response.user) {
            connectChatSocket();
            connectPresenceSocket();

            document.getElementById("headerUsername").style.display = "block";
            document.getElementById("notificationBell").style.display = "block";
            document.getElementById("profileMenu").style.display = "block";
            document.getElementById("messagesBtn").style.display = "block";
            document.getElementById("homePageIcon").style.display = "none";
            localStorage.setItem('user', JSON.stringify(response.user));
            localStorage.removeItem("lastActiveLeagueTab");
            localStorage.removeItem("lastActiveNationalLeagueTab");

            const usernameEl = document.getElementById("headerUsernameTitle");
            if (usernameEl && response.user.username) {
               usernameEl.textContent = response.user.username;
            }

         } else {
            localStorage.removeItem("authToken");
            localStorage.removeItem("leaguesActiveTab");
            localStorage.removeItem("lastActiveLeagueTab");
            localStorage.removeItem("lastActiveNationalLeagueTab");
            localStorage.removeItem("user");
            localStorage.removeItem("currentBannerId");
            localStorage.removeItem("leagueId");
            localStorage.removeItem("selectedStageType");
            if (authButtons) authButtons.style.display = "flex";

         }
      } catch (err) {
         console.error("🔴 Error in Back button to /me:", err);
         localStorage.removeItem("authToken");
         if (authButtons) authButtons.style.display = "flex";
      }
   });
}

// 🔹 Logout
export function logout() {
   showLoading: true
   location.hash = "home";

   [
      "authToken",
      "user",
      "leaguesActiveTab",
      "lastActiveLeagueTab",
      "lastActiveNationalLeagueTab",
      "currentBannerId",
      "leagueId",
      "selectedStageType",
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