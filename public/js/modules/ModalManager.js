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
    document.getElementById("actionTitle").style.display = "block";
    document.getElementById("openCreateSection").style.display = "none";
    document.getElementById("leagueName").value = "";
    document.getElementById("leagueNameError").textContent = "";
    document.getElementById("createCompetition").style.display = "none";
    document.getElementById("confirmCreateBtn").style.display = "none";
    document.getElementById("count-select").style.display = "none";
    document.getElementById("user-select").style.display = "none";
    document.getElementById("teamCountError").textContent = "";
    document.getElementById("clubList").style.display = "none";
    document.getElementById("clubsError").textContent = "";
    document.getElementById("user-select").innerHTML = "";
    document.getElementById("clubList").innerHTML = "";
    document.getElementById("clubCount").innerHTML = "";
    document.getElementById("clubSearch").style.display = "none";
    document.getElementById("clubSearchLabel").style.display = "none";


    document.body.classList.remove("modal-open");
  },

  togglePassword(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (!input || !iconElement) return;

    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    iconElement.src = isPassword ? "assets/icons/eye.png" : "assets/icons/eye-off.png";
  }
};