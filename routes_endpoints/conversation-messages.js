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

  const { conversationId, beforeId } = await request.json();

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

  await env.core_data.prepare(`
  UPDATE messages
  SET is_read = 1
  WHERE conversation_id = ?
    AND sender_id != ?
    AND is_read = 0
`)
    .bind(conversationId, loggedInUserId)
    .run();

  const senderRows = await env.core_data.prepare(`
  SELECT DISTINCT sender_id AS senderId
  FROM messages
  WHERE conversation_id = ?
    AND sender_id != ?
`)
    .bind(conversationId, loggedInUserId)
    .all();

  const id = env.CHAT_ROOM.idFromName("global-chat");
  const room = env.CHAT_ROOM.get(id);

  for (const row of senderRows.results || []) {
    await room.fetch("https://chat-room/notify", {
      method: "POST",
      body: JSON.stringify({
        type: "messages_read",
        receiverId: row.senderId,
        conversationId
      })
    });
  }

  let query = `
  SELECT
    id,
    conversation_id AS conversationId,
    sender_id AS senderId,
    encrypted_message AS encryptedMessage,
    is_read AS isRead,
    created_at AS createdAt
  FROM messages
  WHERE conversation_id = ?
  ORDER BY id DESC
  LIMIT 50
  `;

  let bindings = [conversationId];

  if (beforeId) {
    query = `
    SELECT
      id,
      conversation_id AS conversationId,
      sender_id AS senderId,
      encrypted_message AS encryptedMessage,
      is_read AS isRead,
      created_at AS createdAt
    FROM messages
    WHERE conversation_id = ?
      AND id < ?
    ORDER BY id DESC
    LIMIT 50
  `;

    bindings = [conversationId, beforeId];
  }

  const messagesResult = await env.core_data.prepare(query)
    .bind(...bindings)
    .all();

  const messages = (messagesResult.results || []).reverse();

  return Response.json({
    success: true,
    messages,
    hasMore: messages.length === 50
  });
}