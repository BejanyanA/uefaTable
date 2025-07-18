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

  const { bannerId, password } = await parseBody(request);
  // const errors = {};
  // if (!bannerId) errors.bannerId = "BannerId is required";
  // if (!password) errors.password = "Password is required";

  // if (Object.keys(errors).length > 0) {
  //   return jsonResponse({ success: false, errors }, 400);
  // }

  // const league = await env.core_data.prepare(`
  //   SELECT * FROM leagues
  //   WHERE banner_id = ? AND access_password = ? AND created_by_user_id = ?
  // `).bind(bannerId, password, userId).first();

  // if (!league || (await hashWithSalt(password, league.salt)) !== league.password_hash) {
  //   return jsonResponse({ success: false, message: "invalid_leauge_password" }, 400);
  // }

  const leagues = await env.core_data.prepare(`
    SELECT * FROM leagues
    WHERE created_by_user_id = ? AND banner_id = ?;
  `).bind(userId, bannerId).all();

  return jsonResponse({
    success: true,
    data: {
      leagues: leagues.results.map(({ id, name, banner_id, created_by_user_id, created_at }) => ({
        id,
        name,
        banner_id,
        created_by_user_id,
        created_at
      }))
    }
  }, 200);
}