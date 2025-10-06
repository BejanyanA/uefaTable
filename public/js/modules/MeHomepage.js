import { apiGet } from '../services/api.js';

// 🔹 JWT Check on Load
export async function checkLoggedIn() {
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
         // document.getElementById("logoutButtn").style.display = "block";
         document.getElementById("homePage").style.display = "block";
         document.getElementById("headerUsername").style.display = "block";
         document.getElementById("profileMenu").style.display = "block";
         localStorage.setItem('user', JSON.stringify(data.user.username));
         localStorage.removeItem("lastActiveLeagueTab");
         localStorage.removeItem("lastActiveNationalLeagueTab");
      } else {
         localStorage.removeItem("authToken");
         localStorage.removeItem("lastActiveLeagueTab");
         localStorage.removeItem("lastActiveNationalLeagueTab");
         localStorage.removeItem("user");
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
export function logout() {
   localStorage.removeItem("authToken");
   localStorage.removeItem("lastActiveLeagueTab");
   localStorage.removeItem("lastActiveNationalLeagueTab");
   localStorage.removeItem("user");
   localStorage.removeItem("currentBannerId");
   localStorage.removeItem("leagueId");
   localStorage.removeItem("selectedStageType");
   location.reload();

   document.getElementById("homePage").style.display = "none";
   document.getElementById("welcomeUser").innerText = "";

   document.getElementById("loginBtn").style.display = "inline-block";
   document.getElementById("registerBtn").style.display = "inline-block";
};