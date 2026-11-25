// The website's match details rules that a mobile app follows too: the
// refresh timing the store obeys, and how values read.
import test from "node:test";
import assert from "node:assert/strict";
import { eventMinute, kickoffDateTime, localDate, statShares, statText } from "../../public/js/live/format.js";
import { createMatchStore } from "../../public/js/live/matchStore.js";

// Timers the test moves by hand.
function fakeTimers() {
  let next = 1;
  const pending = new Map();
  return {
    setTimeout(fn, ms) { const id = next++; pending.set(id, { fn, ms }); return id; },
    clearTimeout(id) { pending.delete(id); },
    waits: () => [...pending.values()].map((p) => p.ms),
    async fire() { const all = [...pending.values()]; pending.clear(); for (const p of all) await p.fn(); },
  };
}

const answer = (refreshAfterSeconds, extra = {}) => ({
  ok: true,
  data: { match: { id: "m_1", phase: "live" }, ...extra },
  meta: { updatedAt: "2026-11-26T12:00:00Z", refreshAfterSeconds, stale: false },
});
const flush = () => new Promise((r) => setTimeout(r, 0));

test("the store asks again exactly when the API says", async () => {
  const timers = fakeTimers();
  const calls = [];
  const store = createMatchStore({ api: { fetchMatch: async (id) => { calls.push(id); return answer(15); } }, id: "m_1", onChange: () => {}, timers });
  store.start();
  await flush();
  assert.equal(store.state.status, "ready");
  assert.deepEqual(calls, ["m_1"]);
  assert.deepEqual(timers.waits(), [15000]);
  store.stop();
  assert.deepEqual(timers.waits(), [], "nothing runs after the screen closes");
});

test("a match that is over is not asked about again", async () => {
  const timers = fakeTimers();
  const store = createMatchStore({ api: { fetchMatch: async () => answer(null) }, id: "m_1", onChange: () => {}, timers });
  store.start();
  await flush();
  assert.deepEqual(timers.waits(), []);
});

test("an unknown match is final; a failure is tried again with growing pauses", async () => {
  const timers = fakeTimers();
  const missing = createMatchStore({ api: { fetchMatch: async () => ({ ok: false, error: "not_found" }) }, id: "m_x", onChange: () => {}, timers });
  missing.start();
  await flush();
  assert.equal(missing.state.status, "missing");
  assert.deepEqual(timers.waits(), []);

  const retry = fakeTimers();
  const failing = createMatchStore({ api: { fetchMatch: async () => ({ ok: false, error: "offline" }) }, id: "m_1", onChange: () => {}, timers: retry });
  failing.start();
  await flush();
  assert.equal(failing.state.status, "error");
  assert.deepEqual(retry.waits(), [5000]);
  await retry.fire();
  assert.deepEqual(retry.waits(), [15000]);
  failing.stop();
});

test("while hidden nothing is asked; shown again, one request at once", async () => {
  const timers = fakeTimers();
  let calls = 0;
  const store = createMatchStore({ api: { fetchMatch: async () => { calls++; return answer(15); } }, id: "m_1", onChange: () => {}, timers });
  store.start();
  await flush();
  store.setVisible(false);
  assert.deepEqual(timers.waits(), []);
  store.setVisible(true);
  await flush();
  assert.equal(calls, 2);
  store.stop();
});

test("event minutes and statistics as text", () => {
  assert.equal(eventMinute({ minute: 67, addedTime: null }), "67'");
  assert.equal(eventMinute({ minute: 90, addedTime: 2 }), "90+2'");
  assert.equal(eventMinute({ minute: null }), "");
  assert.equal(statText({ format: "percent", home: 35, away: 65 }, "home", "en"), "35%");
  assert.equal(statText({ format: "decimal", home: 2.15, away: 1.2 }, "away", "en"), "1.20");
  assert.equal(statText({ format: "count", home: 754, away: 1 }, "home", "en"), "754");
  assert.deepEqual(statShares({ home: 3, away: 1 }), { home: 0.75, away: 0.25 });
  assert.deepEqual(statShares({ home: 0, away: 0 }), { home: 0, away: 0 });
});

test("kick-off date and time in the viewer's own time zone", () => {
  assert.equal(localDate("2026-11-25T23:30:00Z", "Asia/Yerevan"), "2026-11-26");
  assert.equal(localDate("2026-11-25T23:30:00Z", "UTC"), "2026-11-25");
  assert.match(kickoffDateTime("2026-11-25T20:00:00Z", "en", "UTC"), /25 November, 20:00$/);
});
