// routes/get_friends.js

import { jsonResponse, parseBody } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleUserDetails(request, env) {
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
