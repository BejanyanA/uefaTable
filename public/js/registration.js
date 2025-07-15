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
  } else if (regUsername.value.trim().length > 20) {
    setError("regUsernameError", translation.longUsername);
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
  } else if (regPassword.value === regUsername.value) {
    setError("regPasswordError", translation.passMatchUsername);
    hasError = true;
  } else if (!isValidPassword(regPassword.value.trim())) {
    setError("regPasswordError", translation.invalidPassword);
    hasError = true;
  } else if (regPassword.value.trim().length > 30) {
    setError("regPasswordError", translation.longPassword);
    hasError = true;
  }

  if (!regConfirmPassword.value.trim()) {
    setError("regConfirmPasswordError", translation.required);
    hasError = true;
  } else if (regPassword.value !== regConfirmPassword.value) {
    setError("regConfirmPasswordError", translation.mismatch);
    hasError = true;
  } else if (regConfirmPassword.value.trim().length > 30) {
    setError("regConfirmPasswordError", translation.longPassword);
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