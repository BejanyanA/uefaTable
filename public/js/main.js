import { showToast } from './toast.js';

// 🔹 1. Utility + UI functions first (openModal, closeModal, setError, etc.)
function openModal(id) {
  // Close all other modals
  document.querySelectorAll(".modal").forEach(modal => {
    modal.style.display = "none";
  });

  // Reset form in this modal (if any)
  const modal = document.getElementById(id);
  const form = modal.querySelector("form");
  if (form) {
    form.reset();
    form.querySelectorAll(".error").forEach(el => el.textContent = "");
  }

  // Show the desired modal
  modal.style.display = "flex";

  // Disable background interactions
  document.body.classList.add("modal-open");
}
window.openModal = openModal;


function closeModal(id) {
  const modal = document.getElementById(id);
  modal.style.display = "none";

  const form = modal.querySelector("form");
  if (form) {
    form.reset();
    form.querySelectorAll(".error").forEach(el => el.textContent = "");
  }

  // Re-enable background
  document.body.classList.remove("modal-open");
}
window.closeModal = closeModal;

function togglePassword(inputId, icon) {
  const input = document.getElementById(inputId);
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  icon.src = isPassword ? "assets/eye-off.svg" : "assets/eye.svg"; 
}
window.togglePassword = togglePassword;

// Validations
function setError(id, message) {
  document.getElementById(id).textContent = message;
}

function clearErrors(ids) {
  ids.forEach(id => document.getElementById(id).textContent = "");
}

function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function isValidPassword(password) {
  const minLength = /.{8,}/;
  const upper = /[A-Z]/;
  const lower = /[a-z]/;
  const number = /[0-9]/;
  const special = /[!@#$%^&*(),.?":{}|<>]-_/;

  return (
    minLength.test(password) &&
    upper.test(password) &&
    lower.test(password) &&
    number.test(password) &&
    special.test(password)
  );
}


// 🔹 2. Constants
const API_BASE = "https://api.uefaresults.com";


// 🔹 3. Form submit event listeners (Register + Login)
// Registration
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const translation = langMap[currentLang];
  clearErrors(["regUsernameError", "regEmailError", "regPasswordError", "regConfirmPasswordError"]);

  let hasError = false;

  if (!regUsername.value.trim()) {
    setError("regUsernameError", translation.required);
    hasError = true;
  } else if (regUsername.value.trim().length < 3) {
    setError("regUsernameError", translation.shortUsername);
    hasError = true;
  }

  if (!regEmail.value.trim()) {
    setError("regEmailError", translation.required);
    hasError = true;
  } else if (!isValidEmail(regEmail.value)) {
    setError("regEmailError", translation.invalidEmail);
    hasError = true;
  }

  if (!regPassword.value.trim()) {
    setError("regPasswordError", translation.required);
    hasError = true;
  } else if (!isValidPassword(regPassword.value.trim())) {
    setError("regPasswordError", translation.invalidPassword);
    hasError = true;
  }

  if (!regConfirmPassword.value.trim()) {
    setError("regConfirmPasswordError", translation.required);
    hasError = true;
  } else if (regPassword.value !== regConfirmPassword.value) {
    setError("regConfirmPasswordError", translation.mismatch);
    hasError = true;
  }

  // Registration: BackEnd error handling
  if (hasError) return;

  // Clear all error messages before sending request
  regUsernameError.textContent = "";
  regEmailError.textContent = "";
  regPasswordError.textContent = "";

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: regUsername.value,
        email: regEmail.value,
        password: regPassword.value
      })
    });

    const registrData = await res.json();

    if (registrData.success) {
      closeModal("registerModal");
      showToast(translation.registration_success || "Successfully Registered", "success");
      openModal("loginModal");
    } else {

      // Error handling
      const errors = registrData.errors;

      if (errors && typeof errors === "object") {
        if (errors.username) regUsernameError.textContent = translation.username_exists;
        if (errors.email) regEmailError.textContent = translation.email_exists;
        if (errors.password) regPasswordError.textContent = translation.password_error;
      } else {
        // Fallback to toast if no field-specific error structure
        showToast(translation.registration_failed || "Registration failed", "error");
      }
    }
  } catch (err) {
    showToast(translation.something_went_wrong, "error");
    console.error(err);
  }
});

