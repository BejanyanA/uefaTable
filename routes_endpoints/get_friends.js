// routes/leagues.js

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

    return jsonResponse({
        success: true,
        data: {
            friends: friends.results
        }
    }, 200);
}