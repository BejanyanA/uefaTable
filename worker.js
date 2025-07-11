import jwt from '@tsndr/cloudflare-worker-jwt';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Route: /register
  if (request.method === "POST" && url.pathname === "/register") {
    const { username, email, password } = await parseBody(request);
    if (!username || !email || !password) {
      return jsonResponse({ success: false, message: "Missing fields" }, 400);
    }

    const existing = await env.core_data.prepare(`SELECT * FROM users WHERE email = ?`)
      .bind(email).first();

    if (existing) {
      return jsonResponse({ success: false, message: "Email already exists" }, 409);
    }

    const saltArray = crypto.getRandomValues(new Uint8Array(16));
    const salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
    const password_hash = await hashWithSalt(password, salt);

    try {
      await env.core_data.prepare(
        `INSERT INTO users (username, email, password_hash, salt, created_at)
VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(username, email, password_hash, salt).run();

      return jsonResponse({ success: true, message: "User registered" }, 201);
    } catch (err) {
      return jsonResponse({ success: false, message: "Registration failed" }, 500);
    }
  }

  // Route: /login
  if (request.method === "POST" && url.pathname === "/login") {
    const { email, password } = await parseBody(request);
    if (!email || !password) {
      return jsonResponse({ success: false, message: "Missing fields" }, 400);
    }

    const user = await env.core_data.prepare(`SELECT * FROM users WHERE email = ?`)
      .bind(email).first();

    if (!user) {
      return jsonResponse({ success: false, message: "Invalid credentials" }, 401);
    }

    const inputHash = await hashWithSalt(password, user.salt);
    if (inputHash !== user.password_hash) {
      return jsonResponse({ success: false, message: "Invalid credentials" }, 401);
    }

    const token = await jwt.sign({ email: user.email, username: user.username }, env.JWT_SECRET, { exp: '2h' });

    return jsonResponse({ success: true, message: "Login successful", token }, 200);
  }

  // Route: /me
  if (request.method === "GET" && url.pathname === "/me") {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 403);
    }

    const token = authHeader.split(" ")[1];
    const valid = await jwt.verify(token, env.JWT_SECRET);

    if (!valid) {
      return jsonResponse({ success: false, message: "Invalid or expired token" }, 403);
    }

    const payload = jwt.decode(token).payload;
    return jsonResponse({ success: true, user: payload });
  }

  return jsonResponse({ success: false, message: "Not Found" }, 404);
}

async function parseBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function hashWithSalt(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default {
  fetch(request, env, ctx) {
    return onRequest({ request, env, ctx });
  }
};