// utils/jwt.js

import jwt from '@tsndr/cloudflare-worker-jwt';

export async function verifyToken(token, secret) {
  const isValid = await jwt.verify(token, secret);
  if (!isValid) return null;

  const payload = jwt.decode(token).payload;

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) return null;

  return payload;
}