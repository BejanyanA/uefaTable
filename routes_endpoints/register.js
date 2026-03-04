// routes/register.js
import { jsonResponse, parseBody, hashWithSalt } from '../utils/helper.js';

export async function handleRegister(request, env) {
  const { username, email, password } = await parseBody(request);

  const errors = {};

  // 🔹 Normalize inputs first
  const trimmedUsername = (username || "").trim();
  const trimmedEmail = (email || "").trim();
  const trimmedPassword = (password || "").trim();

  // 🔹 Required checks
  if (!trimmedUsername) errors.username = "Username is required";
  if (!trimmedEmail) errors.email = "Email is required";
  if (!trimmedPassword) errors.password = "Password is required";

  // 🔹 Username validation
  if (trimmedUsername) {
    if (trimmedUsername.length < 3) {
      errors.username = "Username must be at least 3 characters";
    } else if (trimmedUsername.length > 10) {
      errors.username = "Username must not exceed 10 characters";
    }
  }

  // 🔹 Email format validation
  if (trimmedEmail) {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

    if (!emailRegex.test(trimmedEmail)) {
      errors.email = "Invalid email format";
    } else {
      const domain = trimmedEmail.split("@")[1];

      if (domain.startsWith("-") || domain.endsWith("-")) {
        errors.email = "Invalid email format";
      }

      if (domain.includes("-.") || domain.includes(".-")) {
        errors.email = "Invalid email format";
      }

      // ❌ reject IP based domains like test@[192.168.1.1]
      if (domain.includes("[") || domain.includes("]")) {
        errors.email = "Invalid email format";
      }
    }
  }

  // 🔹 Password length limit
  if (trimmedPassword && trimmedPassword.length > 30) {
    errors.password = "Password must not exceed 30 characters";
  }

  // 🔹 Password strength validation
  if (trimmedPassword) {
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\\/]).{8,}$/;

    if (!passwordRegex.test(trimmedPassword)) {
      errors.password =
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character";
    }
  }

  // 🔹 Stop if any errors
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