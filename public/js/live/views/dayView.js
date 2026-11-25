// The day view: the opening screen of Live. Draws what the store holds and
// nothing else: the day switcher, the competitions and their matches.
//
// DOM only. What to show and when to refresh is decided by the API and kept
// by ../store.js; how values read is in ../format.js. Text reaches the page
// through textContent, never innerHTML: team names are outside data.

import { langMap, currentLang } from "../../modules/LanguageManager.js";
import * as api from "../api.js";
import {
  dateParts, daysInRange, isInPlay, kickoffTime, matchStatus, redCards,
  scoreText, updatedAgo,
} from "../format.js";
import { createDayStore } from "../store.js";

const SKELETON_ROWS = 9;
const FLASH_MS = 2200;

const t = (key, vars) => {
  const text = (langMap[currentLang] && langMap[currentLang][key]) || langMap.en[key] || key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? vars[name] : "")) : text;
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function logo(url, size, className) {
  const img = document.createElement("img");
  img.className = className;
  img.width = size;
  img.height = size;
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  if (url) img.src = url;
  // A missing logo keeps its box, so the row does not shift.
  img.addEventListener("error", () => { img.removeAttribute("src"); img.classList.add("is-missing"); }, { once: true });
  if (!url) img.classList.add("is-missing");
  return img;
}

let view = null;

// Show the day view inside `container`, for `date` ("2026-11-25") or today.
// `onPickDate(date | null)` is called when the visitor chooses another day;
// the caller puts it in the address and calls showDay again.
export function showDay(container, { date = null, onPickDate }) {
  if (!view || view.container !== container || !container.contains(view.root)) {
    hideDay();
    view = createView(container, onPickDate);
  }
  view.onPickDate = onPickDate;
  view.store.show(date);
}

// Stop refreshing and remove the view (the visitor left the tab).
export function hideDay() {
  if (!view) return;
  view.destroy();
  view = null;
}

function createView(container, onPickDate) {
  const root = el("div", "lv");
  // One row that stays in view: Live and All first, then the days.
  const top = el("div", "lv-bar");
  const filters = el("div", "lv-filters");
  const bar = el("div", "lv-daynav");
  top.append(filters, bar);
  const note = el("div", "lv-note");
  const list = el("div", "lv-list");
  const announcer = el("div", "lv-sr");
  announcer.setAttribute("aria-live", "polite");
  root.append(top, note, list, announcer);
  container.replaceChildren(root);

  const self = {
    container, root, onPickDate,
    // "all" | "live". Every match of the day is shown; the Live button
    // narrows it to the matches in play and a second tap widens it again.
    filter: "all",
    rows: new Map(),     // match id -> { node, parts }
    drawnKey: "",        // what the list currently shows, to know when to rebuild
    store: null,
    destroy() {},
  };

  let tz = "UTC";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { /* keep UTC */ }

  let storage = null;
  try { storage = window.localStorage; } catch { /* private mode: no saved copy */ }

  self.store = createDayStore({
    api, tz, storage,
    onChange: (state, change) => draw(self, state, change, { bar, note, filters, list, announcer }),
  });

  const onVisibility = () => self.store.setVisible(document.visibilityState === "visible");
  const onLanguage = () => { self.drawnKey = ""; draw(self, self.store.state, {}, { bar, note, filters, list, announcer }); };
  const clock = setInterval(() => drawNote(self.store.state, note), 30000);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("app:language-changed", onLanguage);

  self.destroy = () => {
    self.store.stop();
    clearInterval(clock);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("app:language-changed", onLanguage);
    root.remove();
  };
  return self;
}

// ---------------------------------------------------------------- drawing

function draw(self, state, change, parts) {
  const { bar, note, filters, list, announcer } = parts;
  self.root.dataset.status = state.status;
  self.root.classList.toggle("is-switching", Boolean(state.switching));

  drawDayBar(self, state, bar);
  drawFilters(self, state, filters, parts);
  drawNote(state, note);

  if (state.status === "loading") {
    self.rows.clear();
    self.drawnKey = "";
    list.replaceChildren(skeleton());
    return;
  }
  if (state.status === "error") {
    self.rows.clear();
    self.drawnKey = "";
    list.replaceChildren(message(t("live_error"), t("live_retry"), () => self.store.retry()));
    return;
  }

  // The list is rebuilt only when what it shows changes (another day, another
  // language, a filter, matches added or removed). A score refresh touches
  // just the rows it concerns, so nothing moves under the finger.
  const groups = visibleGroups(state.data, self.filter);
  const key = [state.data.date, currentLang, self.filter, groups.map((g) => `${g.competition.key}:${g.matches.map((m) => m.id).join(",")}`).join("|")].join("#");
  if (key !== self.drawnKey) {
    self.drawnKey = key;
    self.rows.clear();
    if (groups.length === 0) {
      list.replaceChildren(message(t(self.filter === "live" ? "live_no_live_matches" : "live_no_matches")));
    } else {
      list.replaceChildren(...groups.map((group) => drawGroup(self, group)));
    }
    return;
  }

  for (const group of groups) {
    for (const match of group.matches) {
      const row = self.rows.get(match.id);
      if (row) updateRow(row, match, change.changedScores?.has(match.id), announcer);
    }
  }
}

