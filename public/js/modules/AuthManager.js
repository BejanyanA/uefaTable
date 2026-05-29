import { showToast } from '../utils/toast.js';
import { isValidEmail, isValidPassword, detectSpace } from '../utils/validators.js';
import { langMap, currentLang } from '../modules/LanguageManager.js';
import { setError, clearErrors } from '../utils/helper.js';
import { apiPost, apiGet } from '../services/api.js';
import { initNotifications } from './NotificationManager.js';
import { setHomeOptionsVisible, setCustomCompetitionVisible, setLiveVisible } from "./HomeOptions.js";
import { customLeagues } from './CustomLeagues.js';

export const AuthManager = {
  initLogin: function () {

    const form = document.getElementById("loginForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const translation = langMap[currentLang];
      clearErrors(["loginEmailError", "loginPasswordError"]);

      let hasError = false;

      const emailInput = document.getElementById("loginEmail");
      const passwordInput = document.getElementById("loginPassword");

      const loginEmailError = document.getElementById("loginEmailError");
      const loginPasswordError = document.getElementById("loginPasswordError");

      // Email Validations
      if (!emailInput.value.trim()) {
        setError("loginEmailError", translation.required);
        hasError = true;
      } else if (!isValidEmail(emailInput.value)) {
        setError("loginEmailError", translation.invalidEmail);
        hasError = true;
      }

      // Password Validations
      if (!passwordInput.value.trim()) {
        setError("loginPasswordError", translation.required);
        hasError = true;
      } else if (!isValidPassword(passwordInput.value.trim())) {
        setError("loginPasswordError", translation.invalidPassword);
        hasError = true;
      } else if (detectSpace(passwordInput.value.trim())) {
        setError("loginPasswordError", translation.no_spaces_allowed);
        hasError = true;
      }

      if (hasError) return;

      loginEmailError.textContent = "";
      loginPasswordError.textContent = "";

      try {
        const loginData = await apiPost("/login", {
          email: emailInput.value,
          password: passwordInput.value
        });

        if (loginData.success && loginData.token) {
          localStorage.setItem("authToken", loginData.token);

          // Read post‑login flags
          const postLoginAction = sessionStorage.getItem("postLoginAction"); // e.g. 'openCustom'
          const actionForLive = sessionStorage.getItem("actionForLive");   // e.g. 'openLive'

          // Scenario 1: user clicked Custom League while not logged in
          if (postLoginAction === "openCustom") {
            sessionStorage.removeItem("postLoginAction");

            document.getElementById("headerUsername").style.display = "block";
            document.getElementById("notificationBell").style.display = "block";
            document.getElementById("profileMenu").style.display = "block";
            document.getElementById("loginBtn").style.display = "none";
            document.getElementById("registerBtn").style.display = "none";
            initNotifications();

            await customLeagues();               // call your custom‑league API here
            setHomeOptionsVisible(false);
            setCustomCompetitionVisible(true);
            location.hash = "leagues";

            // Scenario 3: user just clicked the login button normally
          } else {
            // Fetch the user profile
            const me = await apiGet("/me", localStorage.getItem("authToken"));
            if (me.success) {
              // Update UI with user data
              localStorage.setItem("user", JSON.stringify(me.user));
              document.getElementById("headerUsername").style.display = "block";
              document.getElementById("notificationBell").style.display = "block";
              document.getElementById("profileMenu").style.display = "block";
              document.getElementById("homePageIcon").style.display = "none";
              document.getElementById("loginBtn").style.display = "none";
              document.getElementById("registerBtn").style.display = "none";
              const usernameEl = document.getElementById("headerUsernameTitle");
              if (usernameEl && me.user.username) {
                usernameEl.textContent = me.user.username;
              }
              initNotifications();
            }
            // Default home page state
            setHomeOptionsVisible(true);
            setCustomCompetitionVisible(false);

            // Scenario 2: user clicked Live while not logged in
          } if (actionForLive === "openLive") {
            sessionStorage.removeItem("actionForLive");

            document.getElementById("headerUsername").style.display = "block";
            document.getElementById("notificationBell").style.display = "block";
            document.getElementById("profileMenu").style.display = "block";
            document.getElementById("loginBtn").style.display = "none";
            document.getElementById("registerBtn").style.display = "none";
            initNotifications();

            setLiveVisible(true);
            setHomeOptionsVisible(false);
            setCustomCompetitionVisible(false);
            location.hash = "live";
          }

          // Close the modal regardless of scenario
          closeModal("loginModal");

        } else {
          showToast(translation.invalid_email_or_password || "Login failed", "error");
          localStorage.removeItem("authToken");
          localStorage.removeItem("leaguesActiveTab");
          localStorage.removeItem("lastActiveLeagueTab");
          localStorage.removeItem("lastActiveNationalLeagueTab");
          localStorage.removeItem("user");
          localStorage.removeItem("currentBannerId");
          localStorage.removeItem("leagueId");
          localStorage.removeItem("selectedStageType");
        }
      } catch (err) {
        showToast(translation.something_went_wrong, "error");
        console.error(err);
      }
    });
  },

  initRegister: function () {

    const form = document.getElementById("registerForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const translation = langMap[currentLang];
      clearErrors(["regUsernameError", "regEmailError", "regPasswordError", "regConfirmPasswordError"]);

      let hasError = false;

      const regUsernameInput = document.getElementById("regUsername");
      const regEmailInput = document.getElementById("regEmail");
      const regPasswordInput = document.getElementById("regPassword");
      const regConfPasswordInput = document.getElementById("regConfirmPassword");

      const regUsernameError = document.getElementById("regUsernameError");
      const regEmailError = document.getElementById("regEmailError");
      const regPasswordError = document.getElementById("regPasswordError");
      const regConfPasswordError = document.getElementById("regConfirmPasswordError");

      // Username Validations
      if (!regUsernameInput.value.trim()) {
        setError("regUsernameError", translation.required);
        hasError = true;
      } else if (regUsernameInput.value.trim().length < 3) {
        setError("regUsernameError", translation.shortUsername);
        hasError = true;
      } else if (regUsernameInput.value.trim().length > 10) {
        setError("regUsernameError", translation.longUsername);
        hasError = true;
      } else if (detectSpace(regUsernameInput.value.trim())) {
        setError("regUsernameError", translation.no_spaces_allowed);
        hasError = true;
      }

      // Email Validations
      if (!regEmailInput.value.trim()) {
        setError("regEmailError", translation.required);
        hasError = true;
      } else if (!isValidEmail(regEmailInput.value)) {
        setError("regEmailError", translation.invalidEmail);
        hasError = true;
      }

      // Password Validations
      if (!regPasswordInput.value.trim()) {
        setError("regPasswordError", translation.required);
        hasError = true;
      } else if (regPasswordInput.value === regUsernameInput.value) {
        setError("regPasswordError", translation.passMatchUsername);
        hasError = true;
      } else if (regPasswordInput.value.trim().length > 30) {
        setError("regPasswordError", translation.longPassword);
        hasError = true;
      } else if (!isValidPassword(regPasswordInput.value.trim())) {
        setError("regPasswordError", translation.invalidPassword);
        hasError = true;
      } else if (detectSpace(regPasswordInput.value.trim())) {
        setError("regPasswordError", translation.no_spaces_allowed);
        hasError = true;
      }

      // Confirm Password Validations
      if (!regConfPasswordInput.value.trim()) {
        setError("regConfirmPasswordError", translation.required);
        hasError = true;
      } else if (regPasswordInput.value !== regConfPasswordInput.value) {
        setError("regConfirmPasswordError", translation.mismatch);
        hasError = true;
      } else if (regConfPasswordInput.value.trim().length > 30) {
        setError("regConfirmPasswordError", translation.longPassword);
        hasError = true;
      } else if (detectSpace(regConfPasswordInput.value.trim())) {
        setError("regConfirmPasswordError", translation.no_spaces_allowed);
        hasError = true;
      }

      if (hasError) return;

      regUsernameError.textContent = "";
      regEmailError.textContent = "";
      regPasswordError.textContent = "";
      regConfPasswordError.textContent = "";

      try {
        const registrData = await apiPost("/register", {
          username: regUsernameInput.value,
          email: regEmailInput.value,
          password: regPasswordInput.value
        });

        if (registrData.success) {
          closeModal("registerModal");
          showToast(translation.registration_success || "Successfully Registered", "success");
          openModal("loginModal");
        } else {
          const errors = registrData.errors;

          if (errors && typeof errors === "object") {
            if (errors.username) regUsernameError.textContent = translation.username_exists;
            if (errors.email) regEmailError.textContent = translation.email_exists;
            if (errors.password) regPasswordError.textContent = translation.password_error;
          } else {
            showToast(translation.registration_failed || "Registration failed", "error");
          }
        }
      } catch (err) {
        showToast(translation.something_went_wrong, "error");
        console.error(err);
      }
    });
  }
};