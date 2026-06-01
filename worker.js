import { handleCorsHeaders, jsonResponse } from './utils/helper.js';
import { verifyToken } from './utils/jwt.js';
import { handleRegister } from './routes_endpoints/register.js';
import { handleLogin } from './routes_endpoints/login.js';
import { handleMe, handleCustomLeagues } from './routes_endpoints/me.js';
import { handleAddFriends, handleDeleteFriend, handleRejectFriend, handleApproveFriends } from './routes_endpoints/friend_actions.js';
import { handleLeagues, handleLeaguesCreate, handleCreateRoundKnockouts, handleLeaguesEdit, handleLeaguesDelete } from './routes_endpoints/leagues.js';
import { handleGetApprovedFriends, handleGetAllFriendsStatuses, handleSearchFriendByUsername } from './routes_endpoints/get_friends.js';

import { handleGetUserDetails, handleUpdateUserDetails, handleAchievements } from './routes_endpoints/user_data.js';

import { handleGetAllLeaguelogos } from './routes_endpoints/get_leagues.js';


// Club
import { handleAttachPlayers, handleAttachKnockPlayers, handleAttachOnlyKnockPlayers } from './routes_endpoints/leagues/attach_player.js';
import { handleGetAllClubs, handleSearchClubs } from './routes_endpoints/leagues/get_clubs.js';
import { handleGroupKnockoutMatches } from './routes_endpoints/leagues/group_knockouts.js';
import { handleLeagueInstances } from './routes_endpoints/leagues/league_instances.js';
import { handleLeagueMatches } from './routes_endpoints/leagues/league_matches.js';
import { handleGetLeaguePlayers } from './routes_endpoints/leagues/league_player.js';
import { handleLeagueStandings } from './routes_endpoints/leagues/league_standings.js';
import { handleOnlyKnockoutMatches } from './routes_endpoints/leagues/round_knockouts.js';
import { handleUpdateKnockoutMatches } from './routes_endpoints/leagues/update_group_knock_matches.js';
import { handleUpdateMatches } from './routes_endpoints/leagues/update_group_matches.js';
import { handleUpdateKnockoutWinner } from './routes_endpoints/leagues/update_knock_team_winner.js';
import { handleUpdateOnlyKnockoutMatches } from './routes_endpoints/leagues/update_only_knock_matches.js';
import { handleUpdateOnlyKnockoutWinner } from './routes_endpoints/leagues/update_only_knock_team_winner.js';

// National
import { handleGetAllWorldCountries, handleSearchWorldCountries, handleGetAllEuropeCountries, handleSearchEuropeCountries } from './routes_endpoints/national/get_countries.js';
import { handleNationalInstances } from './routes_endpoints/national/national_instances.js';
import { handleNationalStandings } from './routes_endpoints/national/national_standings.js';
import { handleNationalMatches } from './routes_endpoints/national/national_matches.js';
import { handleNationalGroupKnockoutMatches } from './routes_endpoints/national/national_group_knockouts.js';
import { handleUpdateNationalMatches } from './routes_endpoints/national/update_national_group_matches.js';
import { handleUpdateNationalKnockoutMatches } from './routes_endpoints/national/update_national_group_knock_matches.js';
import { handleUpdateNationalKnockoutWinner } from './routes_endpoints/national/update_national_knock_team_winner.js';
import { handleNationalOnlyKnockoutMatches } from './routes_endpoints/national/national_round_knockouts.js';
import { handleUpdateNationalOnlyKnockoutMatches } from './routes_endpoints/national/update_national_only_knock_matches.js';
import { handleUpdateNationalOnlyKnockoutWinner } from './routes_endpoints/national/update_national_only_knock_team_winner.js';
import { handleGetNationalPlayers } from './routes_endpoints/national/national_player.js';
import { handleAttachNationalPlayers, handleAttachNationalKnockPlayers, handleAttachNationalOnlyKnockPlayers } from './routes_endpoints/national/attach_national_player.js';

