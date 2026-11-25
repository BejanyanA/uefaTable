// The Live menu on phones: a small iOS-style menu under the hamburger button
// with Favorites (coming later) and Time zone, and the time zone sheet.
//
// DOM only. The setting itself lives in ../settings.js.

import { langMap, currentLang } from "../../modules/LanguageManager.js";
import {
  allTimeZones, chosenTimeZone, describeTimeZone, deviceTimeZone, setTimeZone,
} from "../settings.js";

const t = (key) => (langMap[currentLang] && langMap[currentLang][key]) || langMap.en[key] || key;

const ICONS = {
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5z"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
};

const SHEET_ANIMATION_MS = 300;
const GAP_PX = 6;
// Wide screens: the time zone list opens under its button instead of as a
// sheet from the bottom.
const wideScreen = () => window.matchMedia("(min-width: 769px)").matches;

// Place a floating panel under `anchor`, right edges aligned. Panels are
// drawn on the page itself, not inside the header: a blur inside the
// header's own blur would only see the header.
function placeUnder(panel, anchor) {
  const rect = anchor.getBoundingClientRect();
  panel.style.top = `${Math.round(rect.bottom + GAP_PX)}px`;
  panel.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
  return rect;
}
// A swipe down closes the sheet when it goes this far, or this fast.
const CLOSE_DISTANCE_PX = 110;
const CLOSE_SPEED_PX_PER_MS = 0.5;

function icon(name, className) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  if (className) svg.setAttribute("class", className);
  svg.innerHTML = ICONS[name];
  return svg;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

let openMenu = null;

function closeMenu() {
  if (!openMenu) return;
  openMenu.close();
  openMenu = null;
}

// Show or hide the menu under `button`.
export function toggleLiveMenu(button) {
  if (openMenu) { closeMenu(); return; }

  const menu = el("div", "lv-menu");
  menu.setAttribute("role", "menu");

  const row = (iconName, label, value, { disabled = false, onClick } = {}) => {
    const item = el("button", "lv-menu-item");
    item.type = "button";
    item.setAttribute("role", "menuitem");
    if (disabled) item.setAttribute("aria-disabled", "true");
    item.append(icon(iconName, "lv-menu-icon"), el("span", "lv-menu-label", label));
    if (value) item.append(el("span", "lv-menu-value", value));
    if (onClick && !disabled) item.addEventListener("click", onClick);
    return item;
  };

  const zone = chosenTimeZone();
  const zoneValue = zone ? describeTimeZone(zone).city : t("live_tz_auto");
  menu.append(
    row("star", t("live_favorites"), t("live_soon"), { disabled: true }),
    row("globe", t("live_time_zone"), zoneValue, {
      onClick: () => { closeMenu(); openTimeZoneSheet(button); },
    }),
  );

  // Under the button, aligned to its right edge.
  document.body.append(menu);
  placeUnder(menu, button);
  button.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => menu.classList.add("is-open"));

  const onOutside = (e) => { if (!menu.contains(e.target) && e.target !== button && !button.contains(e.target)) closeMenu(); };
  const onKey = (e) => { if (e.key === "Escape") { closeMenu(); button.focus(); } };
  // The menu does not follow the page: scrolling or resizing closes it.
  const onMove = () => closeMenu();
  setTimeout(() => document.addEventListener("click", onOutside), 0);
  document.addEventListener("keydown", onKey);
  window.addEventListener("scroll", onMove, { capture: true, passive: true });
  window.addEventListener("resize", onMove, { passive: true });
  menu.querySelector(".lv-menu-item:not([aria-disabled])")?.focus();

  openMenu = {
    close() {
      document.removeEventListener("click", onOutside);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
      button.setAttribute("aria-expanded", "false");
      menu.remove();
    },
  };
}

