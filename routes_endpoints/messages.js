// routes/messages.js
import { verifyToken } from "../utils/jwt.js";

export async function handleMessages(request, env) {
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

  const { conversationId, encryptedMessage } = await request.json();

  if (!conversationId || !encryptedMessage) {
    return Response.json(
      { success: false, message: "Missing fields" },
      { status: 400 }
    );
  }

  const conversation = await env.core_data.prepare(`
  SELECT id, user1_id, user2_id
  FROM conversations
  WHERE id = ?
    AND (user1_id = ? OR user2_id = ?)
`)
    .bind(conversationId, user.id, user.id)
    .first();

  if (!conversation) {
    return Response.json(
      { success: false, message: "Conversation not found" },
      { status: 403 }
    );
  }

  const result = await env.core_data.prepare(`
  INSERT INTO messages (
    conversation_id,
    sender_id,
    encrypted_message
  )
  VALUES (?, ?, ?)
`)
    .bind(conversationId, user.id, encryptedMessage)
    .run();

  const receiverId =
    Number(conversation.user1_id) === Number(user.id)
      ? conversation.user2_id
      : conversation.user1_id;

  const id = env.CHAT_ROOM.idFromName("global-chat");
  const room = env.CHAT_ROOM.get(id);

  const sender = await env.core_data.prepare(`
  SELECT username
  FROM users
  WHERE id = ?
  `)
    .bind(user.id)
    .first();

  await room.fetch("https://chat-room/notify", {
    method: "POST",
    body: JSON.stringify({
      type: "new_message",
      conversationId,
      senderId: user.id,
      senderUsername: sender?.username || "Someone",
      receiverId,
      messageId: result.meta.last_row_id,
      encryptedMessage,
      createdAt: new Date().toISOString()
    })
  });

  return Response.json({
    success: true,
    messageId: result.meta.last_row_id
  });
}