// Messaging
import { handleConversations } from './routes_endpoints/conversations.js';
import { handleMessages } from './routes_endpoints/messages.js';
import { handleConversationMessages } from './routes_endpoints/conversation-messages.js';
import { handleMyConversations } from './routes_endpoints/my_conversations.js';


// Route registry with path as key and allowed methods as subkeys
const routeRegistry = {
  "/register": { POST: handleRegister },
  "/login": { POST: handleLogin },
  "/me": { GET: handleMe },
  "/custom-leagues": { GET: handleCustomLeagues },
  "/friends": { POST: handleGetApprovedFriends },
  "/all-users": { POST: handleGetAllFriendsStatuses },
  "/search-user": { POST: handleSearchFriendByUsername },
  "/add-friend": { POST: handleAddFriends },
  "/user-delete": { POST: handleDeleteFriend },
  "/user-reject": { POST: handleRejectFriend },
  "/user-approve": { POST: handleApproveFriends },

  "/user-details": { GET: handleGetUserDetails },
  "/user-update": { POST: handleUpdateUserDetails },
  "/user-achievements": { GET: handleAchievements },

  "/leagues": { POST: handleLeagues },
  "/create-leagues": { POST: handleLeaguesCreate },
  "/create-knockouts": { POST: handleCreateRoundKnockouts },
  "/update-leagues": { POST: handleLeaguesEdit },
  "/delete-league": { POST: handleLeaguesDelete },

  "/league-logos": { GET: handleGetAllLeaguelogos },


  // Club
  "/clubs": { GET: handleGetAllClubs },
  "/search-clubs": { POST: handleSearchClubs },
  "/league-instances": { POST: handleLeagueInstances },
  "/standings": { POST: handleLeagueStandings },
  "/matches": { POST: handleLeagueMatches },
  "/update-score": { POST: handleUpdateMatches },
  "/league-players": { POST: handleGetLeaguePlayers },
  "/attach-players": { POST: handleAttachPlayers },
  "/group-knockouts": { POST: handleGroupKnockoutMatches },
  "/round-knockouts": { POST: handleOnlyKnockoutMatches },
  "/update-knock-matches": { POST: handleUpdateKnockoutMatches },
  "/update-round-knock-matches": { POST: handleUpdateOnlyKnockoutMatches },
  "/attach-knock-players": { POST: handleAttachKnockPlayers },
  "/attach-round-knock-players": { POST: handleAttachOnlyKnockPlayers },
  "/update-knock-winner": { POST: handleUpdateKnockoutWinner },
  "/update-round-knock-winner": { POST: handleUpdateOnlyKnockoutWinner },

  // National  
  "/world-countries": { GET: handleGetAllWorldCountries },
  "/search-world-countries": { POST: handleSearchWorldCountries },
  "/europe-countries": { GET: handleGetAllEuropeCountries },
  "/search-europe-countries": { POST: handleSearchEuropeCountries },
  "/national-instances": { POST: handleNationalInstances },
  "/national-standings": { POST: handleNationalStandings },
  "/national-matches": { POST: handleNationalMatches },
  "/national-group-knockouts": { POST: handleNationalGroupKnockoutMatches },
  "/update-national-score": { POST: handleUpdateNationalMatches },
  "/national-players": { POST: handleGetNationalPlayers },
  "/update-national-knock-matches": { POST: handleUpdateNationalKnockoutMatches },
  "/update-national-knock-winner": { POST: handleUpdateNationalKnockoutWinner },
  "/national-round-knockouts": { POST: handleNationalOnlyKnockoutMatches },
  "/update-national-round-knock-matches": { POST: handleUpdateNationalOnlyKnockoutMatches },
  "/update-national-round-knock-winner": { POST: handleUpdateNationalOnlyKnockoutWinner },
  "/attach-national-players": { POST: handleAttachNationalPlayers },
  "/attach-national-knock-players": { POST: handleAttachNationalKnockPlayers },
  "/attach-national-round-knock-players": { POST: handleAttachNationalOnlyKnockPlayers },

  // Messaging
  "/conversations": { POST: handleConversations },
  "/messages": { POST: handleMessages },
  "/conversation-messages": { POST: handleConversationMessages },
  "/my-conversations": { POST: handleMyConversations },


};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: handleCorsHeaders(request.headers.get("Origin")),
    });
  }

  const route = routeRegistry[path];
  let response;

  if (route) {
    const handler = route[method];
    if (handler) {
      try {
        response = await handler(request, env);
      } catch (err) {
        console.error("❗ Unexpected error:", err);
        response = jsonResponse({ success: false, message: "something_went_wrong" }, 500);
      }
    } else {
      const allowedMethods = Object.keys(route).join(", ");
      response = new Response(JSON.stringify({
        success: false,
        message: "Method Not Allowed"
      }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Allow": allowedMethods,
          ...handleCorsHeaders(request.headers.get("Origin")),
        }
      });
    }
  } else {
    response = jsonResponse({ success: false, message: "Not Found" }, 404);
  }

  // Append CORS headers to all responses
  const corsHeaders = handleCorsHeaders(request.headers.get("Origin"));
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));

  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // === SSE subscribe (forward to Durable Object) ===
    if (url.pathname === "/notifications/stream" && request.method === "GET") {
      const t = url.searchParams.get("t");
      const payload = t ? await verifyToken(t, env.JWT_SECRET) : null;
      if (!payload) return new Response("Unauthorized", { status: 401 });

      const id = env.NOTIF_HUB.idFromName("hub");
      const stub = env.NOTIF_HUB.get(id);

      url.searchParams.set("action", "subscribe");
      url.searchParams.set("userId", String(payload.id));

      const resp = await stub.fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "text/event-stream",
          // forward origin so DO can echo it in CORS
          "Origin": request.headers.get("Origin") || ""
        }
      });

      // return as-is (headers already include SSE + CORS)
      return resp;
    }

    // === Get unread count ===
    if (url.pathname === "/notifications/count" && request.method === "GET") {
      const auth = request.headers.get("Authorization");
      if (!auth?.startsWith("Bearer "))
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);

      const token = auth.split(" ")[1];
      const me = await verifyToken(token, env.JWT_SECRET);
      if (!me) return jsonResponse({ success: false, message: "Unauthorized" }, 401);

      const seenAt = await getSeenAt(env, me.id);
      const count = await getUnreadCount(env, me.id, seenAt);
      return jsonResponse({ success: true, data: { requestsCount: count, seenAt } });
    }

    // === Mark notifications as seen ===
    if (url.pathname === "/notifications/mark-seen" && request.method === "POST") {
      const auth = request.headers.get("Authorization");
      if (!auth?.startsWith("Bearer "))
        return jsonResponse({ success: false, message: "Unauthorized" }, 401);

      const token = auth.split(" ")[1];
      const me = await verifyToken(token, env.JWT_SECRET);
      if (!me) return jsonResponse({ success: false, message: "Unauthorized" }, 401);

      await markSeenNow(env, me.id);
      await publishToUser(env, me.id, { type: "friend_requests", count: 0 });
      return jsonResponse({ success: true });
    }

    if (url.pathname === "/chat-socket") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }
      const token = url.searchParams.get("token");

      const user = await verifyToken(token, env.JWT_SECRET);

      if (!user?.id) {
        return new Response("Unauthorized", { status: 401 });
      }

      const id = env.CHAT_ROOM.idFromName("global-chat");
      const room = env.CHAT_ROOM.get(id);

      return room.fetch(
        new Request(`https://chat-room/connect?userId=${user.id}`, request)
      );
    }

    if (url.pathname === "/presence-socket") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }

      const token = url.searchParams.get("token");
      const user = await verifyToken(token, env.JWT_SECRET);

      if (!user?.id) {
        return new Response("Unauthorized", { status: 401 });
      }

      const id = env.PRESENCE_ROOM.idFromName("presence");
      const room = env.PRESENCE_ROOM.get(id);

      return room.fetch(
        new Request(`https://presence-room/connect?userId=${user.id}`, request)
      );
    }

    // === Fallback to your existing router ===
    return onRequest({ request, env, ctx });
  }
};


