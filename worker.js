import jwt from '@tsndr/cloudflare-worker-jwt';

function handleCorsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: handleCorsHeaders(request.headers.get("Origin")),
    });
  }

  let response;

  // Route: /register
  if (request.method === "POST" && url.pathname === "/register") {
    const { username, email, password } = await parseBody(request);

    const errors = {};
    if (!username) errors.username = "Username is required";
    if (!email) errors.email = "Email is required";
    if (!password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      response = jsonResponse({ success: false, errors }, 400);
    } else {
      const existing = await env.core_data
        .prepare(`SELECT * FROM users WHERE email = ?`)
        .bind(email)
        .first();

      if (existing) {
        response = jsonResponse({ success: false, errors: { email: "Email already exists" } }, 409);
      } else {
        const saltArray = crypto.getRandomValues(new Uint8Array(16));
        const salt = Array.from(saltArray)
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");

        const password_hash = await hashWithSalt(password, salt);

        try {
          await env.core_data
            .prepare(
              `INSERT INTO users (username, email, password_hash, salt, created_at)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
            )
            .bind(username, email, password_hash, salt)
            .run();

          response = jsonResponse({ success: true, message: "User registered Successfully" }, 201);
        } catch {
          response = jsonResponse({ success: false, message: "Registration failed" }, 500);
        }
      }
    }
  }

  // Route: /login
  else if (request.method === "POST" && url.pathname === "/login") {
    const { email, password } = await parseBody(request);
    if (!email || !password) {
      response = jsonResponse({ success: false, message: "Missing fields" }, 400);
    } else {
      const user = await env.core_data.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).first();

      if (!user || (await hashWithSalt(password, user.salt)) !== user.password_hash) {
        response = jsonResponse({ success: false, message: "Invalid credentials" }, 401);
      } else {
        const token = await jwt.sign({ email: user.email, username: user.username }, env.JWT_SECRET, { exp: '2h' });
        response = jsonResponse({ success: true, message: "Login successful", token }, 200);
      }
    }
  }

  // Route: /me
  else if (request.method === "GET" && url.pathname === "/me") {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      response = jsonResponse({ success: false, message: "Unauthorized" }, 403);
    } else {
      const token = authHeader.split(" ")[1];
      const valid = await jwt.verify(token, env.JWT_SECRET);
      response = valid
        ? jsonResponse({ success: true, user: jwt.decode(token).payload })
        : jsonResponse({ success: false, message: "Invalid or expired token" }, 403);
    }
  }

  // Route not found
  else {
    response = jsonResponse({ success: false, message: "Not Found" }, 404);
  }

  // Append CORS headers to all responses
  const corsHeaders = handleCorsHeaders(request.headers.get("Origin"));
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));

  return response;
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
    headers: new Headers({ "Content-Type": "application/json" }),
  });
}

export default {
  fetch(request, env, ctx) {
    return onRequest({ request, env, ctx });
  }
};