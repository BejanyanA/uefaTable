// routes/get_clubs.js

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

// Search Clubs
export async function handleSearchClubs(request, env) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token, env.JWT_SECRET);

    if (!payload) {
        return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
    }

    const { search } = await request.json();

    if (!search || typeof search !== 'string' || search.trim().length === 0) {
        return jsonResponse({ success: false, message: "Invalid search input" }, 400);
    }

    const searchResult = await env.core_data.prepare(`
  SELECT id, club_name
  FROM all_clubs
  WHERE LOWER(club_name) LIKE '%' || LOWER(?) || '%'
`).bind(search).all();

    if (searchResult.results.length === 0) {
        return jsonResponse({ success: false, message: "no_clubs_found" }, 404);
    }

    return jsonResponse({
        success: true,
        data: {
            clubs: searchResult.results
                .sort((a, b) => b.id - a.id)
                .map(({ id, club_name }) => ({
                    id,
                    club_name
                }))
        }
    }, 200);
}