// Login
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const translation = langMap[currentLang];
  clearErrors(["loginEmailError", "loginPasswordError"]);

  let hasError = false;

  if (!loginEmail.value.trim()) {
    setError("loginEmailError", translation.required);
    hasError = true;
  } else if (!isValidEmail(loginEmail.value)) {
    setError("loginEmailError", translation.invalidEmail);
    hasError = true;
  }

  if (!loginPassword.value.trim()) {
    setError("loginPasswordError", translation.required);
    hasError = true;
  } else if (!isValidPassword(loginPassword.value.trim())) {
    setError("loginPasswordError", translation.invalidPassword);
    hasError = true;
  }

  // Login: BackEnd Error handling
  if (hasError) return;

  // Clear all error messages before sending request
  loginEmailError.textContent = "";
  loginPassword.textContent = "";

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: loginEmail.value,
        password: loginPassword.value
      })
    });

    const loginData = await res.json();

    if (loginData.success && loginData.token) {
      localStorage.setItem("jwt", loginData.token);  // Save token

      const meRes = await fetch(`${API_BASE}/me`, {
        headers: {
          Authorization: `Bearer ${loginData.token}`
        }
      });

      const me = await meRes.json();
      if (me.success) {
        document.getElementById("welcomeUser").innerText = `Welcome, ${me.user.username}!`;
        document.getElementById("home").style.display = "block";
        document.getElementById("loginBtn").style.display = "none";
        document.getElementById("registerBtn").style.display = "none";
      }

      closeModal("loginModal");

      // Error handling
    } else {
      showToast(translation.invalid_email_or_password || "Login failed", "error");
    }
  } catch (err) {
    showToast(translation.something_went_wrong, "error");
    console.error(err);
  }

});


// 🔹 4. Language dropdown functions
function toggleDropdown() {
  const dropdown = document.getElementById("langDropdown");
  dropdown.classList.toggle("show");
}
window.toggleDropdown = toggleDropdown;

function setLanguage(lang) {
  const flag = document.getElementById("langTrigger");
  flag.src = `assets/${lang}.svg`;

  // Collapse the dropdown
  const dropdown = document.getElementById("langDropdown");
  if (dropdown) {
    dropdown.classList.remove("show");
  }

  // Apply translations + update URL
  if (typeof changeLang === "function") {
    changeLang(lang);
  }
}
window.setLanguage = setLanguage;


// 🔹 5. JWT check on load
async function checkLoggedIn() {
  const token = localStorage.getItem("jwt");
  const authButtons = document.getElementById("authButtons");

  if (!token) {
    // No token = show buttons
    if (authButtons) authButtons.style.display = "flex";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    if (data.success && data.user) {
      document.getElementById("welcomeUser").innerText = `Welcome, ${data.user.username}!`;
      document.getElementById("home").style.display = "block";
      // Keep buttons hidden
    } else {
      localStorage.removeItem("jwt");
      if (authButtons) authButtons.style.display = "flex"; // Show buttons only if not logged in
    }
  } catch (err) {
    console.error("Token check failed", err);
    localStorage.removeItem("jwt");
    if (authButtons) authButtons.style.display = "flex";
  }
}

// Logout 
window.logout = function () {
  localStorage.removeItem("jwt");
  location.reload()

  // Hide the welcome section
  document.getElementById("home").style.display = "none";

  // Reset welcome message
  document.getElementById("welcomeUser").innerText = "";

  // Optionally: show login/signup buttons again
  document.getElementById("loginBtn").style.display = "inline-block";
  document.getElementById("registerBtn").style.display = "inline-block";

  // Optionally: show a toast confirmation
  showToast("Logged out successfully", "info");
};

checkLoggedIn();


// 🔹 6. Outside click: hide language dropdown
document.addEventListener("click", function (e) {
  const dropdown = document.getElementById("langDropdown");
  const trigger = document.getElementById("langTrigger");

  // Don't close if clicked inside dropdown or on a language option
  if (
    dropdown && trigger &&
    !dropdown.contains(e.target) &&
    !trigger.contains(e.target) &&
    !e.target.closest(".language-option")
  ) {
    dropdown.classList.remove("show");
  }
});