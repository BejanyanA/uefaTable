// The Live tabs, always at the top of the screen while Live is open.
//
// The three tabs (Live, Standings, Matches) are drawn by this file inside the
// site header. The styles (live-data.css) decide how they sit there:
//   - wide screens: in the header itself, centred over the content below;
//   - narrow screens: in a bar of their own right under the header, starting
//     with a Back arrow.
// They mirror the original buttons, which stay in the page, hidden: their
// words, which one is active, and a tap here is a tap on the original. The
// Back arrow does the same for the page's Back button.

import { langMap, currentLang } from "../modules/LanguageManager.js";

// Small line icons, drawn beside the words.
const ICONS = {
  // broadcast: a dot with two waves
  allGames: '<circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
  // podium: three bars
  standings: '<path d="M4 20V11h5v9M9.5 20V5h5v15M15 20v-6h5v6M3 20h18"/>',
  // calendar
  matches: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  // arrow to the left
  back: '<path d="M15 5l-7 7 7 7"/>',
  // three lines
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", name === "back" || name === "menu" ? "2.2" : "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = ICONS[name] || "";
  return svg;
}

let instance = null;

// Start mirroring. `page` is the Live page element, `tabs` its original tab
// row, `back` its original Back button, `content` the box the tabs are
// centred over on wide screens.
export function mountHeaderTabs({ page, tabs, back, content }) {
  if (instance) return instance;
  const header = document.querySelector("header");
  const anchor = header && header.querySelector(".header-left");
  if (!header || !anchor) return null;

  const nav = document.createElement("nav");
  nav.className = "liveHeaderTabs";

  let backCopy = null;
  if (back) {
    backCopy = document.createElement("button");
    backCopy.type = "button";
    backCopy.className = "liveHeaderBack";
    backCopy.append(icon("back"));
    backCopy.addEventListener("click", () => back.click());
    nav.append(backCopy);
  }

  const inner = document.createElement("div");
  inner.className = "liveHeaderTabs-inner";
  nav.append(inner);

  // The Live menu (favorites, time zone), at the right end of the phone bar.
  // It has a column of its own, so the tabs changing width never move it.
  const menuButton = document.createElement("button");
  menuButton.type = "button";
  menuButton.className = "liveHeaderMenu";
  menuButton.setAttribute("aria-haspopup", "menu");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.append(icon("menu"));
  menuButton.addEventListener("click", async () => {
    const { toggleLiveMenu } = await import("./views/liveMenu.js");
    toggleLiveMenu(menuButton);
  });
  nav.append(menuButton);
  anchor.after(nav);

  // Load the menu's code while the visitor looks at the scores, so the first
  // tap on the menu (or on Settings) opens it at once.
  const preloadMenu = () => import("./views/liveMenu.js").catch(() => {});
  if ("requestIdleCallback" in window) requestIdleCallback(preloadMenu, { timeout: 4000 });
  else setTimeout(preloadMenu, 2000);

  const copies = new Map(); // original button -> its copy
  for (const real of tabs.querySelectorAll(".liveTabBtn")) {
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "liveHeaderTab";
    copy.dataset.tab = real.dataset.tab;
    const label = document.createElement("span");
    copy.append(icon(real.dataset.tab), label);
    copy.addEventListener("click", () => {
      // Start the chosen tab from its top, then let the original do the work.
      // (On this site the body is what scrolls; the window is covered too.)
      document.body.scrollTo({ top: 0, behavior: "instant" });
      window.scrollTo({ top: 0, behavior: "instant" });
      real.click();
    });
    inner.append(copy);
    copies.set(real, { copy, label });
  }

  // Words and the active tab always come from the originals.
  const mirror = () => {
    for (const [real, { copy, label }] of copies) {
      const text = real.textContent.trim();
      if (label.textContent !== text) label.textContent = text;
      copy.title = text;
      const active = real.classList.contains("active");
      copy.classList.toggle("active", active);
      if (active) copy.setAttribute("aria-current", "page");
      else copy.removeAttribute("aria-current");
    }
    const words = langMap[currentLang] || langMap.en;
    nav.setAttribute("aria-label", words.live_sections || langMap.en.live_sections);
    const menuLabel = words.live_menu || langMap.en.live_menu || "Menu";
    menuButton.setAttribute("aria-label", menuLabel);
    menuButton.title = menuLabel;
    if (backCopy) {
      // The page's button reads "< Back"; the arrow here needs only the word.
      const text = back.textContent.replace(/^[\s<‹←]+/, "").trim();
      backCopy.setAttribute("aria-label", text);
      backCopy.title = text;
    }
  };
  const watcher = new MutationObserver(mirror);
  watcher.observe(tabs, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  if (back) watcher.observe(back, { subtree: true, childList: true, characterData: true });
  mirror();

  // Wide screens centre the tabs over the content below, which is not always
  // the middle of the header (a scrollbar shifts it).
  const centre = () => {
    const rect = (content || page).getBoundingClientRect();
    if (rect.width > 0) header.style.setProperty("--live-center", `${Math.round(rect.left + rect.width / 2)}px`);
    // The room the page's scrollbar takes at the right (0 where scrollbars
    // float over the page, as on phones). It does not change when a phone
    // turns, unlike the centre.
    const gutter = Math.max(0, window.innerWidth - document.body.clientWidth);
    header.style.setProperty("--live-gutter", `${gutter}px`);
  };
  const sizes = new ResizeObserver(centre);
  sizes.observe(content || page);
  window.addEventListener("resize", centre, { passive: true });

  instance = {
    // Live was opened or closed.
    setEnabled(enabled) {
      nav.classList.toggle("is-shown", enabled);
      if (!enabled) return;
      centre();
      // The content's width settles a moment later (the page's scrollbar
      // appears once the list is in). The size watcher above normally catches
      // that; these few re-measures make sure of it.
      for (const ms of [300, 1000, 3000]) setTimeout(centre, ms);
    },
  };
  return instance;
}
