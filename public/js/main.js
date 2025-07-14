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
  icon.src = isPassword ? "assets/eye-off.svg" : "assets/eye.svg"; // Replace with your hidden eye icon path
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
  const special = /[!@#$%^&*(),.?":{}|<>]/;

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
// Registr Form
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = langMap[currentLang];
  clearErrors(["regUsernameError", "regEmailError", "regPasswordError", "regConfirmPasswordError"]);

  let hasError = false;

  if (!regUsername.value.trim()) {
    setError("regUsernameError", t.required);
    hasError = true;
  } else if (regUsername.value.trim().length < 3) {
    setError("regUsernameError", t.shortUsername);
    hasError = true;
  }

  if (!regEmail.value.trim()) {
    setError("regEmailError", t.required);
    hasError = true;
  } else if (!isValidEmail(regEmail.value)) {
    setError("regEmailError", t.invalidEmail);
    hasError = true;
  }

  if (!regPassword.value.trim()) {
    setError("regPasswordError", t.required);
    hasError = true;
  } else if (!isValidPassword(regPassword.value.trim())) {
    setError("regPasswordError", t.invalidPassword);
    hasError = true;
  }

  if (!regConfirmPassword.value.trim()) {
    setError("regConfirmPasswordError", t.required);
    hasError = true;
  } else if (regPassword.value !== regConfirmPassword.value) {
    setError("regConfirmPasswordError", t.mismatch);
    hasError = true;
  }

  // Registration: BackEnd error handling
  // Clear all error messages before sending request
  regUsernameError.textContent = "";
  regEmailError.textContent = "";
  regPasswordError.textContent = "";

  if (hasError) return;

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
    } else {
      // Check for structured field-level errors
      const errors = registrData.errors;

      if (errors && typeof errors === "object") {
        if (errors.username) regUsernameError.textContent = errors.username;
        if (errors.email) regEmailError.textContent = errors.email;
        if (errors.password) regPasswordError.textContent = errors.password;
      } else {
        // Fallback to toast if no field-specific error structure
        showToast(registrData.message || "Registration failed", "error");
      }
    }
  } catch (err) {
    showToast("Something went wrong", "error");
    console.error(err);
  }
});

// Login Form
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = langMap[currentLang];
  clearErrors(["loginEmailError", "loginPasswordError"]);

  let hasError = false;

  if (!loginEmail.value.trim()) {
    setError("loginEmailError", t.required);
    hasError = true;
  } else if (!isValidEmail(loginEmail.value)) {
    setError("loginEmailError", t.invalidEmail);
    hasError = true;
  }

  if (!loginPassword.value.trim()) {
    setError("loginPasswordError", t.required);
    hasError = true;
  } else if (!isValidPassword(loginPassword.value.trim())) {
    setError("loginPasswordError", t.invalidPassword);
    hasError = true;
  }

  // Login: BackEnd Error handling
  // Clear all error messages before sending request
  regEmailError.textContent = "";
  regPasswordError.textContent = "";
  
  if (hasError) return;

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
      }

      closeModal("loginModal");
    } else {
      showToast(loginData.message || "Login failed", "error");
    }
  } catch (err) {
    showToast("Something went wrong", "error");
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
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && data.user) {
      document.getElementById("welcomeUser").innerText = `Welcome, ${data.user.username}!`;
      document.getElementById("home").style.display = "block";
    } else {
      localStorage.removeItem("jwt");
    }
  } catch (err) {
    console.error("Token check failed", err);
    localStorage.removeItem("jwt");
  }
}


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

// ✅ Run check
checkLoggedIn();