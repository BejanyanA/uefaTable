import { verifyToken } from "../utils/jwt.js";

export async function handleSavePublicKey(request, env) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const user = await verifyToken(token, env.JWT_SECRET);
    if (!user?.id) {
        return Response.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    const { publicKey } = await request.json();
    if (!publicKey || typeof publicKey !== "object") {
        return Response.json({ success: false, message: "Invalid public key" }, { status: 400 });
    }

    await env.core_data.prepare(`
        UPDATE users SET public_key = ? WHERE id = ?
    `).bind(JSON.stringify(publicKey), user.id).run();

    return Response.json({ success: true });
}

export async function handleGetPublicKey(request, env) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const user = await verifyToken(token, env.JWT_SECRET);
    if (!user?.id) {
        return Response.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    if (!userId) {
        return Response.json({ success: false, message: "userId is required" }, { status: 400 });
    }

    // Only approved friends can fetch each other's public keys
    const friendship = await env.core_data.prepare(`
        SELECT 1 FROM friends
        WHERE status = 'approved'
          AND (
            (user_id = ? AND friend_id = ?)
            OR (user_id = ? AND friend_id = ?)
          )
        LIMIT 1
    `).bind(user.id, userId, userId, user.id).first();

    if (!friendship) {
        return Response.json({ success: false, message: "Not authorized" }, { status: 403 });
    }

    const targetUser = await env.core_data.prepare(`
        SELECT public_key FROM users WHERE id = ?
    `).bind(userId).first();

    let publicKey = null;
    try {
        publicKey = targetUser?.public_key ? JSON.parse(targetUser.public_key) : null;
    } catch {
        publicKey = null;
    }

    return Response.json({ success: true, publicKey });
}