export { NotificationHub } from './routes_endpoints/NotificationHub.js';


export async function getSeenAt(env, userId) {
  const row = await env.core_data
    .prepare(`SELECT updated_at AS seenAt FROM user_notification_state WHERE user_id = ?`)
    .bind(userId).first();
  return row?.seenAt || null;
}

export async function markSeenNow(env, userId) {
  await env.core_data.prepare(
    `INSERT INTO user_notification_state (user_id, updated_at)
       VALUES (?, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET updated_at = excluded.updated_at`
  ).bind(userId).run();
}

export async function getUnreadCount(env, userId, seenAt) {
  if (!seenAt) {
    const { results } = await env.core_data.prepare(
      `SELECT COUNT(*) AS cnt FROM friends WHERE friend_id = ? AND status = 'pending'`
    ).bind(userId).all();
    return Number(results?.[0]?.cnt || 0);
  }
  const { results } = await env.core_data.prepare(
    `SELECT COUNT(*) AS cnt
     FROM friends
     WHERE friend_id = ? AND status = 'pending'
       AND datetime(COALESCE(created_at, updated_at, '1970-01-01')) > datetime(?)`
  ).bind(userId, seenAt).all();
  return Number(results?.[0]?.cnt || 0);
}

export async function publishToUser(env, userId, payload) {
  const id = env.NOTIF_HUB.idFromName("hub");
  const stub = env.NOTIF_HUB.get(id);
  const u = new URL("https://internal/notifications/publish");
  u.searchParams.set("action", "publish");
  u.searchParams.set("userId", String(userId));
  for (const [k, v] of Object.entries(payload)) u.searchParams.set(k, String(v));
  await stub.fetch(u.toString(), { method: "POST" });
}


