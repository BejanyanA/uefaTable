export function setError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
}

export function clearErrors(ids = []) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

// Loader
export function showLoader() {
  document.getElementById("loader").style.display = "block";
  document.getElementById("overlay").style.display = "block";
}

export function hideLoader() {
  document.getElementById("loader").style.display = "none";
  document.getElementById("overlay").style.display = "none";
}