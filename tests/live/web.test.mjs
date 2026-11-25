// The website's pure Live helpers: the same rules a mobile app will follow.
import test from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, daysInRange, kickoffTime, matchStatus, scoreText, updatedAgo } from "../../public/js/live/format.js";
import { changedScores, countInPlay, createDayStore, mergeLive } from "../../public/js/live/store.js";

const side = (score, penalties = null) => ({ team: { id: "t", name: "T", logo: null }, score, penalties, winner: null });
const match = (id, phase, home = null, away = null, extra = {}) => ({ id, kickoff: "2026-11-25T18:00:00Z", phase, period: null, minute: null, addedTime: null, home: side(home), away: side(away), decidedBy: null, ...extra });
const day = (matches, extra = {}) => ({ date: "2026-11-25", today: "2026-11-25", previousDate: "2026-11-24", nextDate: "2026-11-26", range: { from: "2026-11-18", to: "2026-12-02" }, live: null, groups: [{ competition: { key: "c", name: "C" }, matches }], ...extra });

test("day arithmetic and the day strip", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(daysBetween("2026-11-25", "2026-11-28"), 3);
  const days = daysInRange({ from: "2026-11-18", to: "2026-12-02" });
  assert.equal(days.length, 15, "a week back, today, a week ahead");
  assert.equal(days[0], "2026-11-18");
  assert.equal(days.at(-1), "2026-12-02");
  assert.equal(days[7], "2026-11-25");
  assert.deepEqual(daysInRange({ from: "2026-11-25", to: "2026-11-25" }), ["2026-11-25"]);
});

test("what the status column says", () => {
  assert.deepEqual(matchStatus(match("m", "scheduled")), { kickoff: true, live: false });
  assert.deepEqual(matchStatus(match("m", "live", 1, 0, { minute: 67 })), { text: "67'", live: true });
  assert.deepEqual(matchStatus(match("m", "live", 1, 0, { minute: 45, addedTime: 2 })), { text: "45+2'", minute: "45'", added: "+2", live: true });
  assert.deepEqual(matchStatus(match("m", "live", 1, 1, { period: "penalties", minute: 120 })), { key: "live_st_penalties", live: true });
  assert.deepEqual(matchStatus(match("m", "break", 0, 0, { period: "half_time" })), { key: "live_st_half_time", live: true });
  assert.deepEqual(matchStatus(match("m", "finished", 2, 1, { decidedBy: "regular" })), { key: "live_st_full_time", live: false });
  assert.deepEqual(matchStatus(match("m", "finished", 2, 2, { decidedBy: "penalties" })), { key: "live_st_after_penalties", live: false });
  assert.equal(matchStatus(match("m", "postponed")).key, "live_st_postponed");
});

test("a phase this version has never heard of falls back to the kick-off time", () => {
  assert.deepEqual(matchStatus(match("m", "something_new")), { kickoff: true, live: false });
  assert.deepEqual(matchStatus(match("m", "unknown")), { kickoff: true, live: false });
});

test("scores and times as text", () => {
  assert.equal(scoreText(side(3)), "3");
  assert.equal(scoreText(side(null)), "");
  assert.match(kickoffTime("2026-11-25T18:05:00Z", "en"), /^\d{2}:\d{2}$/);
  assert.deepEqual(updatedAgo("2026-11-25T18:00:00Z", Date.parse("2026-11-25T18:00:40Z")), { key: "live_updated_now" });
  assert.deepEqual(updatedAgo("2026-11-25T18:00:00Z", Date.parse("2026-11-25T18:03:10Z")), { key: "live_updated_min", n: 3 });
});

test("fresher matches replace their rows by id, in place", () => {
  const data = day([match("m_1", "live", 0, 0), match("m_2", "scheduled")]);
  const changed = mergeLive(data, [
    { ...match("m_1", "live", 1, 0, { minute: 30 }), competition: "c" },
    { ...match("m_9", "live", 2, 2), competition: "x" },
  ]);
  assert.deepEqual([...changed], ["m_1"]);
  assert.equal(data.groups[0].matches[0].home.score, 1);
  assert.equal("competition" in data.groups[0].matches[0], false);
  assert.equal(data.groups[0].matches.length, 2, "a match the day does not list is not added");
  assert.equal(countInPlay(data), 1);
});

