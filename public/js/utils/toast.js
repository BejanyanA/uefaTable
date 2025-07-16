const defaultDurations = {
  success: 2500,
  error: 4000,
  info: 3000,
};

export function showToast(message, type = "info", duration) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  const container = document.getElementById("toast-container") || createToastContainer();
  container.appendChild(toast);

  // If animationend is supported, use it
  toast.addEventListener("animationend", () => {
    toast.remove();
  });

  // Fallback timeout for environments without animation support
  const displayTime = duration ?? defaultDurations[type] ?? 3000;
  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, displayTime + 500); // Slight buffer after animation
}

function createToastContainer() {
  const container = document.createElement("div");
  container.id = "toast-container";
  container.style.position = "fixed";
  container.style.top = "20px";
  container.style.left = "50%";
  container.style.transform = "translateX(-50%)";
  container.style.zIndex = "9999";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.alignItems = "center";
  container.style.gap = "10px";
  document.body.appendChild(container);
  return container;
}