// routes/my-conversations.js
import { verifyToken } from "../utils/jwt.js";

export async function handleMyConversations(request, env) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const user = await verifyToken(token, env.JWT_SECRET);

  if (!user?.id) {
    return Response.json(
      { success: false, message: "Invalid token" },
      { status: 401 }
    );
  }

  const userId = Number(user.id);

  const conversations = await env.core_data.prepare(`
    SELECT
      c.id AS conversationId,
      u.id AS friendId,
      u.username AS friendUsername
    FROM conversations c
    JOIN users u
      ON u.id = CASE
          WHEN c.user1_id = ? THEN c.user2_id
          ELSE c.user1_id
      END
    WHERE c.user1_id = ?
       OR c.user2_id = ?
    ORDER BY c.id DESC
  `)
  .bind(userId, userId, userId)
  .all();

  return Response.json({
    success: true,
    conversations: conversations.results || []
  });
}