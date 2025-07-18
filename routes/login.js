// routes/login.js
import { jsonResponse, parseBody, hashWithSalt } from '../utils/helper.js';
import jwt from '@tsndr/cloudflare-worker-jwt';

export async function handleLogin(request, env) {
  const { email, password } = await parseBody(request);

  const errors = {};
  if (!email) errors.email = "Email is required";
  if (!password) errors.password = "Password is required";

  if (Object.keys(errors).length > 0) {
    return jsonResponse({ success: false, errors }, 400);
  }

  const user = await env.core_data
    .prepare(`SELECT * FROM users WHERE email = ?`)
    .bind(email)
    .first();

  if (!user || (await hashWithSalt(password, user.salt)) !== user.password_hash) {
    return jsonResponse({ success: false, message: "invalid_email_or_password" }, 400);
  }

  const expiration = Math.floor(Date.now() / 1000) + (60 * 60 * 2);
  const token = await jwt.sign(
    { id: user.id, email: user.email, username: user.username, exp: expiration },
    env.JWT_SECRET
  );

  return jsonResponse({
    success: true,
    message: "Login successful",
    id: user.id,
    token
  }, 200);
}
