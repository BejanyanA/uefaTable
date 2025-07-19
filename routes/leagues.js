// routes/leagues.js

import { jsonResponse, parseBody, hashWithSalt } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleLeagues(request, env) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, message: "Unauthorized" }, 401);
  }

  const token = authHeader.split(" ")[1];
  const payload = await verifyToken(token, env.JWT_SECRET);

  if (!payload) {
    return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
  }

const userId = payload.id;
const { bannerId } = await parseBody(request);

// Step 1: Get created leagues
const created = await env.core_data.prepare(`
  SELECT * FROM leagues WHERE banner_id = ? AND created_by_user_id = ?
`).bind(bannerId, userId).all();

// Step 2: Get granted_by_user_ids from league_access
const access = await env.core_data.prepare(`
  SELECT DISTINCT granted_by_user_id FROM league_access WHERE user_id = ?
`).bind(userId).all();

// Step 3: Fetch shared leagues
let sharedLeagues = [];
for (const row of access.results) {
  const shared = await env.core_data.prepare(`
    SELECT * FROM leagues WHERE banner_id = ? AND created_by_user_id = ?
  `).bind(bannerId, row.granted_by_user_id).all();

  sharedLeagues.push(...shared.results);
}

// Step 4: Combine and deduplicate
const leagueMap = new Map();
for (const league of [...created.results, ...sharedLeagues]) {
  leagueMap.set(league.id, league); // avoids duplicates by league ID
}

// Step 5: Respond with combined data
return jsonResponse({
  success: true,
  data: {
    leagues: Array.from(leagueMap.values())
      .sort((a, b) => b.id - a.id)
      .map(({ id, name, banner_id, created_by_user_id, created_at }) => ({
      id,
      name,
      banner_id,
      created_by_user_id,
      created_at
    }))
  }
}, 200);
}