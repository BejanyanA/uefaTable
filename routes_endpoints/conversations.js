// routes/conversations.js
import { verifyToken } from "../utils/jwt.js";

export async function handleConversations(request, env) {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const user = await verifyToken(token, env.JWT_SECRET);

  if (!user?.id) {
    return Response.json({ success: false, message: "Invalid token" }, { status: 401 });
  }

  const { friendId } = await request.json();

  if (!friendId) {
    return Response.json({ success: false, message: "friendId is required" }, { status: 400 });
  }

  const loggedInUserId = Number(user.id);
  const targetFriendId = Number(friendId);

  if (loggedInUserId === targetFriendId) {
    return Response.json({ success: false, message: "Cannot create chat with yourself" }, { status: 400 });
  }

  const friendship = await env.core_data.prepare(`
    SELECT 1
    FROM friends
    WHERE status = 'approved'
      AND (
        (user_id = ? AND friend_id = ?)
        OR
        (user_id = ? AND friend_id = ?)
      )
    LIMIT 1
  `).bind(
    loggedInUserId,
    targetFriendId,
    targetFriendId,
    loggedInUserId
  ).first();

  if (!friendship) {
    return Response.json({ success: false, message: "You can message only approved friends" }, { status: 403 });
  }

  const user1Id = Math.min(loggedInUserId, targetFriendId);
  const user2Id = Math.max(loggedInUserId, targetFriendId);

  await env.core_data.prepare(`
    INSERT OR IGNORE INTO conversations (user1_id, user2_id)
    VALUES (?, ?)
  `).bind(user1Id, user2Id).run();

  const conversation = await env.core_data.prepare(`
    SELECT id
    FROM conversations
    WHERE user1_id = ? AND user2_id = ?
  `).bind(user1Id, user2Id).first();

  return Response.json({
    success: true,
    conversationId: conversation.id
  });
}