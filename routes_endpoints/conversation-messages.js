// routes/conversation-messages.js
import { verifyToken } from "../utils/jwt.js";

export async function handleConversationMessages(request, env) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const user = await verifyToken(token, env.JWT_SECRET);

  if (!user?.id) {
    return Response.json({ success: false, message: "Invalid token" }, { status: 401 });
  }

  const { conversationId } = await request.json();

  if (!conversationId) {
    return Response.json({ success: false, message: "conversationId is required" }, { status: 400 });
  }

  const loggedInUserId = Number(user.id);

  const conversation = await env.core_data.prepare(`
    SELECT id
    FROM conversations
    WHERE id = ?
      AND (user1_id = ? OR user2_id = ?)
  `)
    .bind(conversationId, loggedInUserId, loggedInUserId)
    .first();

  if (!conversation) {
    return Response.json(
      { success: false, message: "Conversation not found or access denied" },
      { status: 403 }
    );
  }

  const messages = await env.core_data.prepare(`
    SELECT
      id,
      conversation_id AS conversationId,
      sender_id AS senderId,
      encrypted_message AS encryptedMessage,
      created_at AS createdAt
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC, id ASC
  `)
    .bind(conversationId)
    .all();

  return Response.json({
    success: true,
    messages: messages.results || []
  });
}