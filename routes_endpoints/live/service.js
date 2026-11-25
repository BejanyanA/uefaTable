// What to fetch, how long it stays fresh, and how the day's request
// allowance is protected. Routes ask this file; this file asks the provider
// and the cache.
//
// The promise it keeps: the number of provider calls depends on what is being
// watched and on the clock, never on how many people are watching.

import * as cache from "./cache.js";
import {
  LIVE_REFRESH_SECONDS, dayRefreshSeconds, forList, groupByCompetition,
  matchesInWindow, mayBeInPlay, overlay,
} from "./arrange.js";
import { FEATURED } from "./competitions.js";
import { addDays, daysBetween, localDateOf, localDayWindow, utcDateOf, utcDatesOf } from "./day.js";
import { isInPlay, isOver } from "./model.js";
import { getProvider } from "./providers/index.js";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// How long each stored copy counts as fresh. The same numbers are in the
// request budget (.claude/skills/live-section-quality/references/request-budget.md);
// change both together.
const FRESH = {
  live: LIVE_REFRESH_SECONDS * SECOND,
  dateInProgress: 10 * MINUTE,
  dateAhead: 60 * MINUTE,
  dateFinished: 24 * HOUR,
};

// How far from today a viewer may go. A fixed range, so nobody can make us
// fetch years of dates.
export const DAYS_BACK = 7;
export const DAYS_AHEAD = 7;

// A match that left the live list is kept in live answers this long, so
// clients that only refresh scores still learn how it ended.
const ENDED_KEEP_MS = 15 * MINUTE;
const MAX_ENDED_LOOKUPS = 40;
const PREVIOUS_LOOK_MAX_MS = 30 * MINUTE;
const KEY_SETTLE = "settle";

// A request waits at most this long for a fresh live list before it is
// answered from the stored one.
const WAIT_FOR_FRESH_MS = 1200;
// After a failed refresh, the earliest moment anyone tries again.
const RETRY_AFTER_FAILURE_MS = 3 * SECOND;

// Budget guard: past these shares of the daily allowance we slow down.
const SLOW_AT = 0.7;
const STOP_AT = 0.9;
const LIVE_WHEN_STOPPED_MS = 60 * SECOND;

const KEY_LIVE = "live";
const KEY_QUOTA = "quota";
const dateKey = (utcDate) => `date:${utcDate}`;

export class LiveError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

// ---------------------------------------------------------------- allowance

async function readQuota(env, now) {
  const stored = await cache.read(env, KEY_QUOTA);
  const quota = stored?.value;
  if (!quota || quota.day !== utcDateOf(now)) return null;
  return quota;
}

// The provider tells us what is left with every answer; that is the truth.
async function recordQuota(env, quota, now) {
  if (!quota) return;
  await cache.write(env, KEY_QUOTA, { day: utcDateOf(now), ...quota }, now);
}

function usedShare(quota) {
  if (!quota || !quota.limitPerDay) return 0;
  return 1 - quota.remainingToday / quota.limitPerDay;
}

// ---------------------------------------------------------------- stored copies

// The stored copy of `key`, refreshed through `fetcher` when it is too old.
//
// wait = false: answer at once with what we have and refresh in the
//               background (the next request gets the new copy).
// wait = true:  the request that wins the refresh waits a short moment for
//               the new copy, then falls back to what we have while the
//               refresh carries on in the background.
//
// Returns { value, fetchedAt, stale }. `stale` means we wanted a newer copy
// and could not get one.
async function stored(env, ctx, { key, freshFor, fetcher, wait, now, mayRefresh = true }) {
  const have = await cache.read(env, key);
  const freshMs = freshFor(have?.value || null);
  const age = have ? now - have.fetchedAt : Infinity;
  if (have && age <= freshMs) return { ...have, stale: false };

  const tooOld = have ? age > freshMs * 3 : true;
  if (!mayRefresh) {
    if (have) return { ...have, stale: true };
    throw new LiveError("unavailable", 503);
  }

  if (await cache.claim(env, key, now)) {
    const refreshing = (async () => {
      try {
        const value = await fetcher(have);
        const at = Date.now();
        await cache.write(env, key, value, at);
        return { value, fetchedAt: at, stale: false };
      } catch (err) {
        console.error(`live: could not refresh ${key}: ${err?.message || err}`);
        await cache.release(env, key, Date.now() + RETRY_AFTER_FAILURE_MS).catch(() => {});
        return null;
      }
    })();

    if (!have) {
      const fresh = await refreshing;
      if (fresh) return fresh;
      throw new LiveError("unavailable", 503);
    }
    ctx?.waitUntil?.(refreshing);
    if (!wait) return { ...have, stale: tooOld };
    const fresh = await Promise.race([refreshing, new Promise((r) => setTimeout(() => r(null), WAIT_FOR_FRESH_MS))]);
    return fresh || { ...have, stale: tooOld };
  }

  // Someone else is refreshing this key right now.
  if (have) return { ...have, stale: tooOld };
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 700));
    const again = await cache.read(env, key);
    if (again) return { ...again, stale: false };
  }
  throw new LiveError("unavailable", 503);
}

