// The match details screen: the score at the top, then Summary (events and
// match info), Line-ups (the pitch and the substitutes) and Statistics.
//
// DOM only. What to show and when to refresh is decided by the API and kept
// by ../matchStore.js; how values read is in ../format.js. Text reaches the
// page through textContent, never innerHTML: names are outside data.

import { langMap, currentLang } from "../../modules/LanguageManager.js";
import * as api from "../api.js";
import {
  dateParts, eventMinute, kickoffDateTime, kickoffTime, localDate, matchStatus,
  scoreText, statShares, statText, updatedAgo,
} from "../format.js";
import { createMatchStore } from "../matchStore.js";
import { activeTimeZone, TIMEZONE_EVENT } from "../settings.js";
import { el, icon, logo } from "./dom.js";

const t = (key, vars) => {
  const text = (langMap[currentLang] && langMap[currentLang][key]) || langMap.en[key] || key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? vars[name] : "")) : text;
};

const TABS = [
  { key: "summary", label: "live_summary" },
  { key: "lineups", label: "live_lineups" },
  { key: "stats", label: "live_statistics" },
];
const FLASH_MS = 2200;

// Fixed drawings (no outside data).
const ICONS = {
  ball: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8l3.3 2.4-1.3 3.9h-4l-1.3-3.9z"/><path d="M12 3.5V8M15.3 10.4l4.3-1.4M14 14.3l2.6 3.7M10 14.3L7.4 18M8.7 10.4L4.4 9"/>',
  missed: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>',
  card: '<rect x="7" y="4" width="10" height="16" rx="2" fill="currentColor" stroke="none"/>',
  sub: '<path d="M8 19V5M4.5 8.5L8 5l3.5 3.5" class="is-on"/><path d="M16 5v14M12.5 15.5L16 19l3.5-3.5" class="is-off"/>',
  var: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8.5 21h7M12 17v4"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
};

// The pitch markings, standing up (phones) and lying down (wide screens);
// the styles show one of them.
const PITCH_LINES = `<svg class="is-tall" viewBox="0 0 68 105" preserveAspectRatio="none" aria-hidden="true">
  <g fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".4">
    <rect x="2" y="2" width="64" height="101" rx="1"/>
    <path d="M2 52.5h64"/><circle cx="34" cy="52.5" r="9.15"/>
    <rect x="13.85" y="2" width="40.3" height="16.5"/><rect x="24.85" y="2" width="18.3" height="5.5"/>
    <rect x="13.85" y="86.5" width="40.3" height="16.5"/><rect x="24.85" y="97.5" width="18.3" height="5.5"/>
  </g>
</svg><svg class="is-wide" viewBox="0 0 105 68" preserveAspectRatio="none" aria-hidden="true">
  <g fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".4">
    <rect x="2" y="2" width="101" height="64" rx="1"/>
    <path d="M52.5 2v64"/><circle cx="52.5" cy="34" r="9.15"/>
    <rect x="2" y="13.85" width="16.5" height="40.3"/><rect x="2" y="24.85" width="5.5" height="18.3"/>
    <rect x="86.5" y="13.85" width="16.5" height="40.3"/><rect x="97.5" y="24.85" width="5.5" height="18.3"/>
  </g>
</svg>`;

let view = null;

// Show match `id` inside `container`, over the day view (which stays there,
// hidden, with its scroll and state).
// `preview` ({ match, competition }, optional) is what the list already
// knows: the score card shows it at once while the details load.
export function showMatch(container, { id, preview = null }) {
  if (view && view.id === id && container.contains(view.root)) return;
  hideMatch();
  view = createView(container, id, preview);
}

export function hideMatch() {
  if (!view) return;
  view.destroy();
  view = null;
}

export function isMatchOpen() {
  return Boolean(view);
}

