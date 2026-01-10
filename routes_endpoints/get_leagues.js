import { jsonResponse } from '../utils/helper.js';

export async function handleGetAllLeaguelogos(request, env) {

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