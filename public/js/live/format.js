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

// Every day from the first to the last one a viewer may open.
export function daysInRange(range) {
  const days = [];
  for (let day = range.from; daysBetween(day, range.to) >= 0; day = addDays(day, 1)) days.push(day);
  return days;
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
export function kickoffTime(iso, lang, timeZone) {
  // Always the 24-hour clock: all three languages use it for match times.
  const options = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  if (timeZone) options.timeZone = timeZone;
  return new Intl.DateTimeFormat(localeFor(lang), options).format(new Date(iso));
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
        // Added time comes as its own part ("+2"), so it can be drawn smaller.
        if (Number.isInteger(match.addedTime) && match.addedTime > 0) {
          const added = `+${match.addedTime}`;
          return { text: `${match.minute}${added}'`, minute: `${match.minute}'`, added, live: true };
        }
        return { text: `${match.minute}'`, live: true };
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

// When an event happened: "67'", "90+2'".
export function eventMinute(event) {
  if (!Number.isInteger(event.minute)) return "";
  const added = Number.isInteger(event.addedTime) && event.addedTime > 0 ? `+${event.addedTime}` : "";
  return `${event.minute}${added}'`;
}

// A statistic's value as text: "35%", "2.15", "406".
export function statText(stat, which, lang) {
  const value = stat[which];
  if (!Number.isFinite(value)) return "-";
  if (stat.format === "percent") return `${Math.round(value)}%`;
  if (stat.format === "decimal") {
    return new Intl.NumberFormat(localeFor(lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat(localeFor(lang)).format(value);
}

// Each side's share of a statistic, 0 to 1, for the bars. Both 0: no bars.
export function statShares(stat) {
  const home = Math.max(0, Number(stat.home) || 0);
  const away = Math.max(0, Number(stat.away) || 0);
  const total = home + away;
  if (total === 0) return { home: 0, away: 0 };
  return { home: home / total, away: away / total };
}

// Kick-off as a full date and time in the viewer's time zone:
// "Thursday 26 November, 21:45". Built from dateParts, so browsers without
// Armenian date names still answer in Armenian.
export function kickoffDateTime(iso, lang, timeZone) {
  return `${dateParts(localDate(iso, timeZone), lang).full}, ${kickoffTime(iso, lang, timeZone)}`;
}

// The viewer's calendar date of a moment ("2026-11-25").
export function localDate(iso, timeZone) {
  const options = { year: "numeric", month: "2-digit", day: "2-digit" };
  if (timeZone) options.timeZone = timeZone;
  const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(new Date(iso));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
