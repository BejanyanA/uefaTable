/**
 * Fixed-window rate limiter backed by D1.
 * Returns true if the request should be blocked, false if it should proceed.
 *
 * Requires a `rate_limits` table:
 *   CREATE TABLE IF NOT EXISTS rate_limits (
 *     key TEXT PRIMARY KEY,
 *     count INTEGER NOT NULL DEFAULT 1,
 *     window_start INTEGER NOT NULL
 *   );
 */
export async function isRateLimited(env, key, limit, windowSecs) {
    const now = Math.floor(Date.now() / 1000);

    const row = await env.core_data.prepare(
        `SELECT count, window_start FROM rate_limits WHERE key = ?`
    ).bind(key).first();

    if (!row || (now - row.window_start) >= windowSecs) {
        await env.core_data.prepare(
            `INSERT INTO rate_limits (key, count, window_start)
             VALUES (?, 1, ?)
             ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`
        ).bind(key, now).run();
        return false;
    }

    if (row.count >= limit) return true;

    await env.core_data.prepare(
        `UPDATE rate_limits SET count = count + 1 WHERE key = ?`
    ).bind(key).run();
    return false;
}
