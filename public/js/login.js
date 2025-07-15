import { showToast } from './toast.js';
import { API_BASE } from './config.js';

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
  const special = /[!@#$%^&*(),.?":{}|<>-_]/;

  return (
    minLength.test(password) &&
    upper.test(password) &&
    lower.test(password) &&
    number.test(password) &&
    special.test(password)
  );
}

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