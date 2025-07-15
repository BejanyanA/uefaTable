import { API_BASE } from './config.js';

function setError(id, message) {
  document.getElementById(id).textContent = message;
}

function clearErrors(ids) {
  ids.forEach(id => document.getElementById(id).textContent = "");
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

// Banner click logic
document.querySelectorAll(".banner").forEach(banner => {
  banner.addEventListener("click", () => {
    const tableId = banner.getAttribute("data-table-id");
    document.getElementById("tableModal").dataset.tableId = tableId;

    window.openModal("tableModal");

    // Reset view
    document.getElementById("actionButtons").style.display = "flex";
    document.getElementById("openTableSection").style.display = "none";
    document.getElementById("confirmOpenBtn").style.display = "none";
    document.getElementById("tablePassword").value = "";
    document.getElementById("tablePasswordError").textContent = "";
  });
});

// "Open" button: hide buttons, show password section
document.getElementById("openBtn").addEventListener("click", () => {
  document.getElementById("actionButtons").style.display = "none";
  document.getElementById("confirmOpenBtn").style.display = "flex";
  document.getElementById("openTableSection").style.display = "block";
});

// "Submit" button logic
document.getElementById("confirmOpenBtn").addEventListener("click", async () => {

  const translation = langMap[currentLang];
  const tableId = document.getElementById("tableModal").dataset.tableId;
  clearErrors(["tablePasswordError"]);

  let hasError = false;

  if (!tablePassword.value.trim()) {
    setError("tablePasswordError", translation.required);
    hasError = true;
  } else if (!isValidPassword(tablePassword.value.trim())) {
    setError("tablePasswordError", translation.invalidPassword);
    hasError = true;
  }

  // Login: BackEnd Error handling
  if (hasError) return;

  tablePassword.textContent = "";

  try {
    const res = await fetch(`${API_BASE}/open-table`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, password })
    });

    const data = await res.json();

    if (data.success && data.tableHtml) {
      window.closeModal("tableModal");
      document.getElementById("gameTableSection").style.display = "block";
      document.getElementById("gameTableSection").innerHTML = data.tableHtml;
    } else {
      errorField.textContent = translation.incorrectPassword || "Incorrect password or table not found.";
    }
  } catch (err) {
    errorField.textContent = translation.something_went_wrong || "Something went wrong.";
    console.error("Error opening table:", err);
  }
});