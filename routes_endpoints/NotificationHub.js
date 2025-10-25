// routes/get_friends.js
import { handleCorsHeaders } from '../utils/helper.js';

export class NotificationHub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map(); // userId -> Set(controller)
    this.encoder = new TextEncoder();
  }

  _send(controller, s) {
    controller.enqueue(this.encoder.encode(s));
  }

  _broadcast(userId, data) {
    const set = this.clients.get(String(userId));
    if (!set?.size) return;
    const frame = `data: ${JSON.stringify(data)}\n\n`;
    for (const ctrl of set) {
      try { this._send(ctrl, frame); } catch { /* noop */ }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "subscribe") {
      const userId = String(url.searchParams.get("userId") || "");
      if (!userId) return new Response("Missing userId", { status: 400 });

      const origin = request.headers.get("Origin") || "*";

      let controllerRef; // to remove only THIS controller on cancel

      const stream = new ReadableStream({
        start: (controller) => {
          controllerRef = controller;

          // track client
          let set = this.clients.get(userId);
          if (!set) { set = new Set(); this.clients.set(userId, set); }
          if (set.size >= 2) { // optional: drop oldest to limit fanout
            const [first] = set;
            try { first.close?.(); } catch { }
            set.delete(first);
          }
          set.add(controller);

          // send an immediate byte so CF doesn't complain
          this._send(controller, `: connected ${Date.now()}\n\n`);
          this._send(controller, `event: ready\ndata: ${JSON.stringify({ ok: true, userId })}\n\n`);

          // keepalive every 15s
          const keep = setInterval(() => {
            this._send(controller, `: keepalive ${Date.now()}\n\n`);
          }, 15000);

          // cleanup on client disconnect
          const close = () => {
            clearInterval(keep);
            const s = this.clients.get(userId);
            if (s) {
              s.delete(controller);
              if (!s.size) this.clients.delete(userId);
            }
            try { controller.close(); } catch { }
          };

          request.signal?.addEventListener("abort", close);
        },
        cancel: () => {
          const s = this.clients.get(userId);
          if (s) {
            s.delete(controllerRef);
            if (!s.size) this.clients.delete(userId);
          }
        }
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "Vary": "Origin",
          ...handleCorsHeaders(origin) // <- pass a real origin string
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