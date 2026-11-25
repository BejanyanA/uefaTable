// Small DOM helpers shared by the Live views. Text always goes in through
// textContent: team and player names are outside data.

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

export function logo(url, size, className) {
  const img = document.createElement("img");
  img.className = className;
  img.width = size;
  img.height = size;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  if (url) img.src = url;
  // A missing logo keeps its box, so nothing shifts.
  img.addEventListener("error", () => { img.removeAttribute("src"); img.classList.add("is-missing"); }, { once: true });
  if (!url) img.classList.add("is-missing");
  return img;
}

// A line icon from a fixed drawing (never outside data).
export function icon(paths, className, { strokeWidth = 2, viewBox = "0 0 24 24" } = {}) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", String(strokeWidth));
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  if (className) svg.setAttribute("class", className);
  svg.innerHTML = paths;
  return svg;
}
