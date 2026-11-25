// Stored copies of provider answers, shared by every visitor everywhere.
//
// One row per thing we fetch (a calendar date, the live list, the day's
// request count) in the D1 table `live_cache`. A database row, rather than
// Cloudflare's per-location cache, is what makes "visitors never multiply
// provider calls" true: every location reads the same copy.
//
// A row also says who is refreshing it. Whoever wins `claim` is the only one
// allowed to call the provider for that key until the claim runs out, so two
// requests arriving together make one provider call, not two.

const CLAIM_MS = 25 * 1000;

export async function read(env, key) {
  const row = await env.core_data
    .prepare(`SELECT body, fetched_at AS fetchedAt FROM live_cache WHERE key = ?`)
    .bind(key).first();
  if (!row || !row.body) return null;
  try {
    return { value: JSON.parse(row.body), fetchedAt: Number(row.fetchedAt) };
  } catch {
    return null;
  }
}

// True if this request may refresh the key now.
export async function claim(env, key, now) {
  const until = now + CLAIM_MS;
  const updated = await env.core_data
    .prepare(`UPDATE live_cache SET refreshing_until = ? WHERE key = ? AND refreshing_until < ?`)
    .bind(until, key, now).run();
  if (updated.meta?.changes === 1) return true;
  const inserted = await env.core_data
    .prepare(`INSERT OR IGNORE INTO live_cache (key, body, fetched_at, refreshing_until) VALUES (?, '', 0, ?)`)
    .bind(key, until).run();
  return inserted.meta?.changes === 1;
}

// Store a fresh copy and give the claim back.
export async function write(env, key, value, now) {
  await env.core_data
    .prepare(
      `INSERT INTO live_cache (key, body, fetched_at, refreshing_until) VALUES (?, ?, ?, 0)
       ON CONFLICT(key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at, refreshing_until = 0`
    )
    .bind(key, JSON.stringify(value), now).run();
}

// Change a stored copy without making it look newer than it is.
export async function patch(env, key, change) {
  const current = await read(env, key);
  if (!current) return;
  const next = change(current.value);
  if (next === undefined) return;
  await env.core_data
    .prepare(`UPDATE live_cache SET body = ? WHERE key = ?`)
    .bind(JSON.stringify(next), key).run();
}

// After a failed refresh: let someone try again soon instead of holding the
// claim for its full length.
export async function release(env, key, retryAt) {
  await env.core_data
    .prepare(`UPDATE live_cache SET refreshing_until = ? WHERE key = ?`)
    .bind(retryAt, key).run();
}
