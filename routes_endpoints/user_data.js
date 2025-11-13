// routes/get_friends.js

import { jsonResponse, parseBody, hashWithSalt } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleGetUserDetails(request, env) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token, env.JWT_SECRET);

    if (!payload) {
        return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
    }

    const loggedInUserId = payload.id;

    // 2) Query the users table
    const user = await env.core_data
        .prepare(`
      SELECT 
        id,
        username,
        email,
        created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `)
        .bind(loggedInUserId)
        .first();

    // 3) Handle not found
    if (!user) {
        return jsonResponse({ success: false, message: "user_not_found" }, 404);
    }

    // 4) Success response
    return jsonResponse({
        success: true,
        data: {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                created_at: user.created_at,
                updated_at: user.updated_at
            }
        }
    }, 200);
}

export async function handleUpdateUserDetails(request, env) {
    try {
        // 1️⃣ Auth check
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return jsonResponse({ success: false, message: "Unauthorized" }, 401);
        }
        const token = authHeader.split(" ")[1];
        const payload = await verifyToken(token, env.JWT_SECRET);
        if (!payload) {
            return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
        }

        const loggedInUserId = payload.id;

        // 2️⃣ Parse JSON body
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ success: false, message: "invalid_json" }, 400);
        }

        const hasUsername = "username" in body;
        const hasEmail = "email" in body;
        const hasPasswordChange = "currentPassword" in body && "newPassword" in body;

        if (!hasUsername && !hasEmail && !hasPasswordChange) {
            return jsonResponse({ success: false, message: "no_fields_to_update" }, 400);
        }

        const username = hasUsername ? (body.username ?? "") : undefined;
        const email = hasEmail ? (body.email ?? "") : undefined;
        const currentPassword = hasPasswordChange ? (body.currentPassword ?? "") : undefined;
        const newPassword = hasPasswordChange ? (body.newPassword ?? "") : undefined;

        // 3️⃣ Validations (same as registration)
        const errors = {};

        if (hasUsername) {
            if (!username) errors.username = "Username is required";
            else if (username.length > 10)
                errors.username = "Username must not exceed 10 characters";
        }

        if (hasEmail) {
            if (!email) errors.email = "Email is required";
        }

        if (hasPasswordChange) {
            if (!currentPassword) errors.currentPassword = "Current password is required";
            if (!newPassword) errors.newPassword = "New password is required";
            else if (newPassword.length > 30)
                errors.newPassword = "Password must not exceed 30 characters";
            else if (currentPassword === newPassword)
                errors.newPassword = "New password must be different from current password";
        }

        if (Object.keys(errors).length > 0) {
            return jsonResponse({ success: false, errors }, 400);
        }

        // 4️⃣ Uniqueness checks
        if (hasEmail) {
            const existingEmail = await env.core_data
                .prepare(`SELECT id FROM users WHERE email = ? AND id != ?`)
                .bind(email, loggedInUserId)
                .first();
            if (existingEmail) {
                return jsonResponse(
                    { success: false, errors: { email: "email_exists" } },
                    409
                );
            }
        }

        if (hasUsername) {
            const existingUsername = await env.core_data
                .prepare(`SELECT id FROM users WHERE username = ? AND id != ?`)
                .bind(username, loggedInUserId)
                .first();
            if (existingUsername) {
                return jsonResponse(
                    { success: false, errors: { username: "username_exists" } },
                    409
                );
            }
        }

        // 5️⃣ Helper for hashing
        async function hashWithSalt(pw, saltHex) {
            const enc = new TextEncoder();
            const data = enc.encode(pw + saltHex);
            const buf = await crypto.subtle.digest("SHA-256", data);
            const hashArray = Array.from(new Uint8Array(buf));
            return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        }

        // 6️⃣ Build dynamic UPDATE
        const sets = [];
        const binds = [];

        if (hasUsername) {
            sets.push(`username = ?`);
            binds.push(username.trim());
        }

        if (hasEmail) {
            sets.push(`email = ?`);
            binds.push(email.trim());
        }

        // 7️⃣ Handle password change
        if (hasPasswordChange) {
            // Fetch user's current password hash + salt
            const user = await env.core_data
                .prepare(`SELECT password_hash, salt FROM users WHERE id = ?`)
                .bind(loggedInUserId)
                .first();

            if (!user) {
                return jsonResponse({ success: false, message: "user_not_found" }, 404);
            }

            // Verify current password
            const currentHash = await hashWithSalt(currentPassword, user.salt);
            if (currentHash !== user.password_hash) {
                return jsonResponse(
                    { success: false, errors: { currentPassword: "invalid_current_password" } },
                    400
                );
            }

            // Hash new password with new salt
            const newSaltArray = crypto.getRandomValues(new Uint8Array(16));
            const newSalt = Array.from(newSaltArray)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            const newPasswordHash = await hashWithSalt(newPassword, newSalt);

            sets.push(`password_hash = ?`);
            binds.push(newPasswordHash);
            sets.push(`salt = ?`);
            binds.push(newSalt);
        }

        // 8️⃣ Add updated_at if exists
        if (sets.length > 0 && await columnExists(env, "users", "updated_at")) {
            sets.push(`updated_at = CURRENT_TIMESTAMP`);
        }

        // 9️⃣ Execute update
        if (sets.length > 0) {
            const sql = `UPDATE users SET ${sets.join(", ")} WHERE id = ?`;
            binds.push(loggedInUserId);
            await env.core_data.prepare(sql).bind(...binds).run();
        }

        // 🔟 Return fresh data
        const updatedUser = await env.core_data
            .prepare(`SELECT id, username, email, created_at, updated_at FROM users WHERE id = ?`)
            .bind(loggedInUserId)
            .first();

        return jsonResponse({
            success: true,
            data: {
                user: {
                    id: updatedUser.id,
                    username: updatedUser.username,
                    email: updatedUser.email,
                    created_at: updatedUser.created_at,
                    updated_at: updatedUser.updated_at ?? null,
                },
            },
        }, 200);
    } catch (err) {
        console.error("Update user error:", err);
        return jsonResponse({ success: false, message: "update_failed" }, 500);
    }
}