function createView(container, id, preview) {
  const root = el("div", "lv lvd");
  root.setAttribute("aria-label", t("live_match_details"));
  const bar = el("div", "lvd-bar");
  const seg = el("div", "lvd-seg");
  seg.setAttribute("role", "tablist");
  bar.append(seg);
  const body = el("div", "lvd-body");
  const head = el("section", "lvd-head");
  const note = el("div", "lv-note lvd-note");
  const panel = el("div", "lvd-panel");
  panel.setAttribute("role", "tabpanel");
  panel.id = "lvd-panel";
  const announcer = el("div", "lv-sr");
  announcer.setAttribute("aria-live", "polite");
  body.append(head, note, panel);
  root.append(bar, body, announcer);
  container.append(root);
  container.classList.add("lv-has-match");

  const self = {
    id, root, seg, head, note, panel, announcer, preview,
    tab: "summary",
    tz: activeTimeZone(),
    drawn: { head: "", panel: "" },
    lastScore: null,
    store: null,
    destroy() {},
  };

  drawTabs(self);
  self.store = createMatchStore({ api, id, onChange: (state) => draw(self, state) });
  self.store.start();

  const redraw = () => {
    self.tz = activeTimeZone();
    self.drawn = { head: "", panel: "" };
    drawTabs(self);
    draw(self, self.store.state);
  };
  const onVisibility = () => self.store.setVisible(document.visibilityState === "visible");
  const clock = setInterval(() => drawNote(self, self.store.state), 30000);
  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("app:language-changed", redraw);
  document.addEventListener(TIMEZONE_EVENT, redraw);

  self.destroy = () => {
    self.store.stop();
    clearInterval(clock);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("app:language-changed", redraw);
    document.removeEventListener(TIMEZONE_EVENT, redraw);
    container.classList.remove("lv-has-match");
    root.remove();
  };
  return self;
}

// ---------------------------------------------------------------- tabs

function drawTabs(self) {
  const buttons = TABS.map((tab) => {
    const button = el("button", "lvd-seg-button", t(tab.label));
    button.type = "button";
    button.setAttribute("role", "tab");
    button.dataset.tab = tab.key;
    button.setAttribute("aria-controls", "lvd-panel");
    const selected = tab.key === self.tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    button.addEventListener("click", () => pickTab(self, tab.key));
    return button;
  });
  // Arrow keys move between the tabs, as in any tab list.
  self.seg.onkeydown = (e) => {
    const index = TABS.findIndex((tab) => tab.key === self.tab);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length].key;
    pickTab(self, next);
    self.seg.querySelector(`[data-tab="${next}"]`)?.focus();
  };
  self.seg.replaceChildren(...buttons);
}