// Search field and every time zone, "Automatic" (the device's own zone)
// first. Phones: a full-height iOS sheet from the bottom. Wide screens: a
// panel under the Settings button.
function openTimeZoneSheet(returnFocusTo) {
  const popover = wideScreen() && returnFocusTo;
  const backdrop = el("div", popover ? "lv-sheet-backdrop is-clear" : "lv-sheet-backdrop");
  const sheet = el("div", popover ? "lv-sheet lv-sheet--popover" : "lv-sheet");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", t("live_time_zone"));

  const grabber = el("div", "lv-sheet-grabber");
  const head = el("div", "lv-sheet-head");
  const title = el("h2", "lv-sheet-title", t("live_time_zone"));
  const done = el("button", "lv-sheet-done", t("live_close"));
  done.type = "button";
  head.append(el("span", "lv-sheet-spacer"), title, done);

  const searchBox = el("label", "lv-sheet-search");
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = t("live_search");
  search.setAttribute("aria-label", t("live_search"));
  search.autocomplete = "off";
  search.spellcheck = false;
  searchBox.append(icon("search", "lv-sheet-search-icon"), search);

  const list = el("ul", "lv-sheet-list");
  list.setAttribute("role", "listbox");

  const chosen = chosenTimeZone();
  const now = Date.now();
  const device = deviceTimeZone();
  const deviceInfo = describeTimeZone(device, now);

  const option = (labelText, detailText, selected, onPick, searchText) => {
    const item = el("li", "lv-sheet-row");
    const button = el("button", "lv-sheet-option");
    button.type = "button";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(selected));
    const text = el("span", "lv-sheet-option-text");
    text.append(el("span", "lv-sheet-option-label", labelText));
    if (detailText) text.append(el("span", "lv-sheet-option-detail", detailText));
    button.append(text);
    if (selected) button.append(icon("check", "lv-sheet-check"));
    button.addEventListener("click", onPick);
    item.append(button);
    item.dataset.search = (searchText || `${labelText} ${detailText || ""}`).toLowerCase();
    return item;
  };

  const pick = (tz) => { setTimeZone(tz); close(); };

  const items = [
    option(t("live_tz_auto"), `${deviceInfo.city} · ${deviceInfo.offset}`, !chosen, () => pick(null), `${t("live_tz_auto")} ${device}`),
  ];
  for (const tz of allTimeZones()) {
    const info = describeTimeZone(tz, now);
    const detail = [info.region, info.offset].filter(Boolean).join(" · ");
    items.push(option(info.city, detail, chosen === tz, () => pick(tz), `${tz} ${info.city} ${info.offset}`));
  }
  list.append(...items);

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    for (const item of items) item.hidden = q !== "" && !item.dataset.search.includes(q);
  });

  sheet.append(grabber, head, searchBox, list);
  document.body.append(backdrop, sheet);
  if (popover) {
    const rect = placeUnder(sheet, returnFocusTo);
    sheet.style.height = `${Math.max(240, Math.min(560, window.innerHeight - rect.bottom - GAP_PX - 16))}px`;
  }
  document.body.classList.add("lv-sheet-open");
  requestAnimationFrame(() => { backdrop.classList.add("is-open"); sheet.classList.add("is-open"); });

  // Bring the current choice into view.
  const current = list.querySelector('[aria-selected="true"]');
  if (current) current.scrollIntoView({ block: "center" });
  done.focus();

  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("click", close);
  done.addEventListener("click", close);

  // Swipe down to close, as on iOS: from the top part anywhere, or from the
  // list when it is already scrolled to its top.
  let startY = 0;
  let startTime = 0;
  let distance = 0;
  let mayDrag = false;
  let dragging = false;

  sheet.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || e.target.closest("input")) { mayDrag = false; return; }
    startY = e.touches[0].clientY;
    startTime = performance.now();
    distance = 0;
    dragging = false;
    mayDrag = !list.contains(e.target) || list.scrollTop <= 0;
  }, { passive: true });

  sheet.addEventListener("touchmove", (e) => {
    if (!mayDrag) return;
    distance = e.touches[0].clientY - startY;
    if (!dragging && distance < 0) { mayDrag = false; return; } // scrolling the list up
    if (distance > 0) {
      dragging = true;
      e.preventDefault();
      sheet.classList.add("is-dragging");
      sheet.style.transform = `translateY(${distance}px)`;
      backdrop.style.opacity = String(Math.max(0, 1 - distance / 400));
    }
  }, { passive: false });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    mayDrag = false;
    sheet.classList.remove("is-dragging");
    const speed = distance / Math.max(1, performance.now() - startTime);
    sheet.style.transform = "";
    backdrop.style.opacity = "";
    if (distance > CLOSE_DISTANCE_PX || speed > CLOSE_SPEED_PX_PER_MS) close({ from: distance });
  };
  sheet.addEventListener("touchend", endDrag);
  sheet.addEventListener("touchcancel", endDrag);

  let closed = false;
  function close({ from = 0 } = {}) {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    document.body.classList.remove("lv-sheet-open");
    // Slide away from where the finger left it, then remove.
    if (from > 0) sheet.style.transform = `translateY(${from}px)`;
    requestAnimationFrame(() => {
      sheet.style.transform = "";
      sheet.classList.remove("is-open");
      backdrop.classList.remove("is-open");
    });
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, SHEET_ANIMATION_MS);
    returnFocusTo?.focus();
  }
}
