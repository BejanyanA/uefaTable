import { API_BASE } from './config.js';
import './login.js';
import './registration.js';
import './homepage.js';
import './config.js';

// Open Modal
function openModal(id) {
  document.querySelectorAll(".modal").forEach(modal => {
    modal.style.display = "none";
  });

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

// Close Modal
function closeModal(id) {
  const modal = document.getElementById(id);
  modal.style.display = "none";
  document.getElementById("actionButtons").style.display = "flex";
  document.getElementById("openTableSection").style.display = "none";
  document.getElementById("tablePassword").value = "";
  document.getElementById("tablePasswordError").textContent = "";
  document.getElementsByClassName("toggle-password").textContent = "";


  const form = modal.querySelector("form");
  if (form) {
    form.reset();
    form.querySelectorAll(".error").forEach(el => el.textContent = "");
  }

  // Re-enable background
  document.body.classList.remove("modal-open");
}
window.closeModal = closeModal;

// Password eye icon
function togglePassword(inputId, icon) {
  const input = document.getElementById(inputId);
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  icon.src = isPassword ? "assets/eye-off.svg" : "assets/eye.svg";
}
window.togglePassword = togglePassword;

// Language dropdown functions
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

// Banner click Handler
function handleBannerClick(element) {
  const tableId = element.getAttribute("data-table-id");
  document.getElementById("tableModal").dataset.tableId = tableId;

  window.openModal("tableModal");

  // Reset section
  document.getElementById("openTableSection").style.display = "none";
  document.getElementById("tablePassword").value = "";
  document.getElementById("tablePasswordError").textContent = "";
}
window.handleBannerClick = handleBannerClick;


// 🔹 5. JWT and Logged in check on load
async function checkLoggedIn() {
  const token = localStorage.getItem("jwt");
  const authButtons = document.getElementById("authButtons");
  const bannerSection = document.querySelector(".banner-container");

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
      document.getElementById("logoutButtn").style.display = "block";
      document.getElementById("homePage").style.display = "block";
      // Keep buttons hidden
    } else {
      localStorage.removeItem("jwt");
      if (authButtons) authButtons.style.display = "flex"; // Show buttons only if not logged in

    }
  } catch (err) {
    console.error("Token check failed", err);
    localStorage.removeItem("jwt");
    if (authButtons) authButtons.style.display = "flex";
    if (bannerSection) bannerSection.style.display = "none";
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