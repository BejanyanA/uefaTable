// routes/register.js
import { jsonResponse, parseBody, hashWithSalt } from '../utils/helper.js';

export async function handleRegister(request, env) {
  const { username, email, password } = await parseBody(request);

  const errors = {};
  if (!username) errors.username = "Username is required";
  if (!email) errors.email = "Email is required";
  if (!password) errors.password = "Password is required";
  if (username.length > 15) errors.username = "Username must not exceed 15 characters";
  if (password.length > 30) errors.password = "Password must not exceed 30 characters";

  if (Object.keys(errors).length > 0) {
    return jsonResponse({ success: false, errors }, 400);
  }

  // 🔹 Normalize to lowercase for case-insensitive lookup
  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  // 🔹 Check existing username/email ignoring case
  const existingUsername = await env.core_data
    .prepare(`SELECT id FROM users WHERE LOWER(username) = ?`)
    .bind(normalizedUsername)
    .first();

  const existingEmail = await env.core_data
    .prepare(`SELECT id FROM users WHERE LOWER(email) = ?`)
    .bind(normalizedEmail)
    .first();

  if (existingUsername || existingEmail) {
    if (existingUsername) errors.username = "username_exists";
    if (existingEmail) errors.email = "email_exists";
    return jsonResponse({ success: false, errors }, 409);
  }

  const saltArray = crypto.getRandomValues(new Uint8Array(16));
  const salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, "0")).join("");
  const password_hash = await hashWithSalt(password, salt);

  try {
    await env.core_data
      .prepare(
        `INSERT INTO users (username, email, password_hash, salt, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
      )
      // store original case for display but email normalized if you prefer
      .bind(username.trim(), email.trim(), password_hash, salt)
      .run();

    return jsonResponse({ success: true, message: "registration_success" }, 201);
  } catch {
    return jsonResponse({ success: false, message: "registration_failed" }, 500);
  }
}