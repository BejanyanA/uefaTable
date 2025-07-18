// routes/me.js

import { jsonResponse } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export async function handleMe(request, env) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ success: false, message: "Unauthorized" }, 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = await verifyToken(token, env.JWT_SECRET);

    if (!payload) {
      return jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
    }

    return jsonResponse({ success: true, user: payload }, 200);
  } catch (err) {
    console.error("Token verification failed:", err);
    return jsonResponse({ success: false, message: "Invalid token" }, 401);
  }
}