test("score changes between two answers for the same day", () => {
  const before = day([match("m_1", "live", 0, 0), match("m_2", "live", 1, 1)]);
  const after = day([match("m_1", "live", 0, 1), match("m_2", "live", 1, 1), match("m_3", "live", 5, 0)]);
  assert.deepEqual([...changedScores(before, after)], ["m_1"]);
  assert.equal(changedScores(before, { ...after, date: "2026-11-26" }).size, 0, "another day is not a change");
});

// A tiny fake clock: timers are collected and run by hand.
function fakeTimers() {
  const pending = new Map();
  let next = 1;
  return {
    pending,
    setTimeout(fn, ms) { pending.set(next, { fn, ms }); return next++; },
    clearTimeout(id) { pending.delete(id); },
  };
}
const settle = () => new Promise((r) => setImmediate(r));

test("the store obeys the server's timing and stops when hidden", async () => {
  const timers = fakeTimers();
  const calls = [];
  const api = {
    fetchDay: async (args) => { calls.push(["day", args.date]); return { ok: true, data: day([match("m_1", "live", 0, 0)], { live: { count: 1, refreshAfterSeconds: 15 } }), meta: { updatedAt: "2026-11-25T18:00:00Z", refreshAfterSeconds: 600, stale: false } }; },
    fetchLive: async () => { calls.push(["live"]); return { ok: true, data: { matches: [{ ...match("m_1", "live", 1, 0), competition: "c" }], ended: [] }, meta: { updatedAt: "2026-11-25T18:00:15Z", refreshAfterSeconds: 15, stale: false } }; },
  };
  const seen = [];
  const store = createDayStore({ api, tz: "UTC", timers, onChange: (state, change) => seen.push([state.status, [...(change.changedScores || [])]]) });

  store.show(null);
  await settle();
  assert.equal(store.state.status, "ready");
  assert.deepEqual([...timers.pending.values()].map((t) => t.ms).sort((a, b) => a - b), [15000, 600000]);

  // The live timer fires: one small request, the score is merged by id.
  [...timers.pending.values()].find((t) => t.ms === 15000).fn();
  await settle();
  assert.deepEqual(calls.at(-1), ["live"]);
  assert.equal(store.state.data.groups[0].matches[0].home.score, 1);
  assert.deepEqual(seen.at(-1), ["ready", ["m_1"]]);

  // Hidden: nothing is scheduled. Visible again: one immediate refresh.
  store.setVisible(false);
  assert.equal(timers.pending.size, 0);
  const before = calls.length;
  store.setVisible(true);
  await settle();
  assert.deepEqual(calls[before], ["day", null]);

  store.stop();
  assert.equal(timers.pending.size, 0);
});

test("a failed first load shows an error and retries; a failed refresh keeps the data", async () => {
  const timers = fakeTimers();
  let ok = false;
  const api = {
    fetchDay: async () => (ok ? { ok: true, data: day([match("m_1", "scheduled")]), meta: { updatedAt: "2026-11-25T18:00:00Z", refreshAfterSeconds: 600, stale: false } } : { ok: false, error: "offline" }),
    fetchLive: async () => ({ ok: false, error: "offline" }),
  };
  const store = createDayStore({ api, tz: "UTC", timers, onChange: () => {} });
  store.show(null);
  await settle();
  assert.equal(store.state.status, "error");
  assert.equal([...timers.pending.values()][0].ms, 5000, "tries again by itself");

  ok = true;
  store.retry();
  await settle();
  assert.equal(store.state.status, "ready");

  ok = false;
  [...timers.pending.values()].find((t) => t.ms === 600000).fn();
  await settle();
  assert.equal(store.state.status, "ready", "the list stays on screen");
  assert.equal(store.state.meta.stale, true, "and is marked as old");
  store.stop();
});

test("kick-off times follow the chosen time zone", () => {
  assert.equal(kickoffTime("2026-11-25T18:05:00Z", "en", "Europe/Paris"), "19:05");
  assert.equal(kickoffTime("2026-11-25T18:05:00Z", "en", "Asia/Yerevan"), "22:05");
  assert.equal(kickoffTime("2026-11-25T18:05:00Z", "fr", "America/New_York"), "13:05");
});
