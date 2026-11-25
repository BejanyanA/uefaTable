// Calendar-day arithmetic for "the viewer's day".
//
// A viewer asks for a date in their own time zone. Matches are stored by UTC
// calendar date, the same for everyone, so the server has to work out which
// instant the viewer's day starts and ends at, and which UTC dates it touches.
// Pure functions: the current time is always passed in.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidDate(text) {
  const m = DATE_RE.exec(String(text ?? ""));
  if (!m) return false;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return new Date(ms).toISOString().slice(0, 10) === text;
}

// Building a formatter is slow, so each time zone gets one and keeps it.
const formatters = new Map();
const MAX_FORMATTERS = 200;

function formatterFor(tz) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    if (formatters.size >= MAX_FORMATTERS) formatters.clear();
    formatters.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz) {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    formatterFor(tz);
    return true;
  } catch {
    return false;
  }
}

function dateToUtcMs(date) {
  const m = DATE_RE.exec(date);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

export function addDays(date, days) {
  return new Date(dateToUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10);
}

// Whole days from `from` to `to` (negative when `to` is earlier).
export function daysBetween(from, to) {
  return Math.round((dateToUtcMs(to) - dateToUtcMs(from)) / DAY_MS);
}

export function utcDateOf(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// How far the zone's wall clock is ahead of UTC at that instant, in ms.
function zoneOffsetMs(tz, utcMs) {
  const parts = formatterFor(tz).formatToParts(new Date(utcMs));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const wallAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

// The calendar date it is in that time zone at that instant.
export function localDateOf(ms, tz) {
  return utcDateOf(ms + zoneOffsetMs(tz, ms));
}

// The instant at which that calendar date begins in that time zone.
function localMidnight(date, tz) {
  const wall = dateToUtcMs(date);
  // Two passes: the offset at the first guess can differ from the offset at
  // the real midnight on a day the clocks change.
  let guess = wall - zoneOffsetMs(tz, wall);
  guess = wall - zoneOffsetMs(tz, guess);
  return guess;
}

// The viewer's day as a half-open range of instants: start <= t < end.
export function localDayWindow(date, tz) {
  return { start: localMidnight(date, tz), end: localMidnight(addDays(date, 1), tz) };
}

// The UTC calendar dates a range of instants touches (one or two for a day).
export function utcDatesOf({ start, end }) {
  const dates = [];
  for (let d = utcDateOf(start); d <= utcDateOf(end - 1); d = addDays(d, 1)) dates.push(d);
  return dates;
}
