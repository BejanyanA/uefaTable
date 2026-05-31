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
    u.username AS friendUsername,
    f.status AS friendshipStatus,

    (
      SELECT encrypted_message
      FROM messages m2
      WHERE m2.conversation_id = c.id
      ORDER BY m2.created_at DESC, m2.id DESC
      LIMIT 1
    ) AS lastMessage,

    (
      SELECT created_at
      FROM messages m3
      WHERE m3.conversation_id = c.id
      ORDER BY m3.created_at DESC, m3.id DESC
      LIMIT 1
    ) AS lastMessageAt,

    (
      SELECT COUNT(*)
      FROM messages m4
      WHERE m4.conversation_id = c.id
        AND m4.sender_id != ?
        AND m4.is_read = 0
    ) AS unreadCount

  FROM conversations c
  JOIN users u
    ON u.id = CASE
      WHEN c.user1_id = ? THEN c.user2_id
      ELSE c.user1_id
    END
  LEFT JOIN friends f
    ON (
      (f.user_id = c.user1_id AND f.friend_id = c.user2_id)
      OR
      (f.user_id = c.user2_id AND f.friend_id = c.user1_id)
    )
  WHERE (c.user1_id = ? OR c.user2_id = ?)
    AND EXISTS (
      SELECT 1
      FROM messages m
      WHERE m.conversation_id = c.id
    )
  ORDER BY
    lastMessageAt DESC,
    c.id DESC
  `)
    .bind(userId, userId, userId, userId)
    .all();

  return Response.json({
    success: true,
    conversations: conversations.results || []
  });
}