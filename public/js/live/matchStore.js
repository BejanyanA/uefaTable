// State of the match details screen: one match, and when to ask the API
// again. No DOM: the view gives it everything from the outside (the API
// functions, timers), so it can run and be tested anywhere.
//
// Timing is not decided here. Every answer says when to ask again
// (meta.refreshAfterSeconds; null when the match is over) and the store
// obeys it. While the screen is hidden nothing is requested.

const RETRY_SECONDS = [5, 15, 30, 60];
// An answer marked as old means the server is fetching a newer one right
// now: ask again shortly, a couple of times.
const STALE_RECHECK_SECONDS = 4;
const STALE_RECHECKS = 2;

export function createMatchStore({ api, id, onChange, timers = globalThis }) {
  const state = {
    status: "loading",  // "loading" | "ready" | "missing" | "error"
    data: null,         // the API's match details answer
    meta: null,
    error: null,
  };

  let timer = null;
  let visible = true;
  let stopped = false;
  let failures = 0;
  let staleChecks = 0;
  let requestId = 0;

  const emit = () => onChange(state);

  function clear() {
    timers.clearTimeout(timer);
    timer = null;
  }

  function schedule() {
    clear();
    if (stopped || !visible || state.status !== "ready") return;
    let seconds = state.meta?.refreshAfterSeconds;
    if (state.meta?.stale && staleChecks < STALE_RECHECKS) {
      staleChecks++;
      seconds = STALE_RECHECK_SECONDS;
    } else if (!state.meta?.stale) {
      staleChecks = 0;
    }
    if (Number.isFinite(seconds) && seconds > 0) timer = timers.setTimeout(load, seconds * 1000);
  }

  async function load() {
    const ask = ++requestId;
    const result = await api.fetchMatch(id);
    if (stopped || ask !== requestId) return;

    if (result.ok) {
      failures = 0;
      state.status = "ready";
      state.data = result.data;
      state.meta = result.meta;
      state.error = null;
      emit();
      schedule();
      return;
    }

    state.error = result.error;
    if (result.error === "not_found") {
      state.status = "missing";
      emit();
      return;
    }
    if (state.status === "ready") {
      // Keep showing what we have, marked as old.
      state.meta = { ...state.meta, stale: true };
    } else {
      state.status = "error";
    }
    emit();
    clear();
    if (!stopped && visible) {
      const wait = RETRY_SECONDS[Math.min(failures, RETRY_SECONDS.length - 1)];
      failures++;
      timer = timers.setTimeout(load, wait * 1000);
    }
  }

  return {
    state,
    start() {
      stopped = false;
      emit();
      load();
    },
    retry() {
      state.status = "loading";
      emit();
      load();
    },
    // The screen was hidden or shown again: pause, or catch up at once.
    setVisible(isVisible) {
      if (visible === isVisible) return;
      visible = isVisible;
      if (!visible) clear();
      else if (!stopped && state.status !== "missing" && state.meta?.refreshAfterSeconds !== null) load();
    },
    stop() {
      stopped = true;
      requestId++;
      clear();
    },
  };
}