export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    this.sessions = new Map(); // userId -> Set<WebSocket>
    this.lastPing = new Map(); // userId -> timestamp

    this.cleanupTimer = setInterval(() => {
      this.checkDisconnectedUsers();
    }, 1000);
  }

  addSession(userId, socket) {
    const key = String(userId);

    if (!this.sessions.has(key)) {
      this.sessions.set(key, new Set());
    }

    this.sessions.get(key).add(socket);
    this.lastPing.set(key, Date.now());
  }

  removeSession(userId, socket) {
    const key = String(userId);
    const sockets = this.sessions.get(key);

    if (!sockets) return;

    sockets.delete(socket);

    if (!sockets.size) {
      this.sessions.delete(key);
      this.lastPing.delete(key);
    }
  }

  checkDisconnectedUsers() {
    const now = Date.now();

    for (const [userId, lastPingTime] of this.lastPing.entries()) {
      if (now - lastPingTime > 45000) {
        const sockets = this.sessions.get(userId);

        if (sockets) {
          for (const socket of sockets) {
            try {
              socket.close();
            } catch { }
          }
        }

        this.sessions.delete(userId);
        this.lastPing.delete(userId);
      }
    }
  }

  sendToUser(userId, data) {
    const sockets = this.sessions.get(String(userId));
    if (!sockets?.size) return;

    const message = JSON.stringify(data);

    for (const socket of sockets) {
      try {
        socket.send(message);
      } catch {
        sockets.delete(socket);
      }
    }

    if (!sockets.size) {
      this.sessions.delete(String(userId));
      this.lastPing.delete(String(userId));
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      const userId = url.searchParams.get("userId");

      if (!userId) {
        return new Response("Missing userId", { status: 400 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();

      this.addSession(userId, server);

      server.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "ping") {
            this.lastPing.set(String(userId), Date.now());
          }

          if (data.type === "typing" || data.type === "typing_stop") {
            this.sendToUser(data.receiverId, {
              type: data.type,
              conversationId: data.conversationId,
              senderId: Number(userId)
            });
            return;
          }
          
        } catch { }
      });

      const cleanup = () => {
        this.removeSession(userId, server);
      };

      server.addEventListener("close", cleanup);
      server.addEventListener("error", cleanup);

      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

    if (url.pathname === "/notify") {
      const body = await request.json();

      this.sendToUser(body.receiverId, body);

      return Response.json({ success: true });
    }

    return new Response("Not found", { status: 404 });
  }
}


