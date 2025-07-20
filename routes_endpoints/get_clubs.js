// routes/leagues.js

import { jsonResponse } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleGetAllClubs(request, env) {
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

    const allClubs = await env.core_data.prepare(`
    SELECT * FROM all_clubs
`).bind().all();

    if (allClubs.results.length === 0) {
        return jsonResponse({ success: false, message: "no_clubs_found" }, 404);
    }

    return jsonResponse({
        success: true,
        data: {
            clubs: allClubs.results
        }
    }, 200);
}