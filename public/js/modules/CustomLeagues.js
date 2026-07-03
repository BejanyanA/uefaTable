import { apiGet } from '../services/api.js';
import { initNotifications } from './NotificationManager.js';
import { STORAGE_KEYS, clearAuthSession, clearActiveLeagueTabs } from '../utils/storageKeys.js';

// 🔹 JWT Check on Load
export async function customLeagues() {
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
      const data = await apiGet("/custom-leagues", { showLoading: false });
      if (data.success && data.user) {
         document.getElementById("homePage").style.display = "none";
         document.getElementById("headerUsername").style.display = "block";
         document.getElementById("notificationBell").style.display = "block";
         document.getElementById("profileMenu").style.display = "block";
         document.getElementById("messagesBtn").style.display = "block";
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