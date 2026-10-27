import jwt from 'jsonwebtoken';

const COOKIE = 'token';

// Put a signed token (valid 7 days) in an httpOnly cookie so JavaScript in the page cannot read it.
// `v` is the user's session version: a password reset bumps it, which signs out every old cookie.
export function setLoginCookie(res, user, secret) {
  const token = jwt.sign({ id: user.id, v: user.sessionVersion || 0 }, secret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 3600 * 1000 });
}

export const clearLoginCookie = res => res.clearCookie(COOKIE);

// Middleware: runs before protected routes. Valid, current token -> req.userId is set. Otherwise 401.
export const requireAuth = (secret, User) => async (req, res, next) => {
  let payload;
  try { payload = jwt.verify(req.cookies[COOKIE], secret); } catch { return res.status(401).json({ error: 'Please log in' }); }
  const user = await User.findById(payload.id);
  if (!user || (user.sessionVersion || 0) !== (payload.v || 0)) return res.status(401).json({ error: 'Please log in' });
  req.userId = payload.id;
  req.user = user;
  next();
};