function pickTab(self, key) {
  if (self.tab === key) return;
  self.tab = key;
  for (const button of self.seg.children) {
    const selected = button.dataset.tab === key;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  self.drawn.panel = "";
  draw(self, self.store.state);
}

// ---------------------------------------------------------------- drawing

function draw(self, state) {
  self.root.dataset.status = state.status;
  drawNote(self, state);

  // Still loading, or the first try failed (it is tried again on its own in
  // a few seconds): the list's own copy of the score, or a placeholder.
  const waiting = state.status === "loading" || (state.status === "error" && state.failures <= 1);
  if (waiting && !state.data) {
    const preview = self.preview && self.preview.match ? { ...self.preview, halfTime: null } : null;
    const headKey = preview ? JSON.stringify(["preview", currentLang, self.tz, preview.match]) : "skeleton";
    if (headKey !== self.drawn.head) {
      self.drawn.head = headKey;
      self.head.replaceChildren(...(preview ? drawHead(self, preview) : [skeletonHead()]));
    }
    if (self.drawn.panel !== "skeleton") {
      self.drawn.panel = "skeleton";
      self.panel.replaceChildren(skeletonRows());
    }
    return;
  }
  if (state.status === "missing") {
    self.drawn = { head: "", panel: "" };
    self.head.replaceChildren();
    self.panel.replaceChildren(message(t("live_match_missing")));
    return;
  }
  if (!state.data) {
    // Keep the score card from the list if there is one; say what failed below.
    if (!self.preview) {
      self.drawn.head = "";
      self.head.replaceChildren();
    }
    self.drawn.panel = "error";
    self.panel.replaceChildren(message(t("live_error"), t("live_retry"), () => self.store.retry()));
    return;
  }

  const data = state.data;
  // Each part is drawn again only when what it shows changed, so a refresh
  // that brings nothing new moves nothing.
  const headKey = JSON.stringify([currentLang, self.tz, data.match, data.halfTime, data.competition?.key]);
  if (headKey !== self.drawn.head) {
    self.drawn.head = headKey;
    self.head.replaceChildren(...drawHead(self, data));
  }
  const panelKey = JSON.stringify([currentLang, self.tz, self.tab, self.tab === "summary" ? [data.match, data.venue, data.referee] : self.tab === "lineups" ? [data.lineups, data.match.phase] : [data.statistics, data.match.phase]]);
  if (panelKey !== self.drawn.panel) {
    self.drawn.panel = panelKey;
    const panel = self.tab === "summary" ? drawSummary(self, data) : self.tab === "lineups" ? drawLineups(data) : drawStats(data);
    self.panel.replaceChildren(...panel);
  }

  // A goal: highlight the score once and say it, politely.
  const score = `${scoreText(data.match.home)}:${scoreText(data.match.away)}`;
  if (self.lastScore !== null && self.lastScore !== score) {
    const box = self.head.querySelector(".lvd-score");
    if (box) {
      box.classList.add("is-flash");
      setTimeout(() => box.classList.remove("is-flash"), FLASH_MS);
    }
    self.announcer.textContent = `${data.match.home.team.name} ${scoreText(data.match.home)} - ${scoreText(data.match.away)} ${data.match.away.team.name}`;
  }
  self.lastScore = score;
}

function drawNote(self, state) {
  const meta = state.meta;
  if (!meta || !meta.stale || !meta.updatedAt) {
    self.note.textContent = "";
    self.note.hidden = true;
    return;
  }
  const ago = updatedAgo(meta.updatedAt, Date.now());
  self.note.textContent = t(ago.key, { n: ago.n });
  self.note.hidden = false;
}

// ---- the score at the top

function drawHead(self, data) {
  const { match, competition } = data;
  const parts = [];

  const comp = el("div", "lvd-comp");
  if (competition) comp.append(logo(competition.logo, 18, "lvd-comp-logo"), el("span", "lvd-comp-name", competition.name));
  if (match.round) comp.append(el("span", "lvd-comp-round", match.round));
  parts.push(comp);

  const status = matchStatus(match);
  const teams = el("div", "lvd-teams");
  const side = (which) => {
    const box = el("div", `lvd-side lvd-side--${which}`);
    const lost = match.phase === "finished" && match[which].winner === false;
    box.classList.toggle("is-loser", lost);
    box.append(logo(match[which].team.logo, 56, "lvd-crest"), el("span", "lvd-team-name", match[which].team.name));
    return box;
  };

  const center = el("div", "lvd-center");
  const started = Number.isInteger(match.home.score) && Number.isInteger(match.away.score);
  if (started) {
    const score = el("div", "lvd-score");
    score.append(el("span", null, scoreText(match.home)), el("span", "lvd-score-sep", "-"), el("span", null, scoreText(match.away)));
    score.setAttribute("aria-label", `${scoreText(match.home)} - ${scoreText(match.away)}`);
    center.append(score);
  } else {
    center.append(el("div", "lvd-kickoff", kickoffTime(match.kickoff, currentLang, self.tz)));
  }

  const state = el("div", "lvd-state");
  if (status.kickoff) {
    state.textContent = dateParts(localDate(match.kickoff, self.tz), currentLang).full;
  } else if (status.added) {
    state.append(document.createTextNode(status.minute), el("span", "lvd-added", status.added));
    state.setAttribute("aria-label", status.text);
  } else {
    state.textContent = status.text || t(status.key);
  }
  state.classList.toggle("is-live", status.live);
  center.append(state);
  teams.append(side("home"), center, side("away"));
  parts.push(teams);

  // Half-time and shoot-out scores, small, under the score.
  const extra = [];
  if (data.halfTime) extra.push(`${t("live_st_half_time")} ${data.halfTime.home} - ${data.halfTime.away}`);
  if (Number.isInteger(match.home.penalties) && Number.isInteger(match.away.penalties)) {
    extra.push(`${t("live_st_penalties")} ${match.home.penalties} - ${match.away.penalties}`);
  }
  if (extra.length > 0) parts.push(el("div", "lvd-extra", extra.join("  ·  ")));

  const scorers = drawScorers(match);
  if (scorers) parts.push(scorers);
  return parts;
}

// Who scored, under each team: "Ueda 62', 80'".
function drawScorers(match) {
  const goals = (match.events || []).filter((e) => e.type === "goal" || e.type === "penalty_goal" || e.type === "own_goal");
  if (goals.length === 0) return null;
  const box = el("div", "lvd-scorers");
  for (const which of ["home", "away"]) {
    const list = el("ul", `lvd-scorer-list lvd-scorer-list--${which}`);
    const byPlayer = new Map();
    for (const e of goals.filter((g) => g.side === which)) {
      const name = e.player || "";
      if (!byPlayer.has(name)) byPlayer.set(name, []);
      let minute = eventMinute(e);
      if (e.type === "penalty_goal") minute += ` (${t("live_pen_short")})`;
      if (e.type === "own_goal") minute += ` (${t("live_og_short")})`;
      byPlayer.get(name).push(minute);
    }
    for (const [name, minutes] of byPlayer) {
      const item = el("li", "lvd-scorer");
      const label = el("span", "lvd-scorer-name", surname(name));
      label.title = name;
      item.append(icon(ICONS.ball, "lvd-scorer-icon", { strokeWidth: 1.6 }), label, el("span", "lvd-scorer-min", minutes.join(", ")));
      list.append(item);
    }
    box.append(list);
  }
  return box;
}

// ---- Summary: what happened, and where and when

const EVENT_LOOK = {
  goal: { icon: "ball", label: "live_ev_goal" },
  penalty_goal: { icon: "ball", label: "live_ev_penalty_goal", note: "live_ev_penalty_goal" },
  own_goal: { icon: "ball", label: "live_ev_own_goal", note: "live_ev_own_goal", className: "is-own" },
  missed_penalty: { icon: "missed", label: "live_ev_missed_penalty", note: "live_ev_missed_penalty" },
  yellow_card: { icon: "card", label: "live_ev_yellow", className: "is-yellow" },
  red_card: { icon: "card", label: "live_ev_red", className: "is-red" },
  substitution: { icon: "sub", label: "live_ev_sub" },
  var: { icon: "var", label: "live_var_check" },
};

function drawSummary(self, data) {
  const { match } = data;
  const out = [];
  const events = (match.events || []).filter((e) => EVENT_LOOK[e.type]);

  if (events.length === 0) {
    out.push(message(t(match.phase === "scheduled" || match.phase === "unknown" ? "live_not_started" : "live_no_events")));
  } else {
    const list = el("ul", "lvd-card lvd-timeline");
    let halfDrawn = false;
    // Half-time comes after the first half's last event, once the match got there.
    const pastHalf = match.phase !== "live" || match.period !== "first_half";
    for (const e of events) {
      if (!halfDrawn && pastHalf && data.halfTime && (e.minute ?? 0) > 45) {
        list.append(divider(`${t("live_st_half_time")}  ${data.halfTime.home} - ${data.halfTime.away}`));
        halfDrawn = true;
      }
      list.append(drawEvent(e));
    }
    if (!halfDrawn && pastHalf && data.halfTime) {
      list.append(divider(`${t("live_st_half_time")}  ${data.halfTime.home} - ${data.halfTime.away}`));
    }
    if (match.phase === "finished") {
      const status = matchStatus(match);
      list.append(divider(`${t(status.key)}  ${scoreText(match.home)} - ${scoreText(match.away)}`));
    }
    out.push(list);
  }

  // Match info, as iOS lists it: a label and its value on each row.
  const info = el("dl", "lvd-card lvd-info");
  const row = (label, value) => {
    if (!value) return;
    const line = el("div", "lvd-info-row");
    line.append(el("dt", null, label), el("dd", null, value));
    info.append(line);
  };
  row(t("live_kickoff"), kickoffDateTime(match.kickoff, currentLang, self.tz));
  if (data.venue) row(t("live_venue"), [data.venue.name, data.venue.city].filter(Boolean).join(", "));
  row(t("live_referee"), data.referee);
  out.push(el("h2", "lvd-section-title", t("live_info")), info);
  return out;
}

function divider(text) {
  const item = el("li", "lvd-divider");
  item.append(el("span", null, text));
  return item;
}

function drawEvent(e) {
  const look = EVENT_LOOK[e.type];
  const item = el("li", `lvd-event lvd-event--${e.side}`);
  const what = el("div", "lvd-event-what");
  const mark = icon(ICONS[look.icon], `lvd-event-icon ${look.className || ""}`.trim(), { strokeWidth: 1.8 });
  const text = el("div", "lvd-event-text");

  let lines;
  let label;
  if (e.type === "substitution") {
    const on = el("span", "lvd-event-main");
    on.append(icon(ICONS.up, "lvd-arrow is-on", { strokeWidth: 2.4 }), document.createTextNode(e.player || ""));
    const off = el("span", "lvd-event-sub");
    off.append(icon(ICONS.down, "lvd-arrow is-off", { strokeWidth: 2.4 }), document.createTextNode(e.playerOff || ""));
    lines = [on, off];
    label = t("live_ev_sub_aria", { on: e.player || "", off: e.playerOff || "" });
  } else {
    const note = e.type === "var"
      ? (e.detail ? t(`live_var_${e.detail}`) : t("live_var_check"))
      : e.assist ? t("live_assist", { name: e.assist }) : look.note ? t(look.note) : null;
    lines = [el("span", "lvd-event-main", e.player || t(look.label))];
    if (note) lines.push(el("span", "lvd-event-sub", note));
    label = [t(look.label), e.player, note && note !== t(look.label) ? note : null].filter(Boolean).join(", ");
  }
  text.append(...lines);
  what.append(mark, text);

  const minute = el("span", "lvd-event-min", eventMinute(e));
  item.setAttribute("aria-label", `${eventMinute(e)} ${label}`);
  // The minute sits in the middle: home events to its left, away to its right.
  const empty = el("div", "lvd-event-what");
  if (e.side === "home") item.append(what, minute, empty);
  else item.append(empty, minute, what);
  return item;
}

// ---- Line-ups: the pitch, then substitutes and coaches

function drawLineups(data) {
  const { lineups, match } = data;
  if (!lineups || (!lineups.home && !lineups.away)) {
    const later = match.phase === "scheduled" || match.phase === "unknown";
    return [message(t(later ? "live_lineups_later" : "live_no_lineups"))];
  }
  const out = [];
  const card = el("div", "lvd-card lvd-lineup");
  const label = (which) => {
    const line = el("div", `lvd-pitch-label lvd-pitch-label--${which}`);
    const team = match[which].team;
    line.append(logo(team.logo, 22, "lvd-pitch-crest"), el("span", "lvd-pitch-team", team.name));
    const formation = lineups[which]?.formation;
    if (formation) line.append(el("span", "lvd-pitch-formation", formation));
    return line;
  };

  const pitch = el("div", "lvd-pitch");
  const lines = el("div", "lvd-pitch-lines");
  lines.innerHTML = PITCH_LINES; // fixed drawing above, no outside data
  pitch.append(lines);
  for (const which of ["home", "away"]) {
    for (const player of placed(lineups[which]?.starters || [], which)) pitch.append(drawPlayer(player, which));
  }
  card.append(label("home"), pitch, label("away"));
  out.push(card);

  // Substitutes, side by side.
  const subs = el("div", "lvd-card lvd-bench");
  for (const which of ["home", "away"]) {
    const column = el("div", `lvd-bench-side lvd-bench-side--${which}`);
    const head = el("div", "lvd-bench-head");
    head.append(logo(match[which].team.logo, 18, "lvd-bench-crest"), el("span", null, match[which].team.name));
    const list = el("ul", "lvd-bench-list");
    for (const p of lineups[which]?.substitutes || []) {
      const item = el("li", "lvd-bench-player");
      item.append(el("span", "lvd-bench-number", Number.isInteger(p.number) ? String(p.number) : ""), el("span", "lvd-bench-name", p.name));
      const marks = el("span", "lvd-bench-marks");
      appendMarks(marks, p, { withMinutes: true });
      item.append(marks);
      list.append(item);
    }
    column.append(head, list);
    const coach = lineups[which]?.coach;
    if (coach) {
      const line = el("div", "lvd-coach");
      line.append(el("span", "lvd-coach-label", t("live_coach")), el("span", "lvd-coach-name", coach));
      column.append(line);
    }
    subs.append(column);
  }
  out.push(el("h2", "lvd-section-title", t("live_substitutes")), subs);
  return out;
}

// Where each starter stands, as shares of the pitch: the home team in the
// top half (left half on wide screens), the away team in the other.
function placed(starters, which) {
  const rows = new Map();
  for (const p of starters) {
    if (!p.grid) continue;
    if (!rows.has(p.grid.row)) rows.set(p.grid.row, []);
    rows.get(p.grid.row).push(p);
  }
  const lineCount = Math.max(...rows.keys(), 1);
  const out = [];
  for (const [row, players] of rows) {
    players.sort((a, b) => a.grid.col - b.grid.col);
    // From the goal line (6%) to just short of halfway (44%).
    const depth = lineCount === 1 ? 6 : 6 + ((row - 1) * 38) / (lineCount - 1);
    players.forEach((p, i) => {
      const across = ((i + 0.5) / players.length) * 100;
      out.push({
        ...p,
        // Facing each other: what is one team's left is the other's right.
        x: which === "home" ? 100 - across : across,
        y: which === "home" ? depth : 100 - depth,
      });
    });
  }
  return out;
}

// "Dayot Upamecano" -> "Upamecano": the name a score line uses.
function surname(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return parts[parts.length - 1] || "";
}

// "B. Özer" -> "Özer"; a single name stays as it is.
function shortName(name) {
  const parts = String(name || "").trim().split(/\s+/);
  if (parts.length > 1 && /\.$/.test(parts[0])) return parts.slice(1).join(" ");
  return parts.length > 2 ? parts.slice(-1)[0] : parts.join(" ");
}

function drawPlayer(p, which) {
  const node = el("div", `lvd-player lvd-player--${which}`);
  node.style.setProperty("--x", `${p.x}%`);
  node.style.setProperty("--y", `${p.y}%`);
  const disc = el("span", "lvd-player-disc", Number.isInteger(p.number) ? String(p.number) : "");
  const marks = el("span", "lvd-player-marks");
  appendMarks(marks, p, { withMinutes: false });
  disc.append(marks);
  node.append(disc, el("span", "lvd-player-name", shortName(p.name)));
  node.title = p.name;
  return node;
}

// Small signs of what a player did: goals, a card, coming on or off.
function appendMarks(box, p, { withMinutes }) {
  for (let i = 0; i < (p.goals || 0); i++) box.append(icon(ICONS.ball, "lvd-mark lvd-mark-goal", { strokeWidth: 1.8 }));
  for (let i = 0; i < (p.ownGoals || 0); i++) box.append(icon(ICONS.ball, "lvd-mark lvd-mark-goal is-own", { strokeWidth: 1.8 }));
  if (p.card) box.append(icon(ICONS.card, `lvd-mark lvd-mark-card is-${p.card}`));
  if (Number.isInteger(p.offAt)) {
    box.append(icon(ICONS.down, "lvd-mark lvd-mark-off", { strokeWidth: 2.6 }));
    if (withMinutes) box.append(el("span", "lvd-mark-min", `${p.offAt}'`));
  }
  if (Number.isInteger(p.onAt)) {
    box.append(icon(ICONS.up, "lvd-mark lvd-mark-on", { strokeWidth: 2.6 }));
    if (withMinutes) box.append(el("span", "lvd-mark-min", `${p.onAt}'`));
  }
}

// ---- Statistics: both teams' numbers with a bar each

function drawStats(data) {
  const { statistics, match } = data;
  if (!statistics || statistics.length === 0) {
    const later = match.phase === "scheduled" || match.phase === "unknown";
    return [message(t(later ? "live_stats_later" : "live_no_stats"))];
  }
  const card = el("div", "lvd-card lvd-stats");
  const head = el("div", "lvd-stats-head");
  head.append(logo(match.home.team.logo, 22, "lvd-stats-crest"), logo(match.away.team.logo, 22, "lvd-stats-crest"));
  card.append(head);

  for (const stat of statistics) {
    const label = t(`live_stat_${stat.key}`);
    // A statistic this page does not know yet is left out (it has no name).
    if (label === `live_stat_${stat.key}`) continue;
    const shares = statShares(stat);
    const lead = shares.home === shares.away ? "none" : shares.home > shares.away ? "home" : "away";
    const row = el("div", `lvd-stat${stat.key === "possession" ? " lvd-stat--split" : ""}`);
    const home = el("span", `lvd-stat-value${lead === "home" ? " is-lead" : ""}`, statText(stat, "home", currentLang));
    const away = el("span", `lvd-stat-value${lead === "away" ? " is-lead" : ""}`, statText(stat, "away", currentLang));
    row.append(home, el("span", "lvd-stat-label", label), away);

    const bars = el("div", "lvd-stat-bars");
    bars.setAttribute("aria-hidden", "true");
    if (stat.key === "possession") {
      const h = el("span", `lvd-bar-fill${lead === "home" ? " is-lead" : ""}`);
      const a = el("span", `lvd-bar-fill${lead === "away" ? " is-lead" : ""}`);
      h.style.flexGrow = String(shares.home || 0.5);
      a.style.flexGrow = String(shares.away || 0.5);
      bars.append(h, a);
    } else {
      for (const which of ["home", "away"]) {
        const track = el("span", `lvd-bar-track lvd-bar-track--${which}`);
        const fill = el("span", `lvd-bar-fill${lead === which ? " is-lead" : ""}`);
        fill.style.width = `${Math.round(shares[which] * 100)}%`;
        track.append(fill);
        bars.append(track);
      }
    }
    row.append(bars);
    card.append(row);
  }
  return [card];
}

// ---- loading and messages

function skeletonHead() {
  const box = el("div", "lvd-skel-head");
  box.setAttribute("aria-busy", "true");
  box.setAttribute("aria-label", t("live_loading"));
  return box;
}

function skeletonRows() {
  const box = el("div", "lvd-skel");
  for (let i = 0; i < 5; i++) box.append(el("div", "lv-skel-row"));
  return box;
}

function message(text, actionLabel, onAction) {
  const box = el("div", "lv-message lvd-message");
  box.append(el("p", null, text));
  if (actionLabel) {
    const button = el("button", "lv-button", actionLabel);
    button.type = "button";
    button.addEventListener("click", onAction);
    box.append(button);
  }
  return box;
}
