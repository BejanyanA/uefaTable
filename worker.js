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
    if (username.length > 20) errors.username = "Username must not exceed 20 characters";
    if (password.length > 30) errors.password = "Password must not exceed 30 characters";

    if (Object.keys(errors).length > 0) {
      response = jsonResponse({ success: false, errors }, 400);
    } else {
      const existingEmail = await env.core_data
        .prepare(`SELECT * FROM users WHERE email = ?`)
        .bind(email)
        .first();

      const existingUsername = await env.core_data
        .prepare(`SELECT * FROM users WHERE username = ?`)
        .bind(username)
        .first();

      if (existingEmail || existingUsername) {
        if (existingUsername) errors.username = "username_exists";
        if (existingEmail) errors.email = "email_exists";

        response = jsonResponse({ success: false, errors }, 409);
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

          response = jsonResponse({ success: true, message: "registration_success" }, 201);
        } catch {
          response = jsonResponse({ success: false, message: "registration_failed" }, 500);
        }
      }
    }
  }

  // Route: /login
  else if (request.method === "POST" && url.pathname === "/login") {
    const { email, password } = await parseBody(request);

    const errors = {};
    if (!email) errors.email = "Email is required";
    if (!password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      response = jsonResponse({ success: false, errors }, 400);
    } else {
      const user = await env.core_data.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).first();

      if (!user || (await hashWithSalt(password, user.salt)) !== user.password_hash) {
        response = jsonResponse({ success: false, message: "invalid_email_or_password" }, 400);
      } else {
        const expiration = Math.floor(Date.now() / 1000) + (2 * 60); // 2 hours - 60 * 60 * 2 
        const token = await jwt.sign({ email: user.email, username: user.username, exp: expiration }, env.JWT_SECRET);
        response = jsonResponse({ success: true, message: "Login successful", token }, 200);
      }
    }
  }

  // Route: /me
  else if (request.method === "GET" && url.pathname === "/me") {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      response = jsonResponse({ success: false, message: "Unauthorized" }, 401);
    } else {
      const token = authHeader.split(" ")[1];

      try {
        const isValid = await jwt.verify(token, env.JWT_SECRET);

        if (!isValid) {
          response = jsonResponse({ success: false, message: "Invalid or expired token" }, 401);
        } else {
          const payload = jwt.decode(token).payload;

          // Manually check expiration
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp && payload.exp < now) {
            response = jsonResponse({ success: false, message: "Token expired" }, 401);
          } else {
            response = jsonResponse({ success: true, user: payload }, 200);
          }
        }
      } catch (err) {
        console.error("Token verification failed:", err);
        response = jsonResponse({ success: false, message: "Invalid token" }, 401);
      }
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