// ---------------------------------------------------------------- provider data

// Every match of one UTC calendar date.
async function loadDate(env, ctx, utcDate, now, quota) {
  const today = utcDateOf(now);
  const share = usedShare(quota);
  const slow = share >= SLOW_AT ? 2 : 1;

  // A date whose matches are all over does not change any more.
  const freshFor = (have) => {
    if (have && have.matches.length > 0 && have.matches.every(isOver)) return FRESH.dateFinished;
    return (utcDate > today ? FRESH.dateAhead : FRESH.dateInProgress) * slow;
  };

  return stored(env, ctx, {
    key: dateKey(utcDate),
    freshFor,
    wait: false,
    now,
    mayRefresh: share < STOP_AT,
    fetcher: async () => {
      const { matches, competitions, quota: left } = await getProvider(env).getMatchesByDate(env, { date: utcDate });
      await recordQuota(env, left, Date.now());
      return { matches, competitions };
    },
  });
}

// Ask the provider how a few matches stand now, and correct the stored days
// with the answer, so a match that ended is not shown as live from an old copy.
async function settle(env, ids) {
  const provider = getProvider(env);
  const settled = [];
  for (let i = 0; i < ids.length; i += provider.MAX_IDS_PER_CALL) {
    try {
      const { matches, quota } = await provider.getMatchesByIds(env, { ids: ids.slice(i, i + provider.MAX_IDS_PER_CALL) });
      await recordQuota(env, quota, Date.now());
      settled.push(...matches);
    } catch {
      // Their state arrives with the next refresh of their date instead.
    }
  }

  const byDate = new Map();
  for (const match of settled) {
    const key = dateKey(utcDateOf(Date.parse(match.kickoff)));
    if (!byDate.has(key)) byDate.set(key, new Map());
    byDate.get(key).set(match.id, match);
  }
  for (const [key, fresher] of byDate) {
    await cache.patch(env, key, (day) => ({
      ...day,
      // Stored days carry no events; those come with the live list.
      matches: day.matches.map((m) => (fresher.has(m.id) ? { ...fresher.get(m.id), events: undefined } : m)),
    }));
  }
  return settled;
}

// Every match in play, plus the ones that ended in the last minutes.
async function loadLive(env, ctx, now, quota) {
  const share = usedShare(quota);
  let freshMs = FRESH.live;
  if (share >= SLOW_AT) freshMs *= 2;
  if (share >= STOP_AT) freshMs = LIVE_WHEN_STOPPED_MS;

  return stored(env, ctx, {
    key: KEY_LIVE,
    freshFor: () => freshMs,
    wait: true,
    now,
    fetcher: async (previous) => {
      const { matches, competitions, quota: left } = await getProvider(env).getLiveMatches(env);
      await recordQuota(env, left, Date.now());
      const at = Date.now();
      const liveIds = new Set(matches.map((m) => m.id));

      // Matches that were in play at the previous look and are gone now have
      // ended. Only trust a recent previous look: after a long pause their
      // dates are refreshed anyway.
      let justEnded = [];
      if (previous && at - previous.fetchedAt < PREVIOUS_LOOK_MAX_MS) {
        const gone = previous.value.matches.filter((m) => !liveIds.has(m.id)).slice(0, MAX_ENDED_LOOKUPS);
        if (gone.length > 0) justEnded = (await settle(env, gone.map((m) => m.id))).map((match) => ({ match, endedAt: at }));
      }
      const ended = [...(previous?.value.ended || []), ...justEnded]
        .filter((e) => at - e.endedAt < ENDED_KEEP_MS && !liveIds.has(e.match.id));
      return { matches, competitions, ended };
    },
  });
}

// ---------------------------------------------------------------- answers

