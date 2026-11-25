// The Live tabs "reflected" in the site header.
//
// While a Live tab is open and the page is scrolled far enough that the tabs
// (Live, Standings, Matches) are out of sight, a compact copy of them appears
// in the site header, between the home icon and the login buttons or the user
// name. The copy only mirrors the real tabs: their words, which one is
// active, and a tap on it is a tap on the real one.
//
// The same scroll watching tells the page it is scrolled (`is-scrolled`), so
// the floating Back button can step aside for the parts that stay in view.

const SCROLLED_AFTER_PX = 24;

// Small line icons, shown alone where the header has little room.
const ICONS = {
  // broadcast: a dot with two waves
  allGames: '<circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
  // podium: three bars
  standings: '<path d="M4 20V11h5v9M9.5 20V5h5v15M15 20v-6h5v6M3 20h18"/>',
  // calendar
  matches: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
};

let instance = null;

// Start mirroring. `page` is the Live page element, `tabs` the real tab row.
export function mountHeaderTabs({ page, tabs }) {
  if (instance) return instance;
  const header = document.querySelector("header");
  const group = header && header.querySelector(".language-auth-group");
  const left = group && group.querySelector(".header-left");
  if (!header || !group || !left) return null;

  const nav = document.createElement("nav");
  nav.className = "liveHeaderTabs";
  nav.setAttribute("aria-hidden", "true");
  const inner = document.createElement("div");
  inner.className = "liveHeaderTabs-inner";
  nav.append(inner);
  left.after(nav);

  const copies = new Map(); // real button -> its copy
  for (const real of tabs.querySelectorAll(".liveTabBtn")) {
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "liveHeaderTab";
    copy.tabIndex = -1;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = ICONS[real.dataset.tab] || "";
    const label = document.createElement("span");
    copy.append(svg, label);
    copy.addEventListener("click", () => {
      // Start the chosen tab from its top, then let the real tab do the work.
      // (On this site the body is what scrolls; the window is covered too.)
      document.body.scrollTo({ top: 0, behavior: "instant" });
      window.scrollTo({ top: 0, behavior: "instant" });
      real.click();
    });
    inner.append(copy);
    copies.set(real, { copy, label });
  }

  // Words and the active tab always come from the real tabs.
  const mirror = () => {
    for (const [real, { copy, label }] of copies) {
      const text = real.textContent.trim();
      if (label.textContent !== text) label.textContent = text;
      copy.title = text;
      copy.classList.toggle("active", real.classList.contains("active"));
    }
  };
  const watcher = new MutationObserver(mirror);
  watcher.observe(tabs, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  mirror();

  let enabled = false;
  let shown = false;
  let frame = 0;

  const setShown = (next) => {
    if (shown === next) return;
    shown = next;
    nav.classList.toggle("is-shown", shown);
    header.classList.toggle("has-live-tabs", shown);
    nav.setAttribute("aria-hidden", String(!shown));
    for (const { copy } of copies.values()) copy.tabIndex = shown ? 0 : -1;
  };

  const measure = () => {
    frame = 0;
    if (!enabled) return;
    const headerBottom = header.getBoundingClientRect().bottom;
    const rect = tabs.getBoundingClientRect();
    // rect.height is 0 while the page is hidden: then nothing is "scrolled".
    const tabsGone = rect.height > 0 && rect.bottom <= headerBottom;
    const scrolled = rect.height > 0 && (document.body.scrollTop || window.scrollY || 0) > SCROLLED_AFTER_PX;
    setShown(tabsGone);
    page.classList.toggle("is-scrolled", scrolled);
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };

  // Scroll events do not bubble; capturing on the window hears them wherever
  // the page scrolls (here it is the body).
  window.addEventListener("scroll", onScroll, { passive: true, capture: true });
  window.addEventListener("resize", onScroll, { passive: true });

  instance = {
    // Live was opened or closed.
    setEnabled(next) {
      enabled = next;
      if (!enabled) {
        setShown(false);
        page.classList.remove("is-scrolled");
      } else {
        onScroll();
      }
    },
  };
  return instance;
}