// Helper — checks if column exists (safe for older DBs)
async function columnExists(env, table, column) {
    const res = await env.core_data.prepare(
        `PRAGMA table_info(${table})`
    ).all();
    return res.results.some((r) => r.name === column);
}

export async function handleAchievements(request, env) {
    // --- Auth (your exact pattern) ---
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }
    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token, env.JWT_SECRET);
    if (!payload) {
        return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
    }
    const loggedInUserId = payload.id;

    // Optional self-only userId (forbid others)
    const url = new URL(request.url);
    const rawUserId = url.searchParams.get("userId");
    let targetUserId = loggedInUserId;
    if (rawUserId != null) {
        if (!/^\d+$/.test(rawUserId)) {
            return jsonResponse({ success: false, message: "invalid_user_id" }, 400);
        }
        targetUserId = Number(rawUserId);
        if (targetUserId !== loggedInUserId) {
            return jsonResponse({ success: false, message: "forbidden" }, 403);
        }
    }

    const sql = `
WITH finals AS (
  /* club: league_knockouts */
  SELECT 'league_knockouts' AS src,
         lk.league_id,
         lk.winner_team_id,
         CASE
           WHEN lk.team1_user_id = ? THEN lk.team1_id
           WHEN lk.team2_user_id = ? THEN lk.team2_id
         END AS my_team_id
  FROM league_knockouts lk
  WHERE lk.winner_team_id IS NOT NULL
    AND LOWER(TRIM(lk.round)) IN ('final','finals')
    AND (lk.team1_user_id = ? OR lk.team2_user_id = ?)

  UNION ALL

  /* national: national_knockouts */
  SELECT 'national_knockouts' AS src,
         nk.league_id,
         nk.winner_team_id,
         CASE
           WHEN nk.team1_user_id = ? THEN nk.team1_id
           WHEN nk.team2_user_id = ? THEN nk.team2_id
         END AS my_team_id
  FROM national_knockouts nk
  WHERE nk.winner_team_id IS NOT NULL
    AND LOWER(TRIM(nk.round)) IN ('final','finals')
    AND (nk.team1_user_id = ? OR nk.team2_user_id = ?)

  UNION ALL

  /* club (round-only): round_knockouts */
  SELECT 'round_knockouts' AS src,
         rk.league_id,
         rk.winner_team_id,
         CASE
           WHEN rk.team1_user_id = ? THEN rk.team1_id
           WHEN rk.team2_user_id = ? THEN rk.team2_id
         END AS my_team_id
  FROM round_knockouts rk
  WHERE rk.winner_team_id IS NOT NULL
    AND LOWER(TRIM(rk.round)) IN ('final','finals')
    AND (rk.team1_user_id = ? OR rk.team2_user_id = ?)

  UNION ALL

  /* national (round-only): national_round_knockouts */
  SELECT 'national_round_knockouts' AS src,
         nrk.league_id,
         nrk.winner_team_id,
         CASE
           WHEN nrk.team1_user_id = ? THEN nrk.team1_id
           WHEN nrk.team2_user_id = ? THEN nrk.team2_id
         END AS my_team_id
  FROM national_round_knockouts nrk
  WHERE nrk.winner_team_id IS NOT NULL
    AND LOWER(TRIM(nrk.round)) IN ('final','finals')
    AND (nrk.team1_user_id = ? OR nrk.team2_user_id = ?)
)
SELECT
  l.id               AS league_id,
  l.name             AS league_name,
  l.banner_id,
  l.created_by_user_id,
  l.created_at,
  f.winner_team_id   AS team_id,

  /* pick correct catalog based on banner_id; use real column names */
  COALESCE(c.club_name, cn.country_name) AS team_name,

  /* OPTIONAL: expose crest/flag if you want */
  COALESCE(c.logo_url, cn.logo_url)      AS team_logo_url

FROM finals f
JOIN leagues l ON l.id = f.league_id

/* clubs when banner_id in (1,2) */
LEFT JOIN all_clubs c
  ON c.id = f.winner_team_id
 AND l.banner_id IN (1, 2)

/* countries when banner_id in (3,4) */
LEFT JOIN all_countries cn
  ON cn.id = f.winner_team_id
 AND l.banner_id IN (3, 4)

WHERE f.my_team_id IS NOT NULL
  AND f.winner_team_id = f.my_team_id
ORDER BY l.created_at DESC;
`;

    const u = targetUserId;
    const binds = [u, u, u, u, u, u, u, u, u, u, u, u, u, u, u, u];

    try {
        const res = await env.core_data.prepare(sql).bind(...binds).all();
        const achievements = res?.results || [];

        if (!achievements.length) {
            return jsonResponse({ success: false, message: "no_achievements_found" }, 404);
        }

        return jsonResponse({ success: true, data: { achievements } }, 200);
    } catch (err) {
        // console.error("handleAchievements error:", err);
        return jsonResponse({ success: false, message: "internal_error" }, 500);
    }
}                         