export class PresenceRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.lastPing = new Map();
    this.status = new Map();

    this.cleanupTimer = setInterval(() => {
      this.checkOfflineUsers();
    }, 1000);
  }

  broadcast(data) {
    const message = JSON.stringify(data);

    for (const sockets of this.sessions.values()) {
      for (const socket of sockets) {
        try {
          socket.send(message);
        } catch { }
      }
    }
  }

  async sendStatuses(socket, friendIds = []) {
    if (!Array.isArray(friendIds) || !friendIds.length) return;

    const safeIds = friendIds.map(Number).filter(Boolean);
    if (!safeIds.length) return;

    const placeholders = safeIds.map(() => "?").join(",");

    const rows = await this.env.core_data.prepare(`
      SELECT id, is_online, last_seen
      FROM users
      WHERE id IN (${placeholders})
    `).bind(...safeIds).all();

    socket.send(JSON.stringify({
      type: "presence_statuses",
      users: rows.results.map((user) => ({
        userId: user.id,
        isOnline: Number(user.is_online) === 1,
        lastSeen: user.last_seen || null
      }))
    }));
  }

  async setOnline(userId) {
    const key = String(userId);
    this.lastPing.set(key, Date.now());

    if (this.status.get(key) === true) return;

    this.status.set(key, true);

    await this.env.core_data.prepare(`
      UPDATE users
      SET is_online = 1
      WHERE id = ?
    `).bind(userId).run();

    this.broadcast({
      type: "presence_status",
      userId: Number(userId),
      isOnline: true,
      lastSeen: null
    });
  }

  async setOffline(userId) {
    const key = String(userId);

    if (this.status.get(key) === false) return;

    this.status.set(key, false);

    const lastSeen = new Date().toISOString();

    await this.env.core_data.prepare(`
      UPDATE users
      SET is_online = 0,
          last_seen = ?
      WHERE id = ?
    `).bind(lastSeen, userId).run();

    this.broadcast({
      type: "presence_status",
      userId: Number(userId),
      isOnline: false,
      lastSeen
    });
  }

  checkOfflineUsers() {
    const now = Date.now();

    for (const [userId, lastPingTime] of this.lastPing.entries()) {
      if (now - lastPingTime > 45000) {
        this.lastPing.delete(userId);
        this.setOffline(userId);
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname !== "/connect") {
      return new Response("Not found", { status: 404 });
    }

    const userId = url.searchParams.get("userId");
    if (!userId) return new Response("Missing userId", { status: 400 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    const key = String(userId);

    if (!this.sessions.has(key)) {
      this.sessions.set(key, new Set());
    }

    this.sessions.get(key).add(server);
    await this.setOnline(userId);

    server.addEventListener("message", async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "ping") {
          this.lastPing.set(key, Date.now());
          await this.setOnline(userId);
          return;
        }

        if (data.type === "get_statuses") {
          await this.sendStatuses(server, data.friendIds || []);
        }
      } catch { }
    });

    const cleanup = async () => {
      const set = this.sessions.get(key);

      if (set) {
        set.delete(server);

        if (!set.size) {
          this.sessions.delete(key);
        }
      }

      if (!this.sessions.has(key)) {
        this.lastPing.delete(key);
        await this.setOffline(userId);
      }
    };

    server.addEventListener("close", cleanup);
    server.addEventListener("error", cleanup);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
}