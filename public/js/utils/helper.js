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