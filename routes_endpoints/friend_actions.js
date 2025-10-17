// routes/get_friends.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleAddFriends(request, env) {
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
    const { userId } = await parseBody(request);
    const targetUserId = Number(userId);
    if (!targetUserId || Number.isNaN(targetUserId)) {
        return jsonResponse({ success: false, message: "invalid_user_id" }, 400);
    }
    if (targetUserId === loggedInUserId) {
        return jsonResponse({ success: false, message: "cannot_add_self" }, 400);
    }

    // 3) Ensure target user exists (and optionally active)
    const target = await env.core_data.prepare(`
    SELECT id, username FROM users WHERE id = ? /* AND is_active = 1 */
  `).bind(targetUserId).first();
    if (!target) {
        return jsonResponse({ success: false, message: "user_not_found" }, 404);
    }

    // 4) Check existing relation in either direction (take the most recent if multiple)
    const existing = await env.core_data.prepare(`
    SELECT id, user_id, friend_id, status, created_at
    FROM (
      SELECT id, user_id, friend_id, status, created_at
      FROM friends
      WHERE user_id = ? AND friend_id = ?
      UNION ALL
      SELECT id, user_id, friend_id, status, created_at
      FROM friends
      WHERE user_id = ? AND friend_id = ?
    )
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).bind(loggedInUserId, targetUserId, targetUserId, loggedInUserId).first();

    // 5) Resolve by status/initiator
    if (existing) {
        if (existing.status === "approved") {
            return jsonResponse({
                success: false,
                message: "already_friends",
                data: {
                    user: { id: target.id, username: target.username, status: "approved" }
                }
            }, 409);
        }

        if (existing.status === "pending") {
            return jsonResponse({
                success: false,
                message: "already_pending",
                data: {
                    user: { id: target.id, username: target.username, status: "pending" }
                }
            }, 409);
        }

        if (existing.status === "rejected") {
            return jsonResponse({
                success: false,
                message: "already_rejected",
                data: {
                    user: { id: target.id, username: target.username, status: "rejected" }
                }
            }, 409);
        }
    }

    // 6) Create new pending request
    const insert = await env.core_data.prepare(`
    INSERT INTO friends (user_id, friend_id, status, created_at)
    VALUES (?, ?, 'pending', datetime('now'))
  `).bind(loggedInUserId, targetUserId).run();

    return jsonResponse({
        success: true,
        data: {
            user: { id: target.id, username: target.username, status: "pending" }
        }
    }, 201);
}

export async function handleApproveFriends(request, env) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token, env.JWT_SECRET);

    if (!payload) {
        return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
    }


}

export async function handleRejectFriend(request, env) {
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

}


export async function handleDeleteFriend(request, env) {
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
    const { userId } = await parseBody(request);
    const targetUserId = Number(userId);
    if (!targetUserId || Number.isNaN(targetUserId)) {
        return jsonResponse({ success: false, message: "invalid_user_id" }, 400);
    }
    if (targetUserId === loggedInUserId) {
        return jsonResponse({ success: false, message: "cannot_delete_self_relation" }, 400);
    }

    // 3) (Optional) ensure target exists
    const target = await env.core_data
        .prepare(`SELECT id, username FROM users WHERE id = ?`)
        .bind(targetUserId)
        .first();
    if (!target) {
        return jsonResponse({ success: false, message: "user_not_found" }, 404);
    }

    // 4) Count existing relations (either direction)
    const countRow = await env.core_data.prepare(`
    SELECT COUNT(*) AS cnt
    FROM friends
    WHERE (user_id = ? AND friend_id = ?)
       OR (user_id = ? AND friend_id = ?)
  `).bind(loggedInUserId, targetUserId, targetUserId, loggedInUserId).first();

    const toDelete = Number(countRow?.cnt || 0);

    // 5) Delete permanently (either direction), regardless of status
    if (toDelete > 0) {
        await env.core_data.prepare(`
      DELETE FROM friends
      WHERE (user_id = ? AND friend_id = ?)
         OR (user_id = ? AND friend_id = ?)
    `).bind(loggedInUserId, targetUserId, targetUserId, loggedInUserId).run();
    }

    // 6) Return idempotent success (OK even if nothing was there)
    return jsonResponse({
        success: true,
        data: {
            message: "user_deleted_success"
        }
    }, 200);
}