function visibleGroups(data, filter) {
  if (filter !== "live") return data.groups;
  return data.groups
    .map((g) => ({ ...g, matches: g.matches.filter(isInPlay) }))
    .filter((g) => g.matches.length > 0);
}

function drawDayBar(self, state, bar) {
  const data = state.data;
  const key = data ? `${data.date}|${data.today}|${data.range.from}|${data.range.to}|${currentLang}` : `none|${currentLang}`;
  if (bar.dataset.key === key) return;
  bar.dataset.key = key;
  if (!data) { bar.replaceChildren(); return; }

  const pick = (date) => self.onPickDate(date === data.today ? null : date);

  const prev = el("button", "lv-day-step", "‹");
  prev.type = "button";
  prev.setAttribute("aria-label", t("live_prev_day"));
  prev.disabled = !data.previousDate;
  prev.addEventListener("click", () => data.previousDate && pick(data.previousDate));

  const next = el("button", "lv-day-step", "›");
  next.type = "button";
  next.setAttribute("aria-label", t("live_next_day"));
  next.disabled = !data.nextDate;
  next.addEventListener("click", () => data.nextDate && pick(data.nextDate));

  // Every day the visitor may open, in one strip that scrolls sideways.
  // Only today is named; the others show their weekday.
  const strip = el("div", "lv-days");
  let current = null;
  for (const day of daysInRange(data.range)) {
    const parts = dateParts(day, currentLang);
    const isToday = day === data.today;
    const button = el("button", "lv-day");
    button.type = "button";
    if (day === data.date) { button.setAttribute("aria-current", "date"); current = button; }
    if (isToday) button.classList.add("is-today");
    button.setAttribute("aria-label", isToday ? `${t("live_today")}, ${parts.full}` : parts.full);
    button.append(el("span", "lv-day-name", isToday ? t("live_today") : parts.weekday), el("span", "lv-day-date", parts.dayMonth));
    button.addEventListener("click", () => day !== data.date && pick(day));
    strip.append(button);
  }

  // Jump further than the strip shows, with the device's own date picker.
  const jump = el("label", "lv-day-jump");
  jump.setAttribute("aria-label", t("live_pick_date"));
  jump.title = t("live_pick_date");
  const input = document.createElement("input");
  input.type = "date";
  input.min = data.range.from;
  input.max = data.range.to;
  input.value = data.date;
  input.addEventListener("change", () => {
    const value = input.value;
    if (value && value >= data.range.from && value <= data.range.to && value !== data.date) pick(value);
    else input.value = data.date;
  });
  jump.append(el("span", "lv-day-jump-icon"), input);
  // Desktop browsers open the picker only from its own small icon; ask for it.
  jump.addEventListener("click", () => { try { input.showPicker(); } catch { /* not supported: the input still works */ } });

  bar.replaceChildren(prev, strip, next, jump);

  // Bring the selected day to the middle of the strip (the strip only, never
  // the page). Done after layout, when the sizes are known.
  if (current) {
    requestAnimationFrame(() => {
      strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2;
    });
  }
}

function drawFilters(self, state, filters, parts) {
  const key = `${self.filter}|${currentLang}|${state.status}`;
  if (filters.dataset.key === key) return;
  filters.dataset.key = key;
  if (state.status !== "ready") { filters.replaceChildren(); return; }

  // One toggle: pressed shows only the matches in play, released shows all.
  const live = el("button", "lv-filter", t("live_filter_live"));
  live.type = "button";
  live.setAttribute("aria-pressed", String(self.filter === "live"));
  live.addEventListener("click", () => {
    self.filter = self.filter === "live" ? "all" : "live";
    draw(self, self.store.state, {}, parts);
  });
  filters.replaceChildren(live);
}

function drawNote(state, note) {
  if (state.status !== "ready" || !state.meta?.updatedAt) { note.textContent = ""; note.className = "lv-note"; return; }
  const ago = updatedAgo(state.meta.updatedAt, Date.now());
  // The API knows how long each kind of data stays fresh (matches not yet
  // started much longer than scores in play) and says when what it sent is
  // older than it should be. Only then is the age worth showing.
  const old = Boolean(state.meta.stale);
  note.className = old ? "lv-note is-old" : "lv-note";
  // Only say something when it matters: data that is old, or a failed refresh.
  note.textContent = old || state.error ? t(ago.key, { n: ago.n }) : "";
}

