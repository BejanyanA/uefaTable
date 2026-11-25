// State of the day view: which day is shown, its matches, and when to ask
// the API again. No DOM: the view gives it everything from the outside
// (the API functions, timers, storage), so it can run and be tested anywhere.
//
// Timing is not decided here. Every answer from the API says when to ask
// again (meta.refreshAfterSeconds, data.live.refreshAfterSeconds) and the
// store obeys it. While the screen is hidden nothing is requested.

const RETRY_SECONDS = [5, 15, 30, 60];
const SAVED_KEY = "live_day_v1";
const SAVED_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function scoreKey(match) {
  return `${match.home.score}:${match.away.score}:${match.home.penalties}:${match.away.penalties}`;
}

export function createDayStore({ api, tz, onChange, timers = globalThis, storage = null, now = () => Date.now() }) {
  const state = {
    status: "loading",   // "loading" | "ready" | "error"
    requestedDate: null,  // null = today
    data: null,           // the API's day answer
    meta: null,
    error: null,
    refreshing: false,
    switching: false,     // the list on screen is for another day than the one asked for
  };

  let dayTimer = null;
  let liveTimer = null;
  let visible = true;
  let stopped = false;
  let failures = 0;
  let requestId = 0;

  const emit = (change = {}) => onChange(state, change);

  function clearTimers() {
    timers.clearTimeout(dayTimer);
    timers.clearTimeout(liveTimer);
    dayTimer = liveTimer = null;
  }

  // ---- the copy kept on the device, for an instant first paint

  function readSaved(date) {
    if (!storage) return null;
    try {
      const saved = JSON.parse(storage.getItem(SAVED_KEY) || "null");
      if (!saved || saved.tz !== tz || now() - saved.savedAt > SAVED_MAX_AGE_MS) return null;
      // Without a date the viewer wants today: only a copy that was "today"
      // when saved and still is the same calendar day will do.
      if (date ? saved.data.date !== date : saved.data.date !== saved.data.today) return null;
      return saved;
    } catch {
      return null;
    }
  }

  function save() {
    if (!storage || !state.data) return;
    try {
      storage.setItem(SAVED_KEY, JSON.stringify({ tz, savedAt: now(), data: state.data, meta: state.meta }));
    } catch {
      // Storage full or blocked: the view simply starts from a skeleton next time.
    }
  }

  // ---- asking the API

  function schedule() {
    clearTimers();
    if (stopped || !visible || state.status !== "ready") return;
    const daySeconds = state.meta?.refreshAfterSeconds;
    if (Number.isFinite(daySeconds) && daySeconds > 0) {
      dayTimer = timers.setTimeout(() => loadDay({ quiet: true }), daySeconds * 1000);
    }
    const liveSeconds = state.data?.live?.refreshAfterSeconds;
    if (Number.isFinite(liveSeconds) && liveSeconds > 0) {
      liveTimer = timers.setTimeout(loadLive, liveSeconds * 1000);
    }
  }

  async function loadDay({ quiet = false } = {}) {
    const id = ++requestId;
    state.refreshing = true;
    if (!quiet) emit();

    const result = await api.fetchDay({ date: state.requestedDate, tz });
    if (stopped || id !== requestId) return;
    state.refreshing = false;

    if (result.ok) {
      failures = 0;
      const changed = changedScores(state.data, result.data);
      state.status = "ready";
      state.data = result.data;
      state.meta = result.meta;
      state.error = null;
      state.switching = false;
      save();
      emit({ changedScores: changed });
      schedule();
      return;
    }

    state.error = result.error;
    if (state.data && state.status === "ready") {
      // Keep showing what we have; the view marks it as old.
      state.meta = { ...state.meta, stale: true };
      emit();
    } else {
      state.status = "error";
      emit();
    }
    // Try again on our own, with growing pauses, while the screen is visible.
    clearTimers();
    if (!stopped && visible && result.error !== "out_of_range" && result.error !== "bad_request") {
      const wait = RETRY_SECONDS[Math.min(failures, RETRY_SECONDS.length - 1)];
      failures++;
      dayTimer = timers.setTimeout(() => loadDay({ quiet: true }), wait * 1000);
    }
  }

  async function loadLive() {
    const id = requestId;
    const result = await api.fetchLive();
    if (stopped || id !== requestId || state.status !== "ready") return;
    if (result.ok) {
      const changed = mergeLive(state.data, [...result.data.ended, ...result.data.matches]);
      state.meta = { ...state.meta, updatedAt: result.meta.updatedAt, stale: Boolean(result.meta.stale) };
      state.data.live = {
        ...state.data.live,
        count: countInPlay(state.data),
        refreshAfterSeconds: result.meta.refreshAfterSeconds || state.data.live?.refreshAfterSeconds,
      };
      emit({ changedScores: changed, liveOnly: true });
    }
    // On failure keep the scores we have and simply try again next round.
    schedule();
  }

  return {
    state,
    // Show a day ("2026-11-25"), or today when the date is empty.
    show(date) {
      stopped = false;
      state.requestedDate = date || null;
      clearTimers();
      const saved = readSaved(state.requestedDate);
      const wanted = state.requestedDate || state.data?.today;
      if (saved) {
        state.status = "ready";
        state.data = saved.data;
        state.meta = saved.meta;
        state.switching = false;
      } else if (state.data) {
        // A different day: keep the old list on screen (the view dims it)
        // until the new one arrives.
        state.status = "ready";
        state.switching = state.data.date !== wanted;
      } else {
        state.status = "loading";
      }
      state.error = null;
      loadDay();
    },
    retry() {
      failures = 0;
      if (!state.data) state.status = "loading";
      loadDay();
    },
    // The screen was hidden or shown again.
    setVisible(isVisible) {
      if (visible === isVisible) return;
      visible = isVisible;
      if (!visible) clearTimers();
      else if (!stopped) loadDay({ quiet: true });
    },
    stop() {
      stopped = true;
      requestId++;
      clearTimers();
    },
  };
}

// ---- pure helpers (exported for tests)

function eachMatch(data, visit) {
  for (const group of data?.groups || []) {
    for (let i = 0; i < group.matches.length; i++) visit(group.matches[i], group, i);
  }
}

export function countInPlay(data) {
  let n = 0;
  eachMatch(data, (m) => { if (m.phase === "live" || m.phase === "break" || m.phase === "suspended") n++; });
  return n;
}

// Ids of matches whose score differs between two day answers.
export function changedScores(before, after) {
  const changed = new Set();
  if (!before || !after || before.date !== after.date) return changed;
  const old = new Map();
  eachMatch(before, (m) => old.set(m.id, scoreKey(m)));
  eachMatch(after, (m) => { if (old.has(m.id) && old.get(m.id) !== scoreKey(m)) changed.add(m.id); });
  return changed;
}

// Put fresher copies of matches into a day answer, in place and by id.
// Matches the day does not list are ignored. Returns the ids whose score changed.
export function mergeLive(data, fresher) {
  const byId = new Map(fresher.map((m) => [m.id, m]));
  const changed = new Set();
  eachMatch(data, (match, group, index) => {
    const next = byId.get(match.id);
    if (!next) return;
    if (scoreKey(match) !== scoreKey(next)) changed.add(match.id);
    const { competition: _competition, ...row } = next;
    group.matches[index] = row;
  });
  return changed;
}
