import { apiGet } from '../services/api.js';
import { initNotifications } from './NotificationManager.js';

// 🔹 JWT Check on Load
export async function customLeagues() {
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
      const data = await apiGet("/custom-leagues", token); // ✅ Cleaner
      if (data.success && data.user) {
         document.getElementById("homePage").style.display = "none";
         document.getElementById("headerUsername").style.display = "block";
         document.getElementById("notificationBell").style.display = "block";
         document.getElementById("profileMenu").style.display = "block";
         document.getElementById("homePageIcon").style.display = "block";
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