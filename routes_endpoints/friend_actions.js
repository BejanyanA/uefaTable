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

    const loggedInUserId = payload.id;

    // 2) Input validation
    const { userId } = await parseBody(request);
    const senderUserId = Number(userId);

    if (!senderUserId || Number.isNaN(senderUserId)) {
        return jsonResponse({ success: false, message: "invalid_user_id" }, 400);
    }
    if (senderUserId === loggedInUserId) {
        return jsonResponse({ success: false, message: "cannot_approve_self" }, 400);
    }

    // 3) Ensure sender exists
    const sender = await env.core_data
        .prepare(`SELECT id, username FROM users WHERE id = ?`)
        .bind(senderUserId)
        .first();
    if (!sender) {
        return jsonResponse({ success: false, message: "user_not_found" }, 404);
    }

    // 4) Find pending friend request from sender → you
    const pending = await env.core_data.prepare(`
    SELECT id, status
    FROM friends
    WHERE user_id = ? AND friend_id = ?
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).bind(senderUserId, loggedInUserId).first();

    if (!pending) {
        return jsonResponse({
            success: false,
            message: "no_pending_request_found"
        }, 404);
    }

    if (pending.status !== "pending") {
        return jsonResponse({
            success: false,
            message: `cannot_approve_status_${pending.status}`
        }, 409);
    }

    // 5) Approve the request
    await env.core_data.prepare(`
    UPDATE friends
    SET status = 'approved'
    WHERE id = ?
  `).bind(pending.id).run();

    // 6) Response
    return jsonResponse({
        success: true,
        data: {
            message: "user_approved_success"
        }
    }, 200);
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

    const loggedInUserId = payload.id;

    // 2) Input
    const { userId } = await parseBody(request);
    const targetUserId = Number(userId);

    if (!targetUserId || Number.isNaN(targetUserId)) {
        return jsonResponse({ success: false, message: "invalid_user_id" }, 400);
    }
    if (targetUserId === loggedInUserId) {
        return jsonResponse({ success: false, message: "cannot_reject_self" }, 400);
    }

    // 3) Check if target exists
    const target = await env.core_data
        .prepare(`SELECT id, username FROM users WHERE id = ?`)
        .bind(targetUserId)
        .first();

    if (!target) {
        return jsonResponse({ success: false, message: "user_not_found" }, 404);
    }

    // 4) Find existing relation (either direction)
    const relation = await env.core_data.prepare(`
    SELECT id, user_id, friend_id, status
    FROM friends
    WHERE (user_id = ? AND friend_id = ?)
       OR (user_id = ? AND friend_id = ?)
    ORDER BY datetime(created_at) DESC
    LIMIT 1
  `).bind(loggedInUserId, targetUserId, targetUserId, loggedInUserId).first();

    if (!relation) {
        return jsonResponse({
            success: false,
            message: "no_relation_found"
        }, 404);
    }

    if (relation.status === "rejected") {
        return jsonResponse({
            success: false,
            message: "already_rejected"
        }, 409);
    }

    // 5) Reject any existing relation (pending / approved / blocked / etc.)
    await env.core_data.prepare(`
    UPDATE friends
    SET status = 'rejected'
    WHERE id = ?
  `).bind(relation.id).run();

    // 6) Return consistent response
    return jsonResponse({
        success: true,
        data: {
            message: "user_rejected_success"
        }
    }, 200);
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