function meta({ fetchedAt, stale, refreshAfterSeconds }) {
  return {
    updatedAt: new Date(fetchedAt).toISOString().replace(/\.\d{3}Z$/, "Z"),
    refreshAfterSeconds,
    stale: Boolean(stale),
  };
}

export function getCompetitions(now) {
  return {
    data: { competitions: FEATURED },
    meta: meta({ fetchedAt: now, stale: false, refreshAfterSeconds: 24 * 60 * 60 }),
  };
}

// The opening screen: the matches of one day in the viewer's own time zone.
export async function getDay(env, ctx, { date, tz, now }) {
  const today = localDateOf(now, tz);
  const day = date || today;
  const distance = daysBetween(today, day);
  if (distance < -DAYS_BACK || distance > DAYS_AHEAD) throw new LiveError("out_of_range", 400);

  const quota = await readQuota(env, now);
  const window = localDayWindow(day, tz);
  const dates = utcDatesOf(window);
  const days = await Promise.all(dates.map((d) => loadDate(env, ctx, d, now, quota)));

  // Have the days next to this one ready, so switching day is instant and
  // does not depend on the provider answering at that moment.
  const around = [];
  if (distance > -DAYS_BACK) around.push(addDays(dates[0], -1));
  if (distance < DAYS_AHEAD) around.push(addDays(dates[dates.length - 1], 1));
  ctx?.waitUntil?.(Promise.all(around.map((d) => loadDate(env, ctx, d, now, quota).catch(() => {}))));

  let matches = days.flatMap((d) => matchesInWindow(d.value.matches, window));
  const competitions = Object.assign({}, ...days.map((d) => d.value.competitions));
  let fetchedAt = Math.min(...days.map((d) => d.fetchedAt));
  let stale = days.some((d) => d.stale);

  // While something is on, lay the live list over the day: the stored day may
  // be minutes old, the live list seconds.
  let live = null;
  if (matches.some((m) => mayBeInPlay(m, now))) {
    try {
      const fresh = await loadLive(env, ctx, now, quota);
      const fresher = new Map();
      for (const e of fresh.value.ended) fresher.set(e.match.id, e.match);
      for (const m of fresh.value.matches) fresher.set(m.id, m);
      matches = overlay(matches, fresher);
      Object.assign(competitions, fresh.value.competitions);

      // Stored as in play but missing from a current live list: it ended while
      // nobody was watching. Find out how, once (the stored day is corrected).
      if (!fresh.stale) {
        const orphans = matches.filter((m) => isInPlay(m) && !fresher.has(m.id)).slice(0, MAX_ENDED_LOOKUPS);
        if (orphans.length > 0 && (await cache.claim(env, KEY_SETTLE, now))) {
          const settled = await settle(env, orphans.map((m) => m.id));
          matches = overlay(matches, new Map(settled.map((m) => [m.id, m])));
        }
      }
      stale = stale || fresh.stale;
      live = {
        count: matches.filter(isInPlay).length,
        refreshAfterSeconds: LIVE_REFRESH_SECONDS,
      };
    } catch {
      stale = true;
    }
  }

  return {
    data: {
      date: day,
      timeZone: tz,
      today,
      previousDate: distance > -DAYS_BACK ? addDays(day, -1) : null,
      nextDate: distance < DAYS_AHEAD ? addDays(day, 1) : null,
      // The days a viewer may ask for, so no client has to know the rule.
      range: { from: addDays(today, -DAYS_BACK), to: addDays(today, DAYS_AHEAD) },
      live,
      groups: groupByCompetition(matches, competitions),
    },
    meta: meta({ fetchedAt, stale, refreshAfterSeconds: dayRefreshSeconds(matches, now) }),
  };
}

// Only what changes quickly: the matches in play, and those just ended.
// Clients replace their copy of each match by id.
export async function getLive(env, ctx, { now }) {
  const quota = await readQuota(env, now);
  const fresh = await loadLive(env, ctx, now, quota);
  const { matches, ended } = fresh.value;
  return {
    data: {
      matches: matches.map(forList),
      ended: ended.map((e) => forList(e.match)),
    },
    meta: meta({
      fetchedAt: fresh.fetchedAt,
      stale: fresh.stale,
      refreshAfterSeconds: matches.length > 0 ? LIVE_REFRESH_SECONDS : 60,
    }),
  };
}

// For the people running the site, not for clients: how much of the day's
// allowance is used.
export async function getQuota(env, now) {
  return readQuota(env, now);
}
