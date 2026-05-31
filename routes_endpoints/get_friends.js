// routes/get_friends.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleGetApprovedFriends(request, env) {
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
    const { leagueId } = await parseBody(request);

    const friends = await env.core_data.prepare(`
    SELECT u.id, u.username
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 'approved'

    UNION

    SELECT u.id, u.username
    FROM friends f
    JOIN users u ON u.id = f.user_id
    WHERE f.friend_id = ? AND f.status = 'approved';
  `).bind(loggedInUserId, loggedInUserId).all();

    if (friends.results.length === 0) {
        return jsonResponse({ success: false, message: "no_friends_found" }, 404);
    }

    let accessUserIds = [];

    if (leagueId) {
        const accessRows = await env.core_data.prepare(`
            SELECT DISTINCT u.id, u.username
            FROM league_access la
            JOIN users u ON u.id = la.user_id

            WHERE la.league_id = ?
            AND EXISTS (
                SELECT 1
                FROM friends f
                WHERE (
                    (f.user_id = ? AND f.friend_id = u.id)
                    OR
                    (f.friend_id = ? AND f.user_id = u.id)
                    )
                AND f.status = 'approved'
                    )
                `)
            .bind(leagueId, loggedInUserId, loggedInUserId)
            .all();

        accessUserIds = accessRows.results;
    }

    return jsonResponse({
        success: true,
        data: {
            friends: friends.results,
            accessUserIds
        }
    }, 200);
}

export async function handleGetAllFriendsStatuses(request, env) {
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

    // We include an extra derived column `byMe`
    const friends = await env.core_data.prepare(`
    SELECT
    u.id,
    u.username,
    f.status,
    CASE
        WHEN f.rejected_by_user_id = ? THEN 1
        ELSE 0
    END AS byMe
    FROM friends f
    JOIN users u ON u.id =
    CASE
        WHEN f.user_id = ? THEN f.friend_id
        ELSE f.user_id
    END
    WHERE f.user_id = ? OR f.friend_id = ?
  `).bind(loggedInUserId, loggedInUserId, loggedInUserId, loggedInUserId).all();

    if (friends.results.length === 0) {
        return jsonResponse({ success: false, message: "no_friends_found" }, 404);
    }

    // Optional: normalize the boolean in JS (0/1 → true/false)
    const result = friends.results.map(f => ({
        id: f.id,
        username: f.username,
        status: f.status,
        byMe: !!f.byMe
    }));

    return jsonResponse({
        success: true,
        data: { friends: result }
    }, 200);
}

export async function handleSearchFriendByUsername(request, env) {
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

    // 2) Input
    const { username } = await parseBody(request);
    if (typeof username !== "string" || username.trim().length === 0) {
        return jsonResponse({ success: false, message: "invalid_username" }, 400);
    }
    const uname = username.trim();

    // 3) Find the user by username (case-insensitive, exact match)
    const candidate = await env.core_data.prepare(`
    SELECT id, username, email
    FROM users
    WHERE LOWER(username) = LOWER(?)
    LIMIT 1
  `).bind(uname).first();

    if (!candidate) {
        return jsonResponse({ success: false, message: "user_not_found" }, 404);
    }

    // 4) Cannot friend yourself
    if (candidate.id === loggedInUserId) {
        return jsonResponse({
            success: true,
            data: {
                user: { id: candidate.id, username: candidate.username, email: candidate.email },
                relation_status: "self"  // or return 400 if you prefer
            }
        }, 200);
    }

    // 5) Look for a relationship in either direction.
    // If there are (unexpectedly) multiple rows, take the most recent.
    const relation = await env.core_data.prepare(`
    SELECT status
    FROM (
      SELECT status, created_at
      FROM friends
      WHERE user_id = ? AND friend_id = ?
      UNION ALL
      SELECT status, created_at
      FROM friends
      WHERE user_id = ? AND friend_id = ?
    ) r
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).bind(loggedInUserId, candidate.id, candidate.id, loggedInUserId).first();

    const relationStatus = relation?.status || "available";

    return jsonResponse({
        success: true,
        data: {
            user: {
                id: candidate.id,
                username: candidate.username,
                status: relationStatus  // e.g. "available" | "pending" | "approved" | "rejected" |
            }
        }
    }, 200);
}