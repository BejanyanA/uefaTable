import { API_BASE } from './config.js'; 

document.querySelectorAll(".banner").forEach(banner => {
  banner.addEventListener("click", () => {
    const tableId = banner.getAttribute("data-table-id");
    document.getElementById("tableModal").dataset.tableId = tableId;

    // ✅ Use shared modal logic for consistency
    window.openModal("tableModal");
  });
});

document.getElementById("openBtn").addEventListener("click", () => {
  document.getElementById("openTableSection").style.display = "block";
});

document.getElementById("confirmOpenBtn").addEventListener("click", async () => {
  const tableId = document.getElementById("tableModal").dataset.tableId;
  const password = document.getElementById("tablePassword").value.trim();
  const errorField = document.getElementById("tablePasswordError");
  errorField.textContent = "";

  if (!password) {
    errorField.textContent = "Password is required.";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/open-table`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableId, password })
    });

    const data = await res.json();
    if (data.success && data.user) {
      window.closeModal("tableModal");
      document.getElementById("gameTableSection").style.display = "block";
      document.getElementById("gameTableSection").innerHTML = data.tableHtml;
    } else {
      errorField.textContent = "Incorrect password or table not found.";
    }
  } catch (err) {
    errorField.textContent = "Something went wrong.";
  }
});