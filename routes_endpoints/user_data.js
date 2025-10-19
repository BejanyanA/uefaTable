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
        // 1) Auth
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

        // 2) Parse JSON body (defensive)
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ success: false, message: "invalid_json" }, 400);
        }
        const hasUsername = Object.prototype.hasOwnProperty.call(body, "username");
        const hasEmail = Object.prototype.hasOwnProperty.call(body, "email");
        const hasPassword = Object.prototype.hasOwnProperty.call(body, "password");

        if (!hasUsername && !hasEmail && !hasPassword) {
            return jsonResponse({ success: false, message: "no_fields_to_update" }, 400);
        }

        const username = hasUsername ? (body.username ?? "") : undefined;
        const email = hasEmail ? (body.email ?? "") : undefined;
        const password = hasPassword ? (body.password ?? "") : undefined;

        // 3) Validations (same rules as registration, but only for provided fields)
        const errors = {};
        if (hasUsername) {
            if (!username) errors.username = "Username is required";
            else if (username.length > 15) errors.username = "Username must not exceed 15 characters";
        }
        if (hasEmail) {
            if (!email) errors.email = "Email is required";
            // keep same behavior as registration (no format regex), add if you want
        }
        if (hasPassword) {
            if (!password) errors.password = "Password is required";
            else if (password.length > 30) errors.password = "Password must not exceed 30 characters";
        }
        if (Object.keys(errors).length > 0) {
            return jsonResponse({ success: false, errors }, 400);
        }

        // 4) Uniqueness (exclude self)
        if (hasEmail) {
            const existingEmail = await env.core_data
                .prepare(`SELECT id FROM users WHERE email = ? AND id != ?`)
                .bind(email, loggedInUserId)
                .first();
            if (existingEmail) {
                return jsonResponse({ success: false, errors: { email: "email_exists" } }, 409);
            }
        }
        if (hasUsername) {
            const existingUsername = await env.core_data
                .prepare(`SELECT id FROM users WHERE username = ? AND id != ?`)
                .bind(username, loggedInUserId)
                .first();
            if (existingUsername) {
                return jsonResponse({ success: false, errors: { username: "username_exists" } }, 409);
            }
        }

        // 5) Helper: hashWithSalt (in case it wasn't imported)
        async function hashWithSalt(pw, saltHex) {
            const enc = new TextEncoder();
            const data = enc.encode(pw + saltHex);
            const buf = await crypto.subtle.digest("SHA-256", data);
            const hashArray = Array.from(new Uint8Array(buf));
            return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        }

        // 6) Build dynamic UPDATE
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
        if (hasPassword) {
            const saltArray = crypto.getRandomValues(new Uint8Array(16));
            const salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, "0")).join("");
            const password_hash = await hashWithSalt(password, salt);
            sets.push(`password_hash = ?`);
            binds.push(password_hash);
            sets.push(`salt = ?`);
            binds.push(salt);
        }
        // Ensure we’re not executing an empty SET (shouldn’t happen due to earlier check)
        sets.push(`updated_at = CURRENT_TIMESTAMP`);

        const sql = `UPDATE users SET ${sets.join(", ")} WHERE id = ?`;
        binds.push(loggedInUserId);

        const res = await env.core_data.prepare(sql).bind(...binds).run();
        if (res.rowsAffected === 0) {
            return jsonResponse({ success: false, message: "user_not_found" }, 404);
        }

        // 7) Return fresh record
        const user = await env.core_data
            .prepare(`SELECT id, username, email, created_at, updated_at FROM users WHERE id = ?`)
            .bind(loggedInUserId)
            .first();

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

    } catch (err) {
        // Last-chance guard with minimal leak
        // Optionally log more details to a private logger here
        return jsonResponse({ success: false, message: "update_failed" }, 500);
    }
}