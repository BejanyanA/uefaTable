export const ModalManager = {
  open(id) {
    document.querySelectorAll(".modal").forEach(modal => {
      modal.style.display = "none";
    });

    const modal = document.getElementById(id);
    if (!modal) return;

    const form = modal.querySelector("form");
    if (form) {
      form.reset();
      form.querySelectorAll(".error").forEach(el => (el.textContent = ""));
    }

    modal.style.display = "flex";
    document.body.classList.add("modal-open");
  },

  close(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.style.display = "none";

    const form = modal.querySelector("form");
    if (form) {
      form.reset();
      form.querySelectorAll(".error").forEach(el => (el.textContent = ""));
    }

    document.getElementById("actionButtons").style.display = "flex";
    document.getElementById("openCreateSection").style.display = "none";
    document.getElementById("leagueName").value = "";
    document.getElementById("leagueNameError").textContent = "";
    document.getElementById("createCompetition").style.display = "none";
    document.getElementById("confirmCreareBtn").style.display = "none";

    document.body.classList.remove("modal-open");
  },

  togglePassword(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (!input || !iconElement) return;

    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    iconElement.src = isPassword ? "assets/icons/eye-off.svg" : "assets/icons/eye.svg";
  }
};