import jwt from 'jsonwebtoken';

const COOKIE = 'token';

// Put a signed token (valid 7 days) in an httpOnly cookie so JavaScript in the page cannot read it.
// `v` is the user's session version: a password reset bumps it, which signs out every old cookie.
export function setLoginCookie(res, user, secret) {
  const token = jwt.sign({ id: user.id, v: user.sessionVersion || 0 }, secret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 3600 * 1000 });
}

export const clearLoginCookie = res => res.clearCookie(COOKIE);

// Returns { id, v } from a valid cookie, or null.
export function readSession(req, secret) {
  try { return jwt.verify(req.cookies[COOKIE], secret); } catch { return null; }
}
