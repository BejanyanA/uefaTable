// Small pure helpers that turn Live API values into what a person reads.
// No DOM, no fetch, no clock: everything comes in as an argument, so these
// are easy to test and are the exact reference for a mobile app.

// The site's language codes -> the codes browsers use for dates and times.
const LOCALES = { en: "en-GB", fr: "fr-FR", am: "hy-AM" };

export function localeFor(lang) {
  return LOCALES[lang] || LOCALES.en;
}

export function addDays(date, days) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Whole days from `from` to `to`.
export function daysBetween(from, to) {
  const ms = (date) => Date.UTC(...date.split("-").map((n, i) => (i === 1 ? n - 1 : +n)));
  return Math.round((ms(to) - ms(from)) / 86400000);
}

// The days shown in the day switcher: the selected day in the middle where
// the allowed range lets it be.
export function daysAround(selected, range, count) {
  const half = Math.floor(count / 2);
  let first = addDays(selected, -half);
  if (daysBetween(range.from, first) < 0) first = range.from;
  if (daysBetween(addDays(first, count - 1), range.to) < 0) first = addDays(range.to, -(count - 1));
  if (daysBetween(range.from, first) < 0) first = range.from;
  const days = [];
  for (let i = 0; i < count; i++) {
    const day = addDays(first, i);
    if (daysBetween(day, range.to) >= 0) days.push(day);
  }
  return days;
}

// "Today", "Yesterday", "Tomorrow" as translation keys, or null for other days.
export function relativeDayKey(date, today) {
  const diff = daysBetween(today, date);
  if (diff === 0) return "live_today";
  if (diff === -1) return "live_yesterday";
  if (diff === 1) return "live_tomorrow";
  return null;
}

// Some browsers have no Armenian date names and would quietly answer in
// English. For those, the names come from here.
const FALLBACK_NAMES = {
  am: {
    weekdays: ["Կիր", "Երկ", "Երք", "Չրք", "Հնգ", "Ուրբ", "Շբթ"],
    months: ["հնվ", "փտվ", "մրտ", "ապր", "մյս", "հնս", "հլս", "օգս", "սեպ", "հոկ", "նոյ", "դեկ"],
  },
};

function hasLocale(locale) {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0;
  } catch {
    return false;
  }
}

// A calendar date as short text ("Wed 25 Nov"). The date has no time zone of
// its own, so it is formatted as UTC to stay the day it names.
export function dateParts(date, lang) {
  const at = new Date(`${date}T12:00:00Z`);
  const locale = localeFor(lang);
  const names = FALLBACK_NAMES[lang];
  if (names && !hasLocale(locale)) {
    const weekday = names.weekdays[at.getUTCDay()];
    const dayMonth = `${at.getUTCDate()} ${names.months[at.getUTCMonth()]}`;
    return { weekday, dayMonth, full: `${weekday}, ${dayMonth}` };
  }
  return {
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(at),
    dayMonth: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(at),
    full: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(at),
  };
}

// Kick-off in the viewer's own time zone ("21:00").
export function kickoffTime(iso, lang) {
  // Always the 24-hour clock: all three languages use it for match times.
  return new Intl.DateTimeFormat(localeFor(lang), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

export function isInPlay(match) {
  return match.phase === "live" || match.phase === "break" || match.phase === "suspended";
}

// What the left column of a match row says. Returns either ready text or a
// translation key, plus whether the row counts as live.
//   { text } | { key }   and   live: boolean
export function matchStatus(match) {
  switch (match.phase) {
    case "live":
      if (match.period === "penalties") return { key: "live_st_penalties", live: true };
      if (Number.isInteger(match.minute)) {
        const added = Number.isInteger(match.addedTime) && match.addedTime > 0 ? `+${match.addedTime}` : "";
        return { text: `${match.minute}${added}'`, live: true };
      }
      return { key: "live_st_live", live: true };
    case "break":
      return { key: match.period === "half_time" ? "live_st_half_time" : "live_st_break", live: true };
    case "finished":
      if (match.decidedBy === "extra_time") return { key: "live_st_after_extra_time", live: false };
      if (match.decidedBy === "penalties") return { key: "live_st_after_penalties", live: false };
      return { key: "live_st_full_time", live: false };
    case "postponed": return { key: "live_st_postponed", live: false };
    case "cancelled": return { key: "live_st_cancelled", live: false };
    case "suspended": return { key: "live_st_suspended", live: true };
    case "abandoned": return { key: "live_st_abandoned", live: false };
    // "scheduled", "unknown" and any value added later: the kick-off time.
    default: return { kickoff: true, live: false };
  }
}

// A side's score as text; "" before the match has one.
export function scoreText(side) {
  return Number.isInteger(side.score) ? String(side.score) : "";
}

export function redCards(match, which) {
  if (!Array.isArray(match.events)) return 0;
  return match.events.filter((e) => e.type === "red_card" && e.side === which).length;
}

// "Updated just now" / "Updated 3 min ago" as { key, n }.
export function updatedAgo(updatedAtIso, now) {
  const minutes = Math.floor((now - Date.parse(updatedAtIso)) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return { key: "live_updated_now" };
  return { key: "live_updated_min", n: minutes };
}
