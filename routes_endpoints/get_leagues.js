import { jsonResponse } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleGetAllLeaguelogos(request, env) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const token = authHeader.split(" ")[1];
    const payload = await verifyToken(token, env.JWT_SECRET);

    if (!payload) {
        return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
    }

    const allLeagues = await env.core_data.prepare(`
    SELECT * FROM all_leagues
`).bind().all();

    if (allLeagues.results.length === 0) {
        return jsonResponse({ success: false, message: "no_leagues_found" }, 404);
    }

    return jsonResponse({
        success: true,
        data: {
            clubs: allLeagues.results
        }
    }, 200);
}