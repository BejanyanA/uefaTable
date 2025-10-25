// routes/get_friends.js

import { jsonResponse, parseBody, hashWithSalt } from '../utils/helper.js';
import { verifyToken } from '../utils/jwt.js';

export class NotificationHub {
  constructor(state, env) {
    this.state = state;   // available if/when you want persistence
    this.env = env;
    this.clients = new Map(); // userId -> Set(stream controllers)
  }

  _broadcast(userId, data) {
    const set = this.clients.get(String(userId));
    if (!set?.size) return;
    const frame = `data: ${JSON.stringify(data)}\n\n`;
    for (const ctrl of set) { try { ctrl.enqueue(frame); } catch {} }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "subscribe") {
      const userId = String(url.searchParams.get("userId") || "");
      if (!userId) return new Response("Missing userId", { status: 400 });

      const stream = new ReadableStream({
        start: (controller) => {
          let set = this.clients.get(userId);
          if (!set) { set = new Set(); this.clients.set(userId, set); }
          if (set.size >= 2) { const [first] = set; try { first.close?.(); } catch {} set.delete(first); }
          set.add(controller);
          controller.enqueue(`event: ping\ndata: ok\n\n`);
        },
        cancel: () => {
          const set = this.clients.get(userId);
          if (!set) return;
          for (const c of set) set.delete(c);
          if (!set.size) this.clients.delete(userId);
        }
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        }
      });
    }

    if (action === "publish") {
      const userId = url.searchParams.get("userId");
      const payload = {};
      for (const [k, v] of url.searchParams.entries()) {
        if (k === "action" || k === "userId") continue;
        payload[k] = isNaN(Number(v)) ? v : Number(v);
      }
      this._broadcast(userId, payload);
      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
  }
}