function drawGroup(self, group) {
  const section = el("section", "lv-group");
  const head = el("h3", "lv-group-head");
  const { competition } = group;
  head.append(logo(competition.logo, 20, "lv-group-logo"));
  const names = el("span", "lv-group-names");
  names.append(el("span", "lv-group-name", competition.name));
  const place = competition.country ? competition.country.name : (competition.featured ? "" : t("live_international"));
  if (place) names.append(el("span", "lv-group-country", place));
  head.append(names);

  const matches = el("ul", "lv-matches");
  for (const match of group.matches) {
    const row = drawRow(match);
    self.rows.set(match.id, row);
    matches.append(row.node);
  }
  section.append(head, matches);
  return section;
}

function drawSide(parts, which) {
  const line = el("div", "lv-team");
  const crest = logo(null, 20, "lv-team-logo");
  const name = el("span", "lv-team-name");
  const cards = el("span", "lv-team-cards");
  line.append(crest, name, cards);
  parts[which] = { line, crest, name, cards };
  return line;
}

function drawRow(match) {
  const node = el("li", "lv-match");
  const parts = {};
  const when = el("div", "lv-when");
  parts.when = when;

  const teams = el("div", "lv-teams");
  teams.append(drawSide(parts, "home"), drawSide(parts, "away"));

  const scores = el("div", "lv-scores");
  parts.homeScore = el("span", "lv-score");
  parts.awayScore = el("span", "lv-score");
  scores.append(parts.homeScore, parts.awayScore);

  node.append(when, teams, scores);
  const row = { node, parts, last: {} };
  updateRow(row, match, false, null);
  return row;
}

// Write a match into its row, touching only what changed.
function updateRow(row, match, scoreChanged, announcer) {
  const { node, parts, last } = row;
  const set = (name, target, value) => {
    if (last[name] === value) return;
    last[name] = value;
    target.textContent = value;
  };

  const status = matchStatus(match);
  const whenText = status.kickoff ? kickoffTime(match.kickoff, currentLang) : (status.text || t(status.key));
  set("when", parts.when, whenText);
  if (last.phase !== match.phase || last.live !== status.live) {
    last.phase = match.phase;
    last.live = status.live;
    node.dataset.phase = match.phase;
    node.classList.toggle("is-live", status.live);
  }

  for (const which of ["home", "away"]) {
    const side = match[which];
    const p = parts[which];
    set(`${which}Name`, p.name, side.team.name);
    if (last[`${which}Logo`] !== side.team.logo) {
      last[`${which}Logo`] = side.team.logo;
      if (side.team.logo) { p.crest.src = side.team.logo; p.crest.classList.remove("is-missing"); }
    }
    const lost = match.phase === "finished" && side.winner === false;
    if (last[`${which}Lost`] !== lost) { last[`${which}Lost`] = lost; p.line.classList.toggle("is-loser", lost); }

    const reds = redCards(match, which);
    if (last[`${which}Reds`] !== reds) {
      last[`${which}Reds`] = reds;
      p.cards.textContent = reds > 1 ? String(reds) : "";
      p.cards.classList.toggle("has-red", reds > 0);
      if (reds > 0) p.cards.setAttribute("aria-label", t("live_red_cards", { n: reds }));
      else p.cards.removeAttribute("aria-label");
    }

    const pens = Number.isInteger(side.penalties) ? ` (${side.penalties})` : "";
    const scoreNode = which === "home" ? parts.homeScore : parts.awayScore;
    set(`${which}Score`, scoreNode, scoreText(side) + pens);
    if (last[`${which}Dim`] !== lost) { last[`${which}Dim`] = lost; scoreNode.classList.toggle("is-loser", lost); }
  }

  if (scoreChanged) {
    node.classList.remove("is-flash");
    void node.offsetWidth; // restart the highlight if it was already running
    node.classList.add("is-flash");
    setTimeout(() => node.classList.remove("is-flash"), FLASH_MS);
    if (announcer) {
      announcer.textContent = `${match.home.team.name} ${scoreText(match.home)} - ${scoreText(match.away)} ${match.away.team.name}`;
    }
  }
}

function skeleton() {
  const box = el("div", "lv-skeleton");
  box.setAttribute("aria-busy", "true");
  box.setAttribute("aria-label", t("live_loading"));
  box.append(el("div", "lv-skel-head"));
  for (let i = 0; i < SKELETON_ROWS; i++) box.append(el("div", "lv-skel-row"));
  return box;
}

function message(text, actionLabel, onAction) {
  const box = el("div", "lv-message");
  box.append(el("p", null, text));
  if (actionLabel) {
    const button = el("button", "lv-button", actionLabel);
    button.type = "button";
    button.addEventListener("click", onAction);
    box.append(button);
  }
  return box;
}
