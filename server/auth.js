import jwt from 'jsonwebtoken';

const COOKIE = 'token';

// Put a signed token (valid 7 days) in an httpOnly cookie so JavaScript in the page cannot read it.
export function setLoginCookie(res, userId, secret) {
  const token = jwt.sign({ id: userId }, secret, { expiresIn: '7d' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });
}

export const clearLoginCookie = res => res.clearCookie(COOKIE);

// Middleware: runs before protected routes. Valid token -> req.userId is set. Otherwise 401.
export const requireAuth = secret => (req, res, next) => {
  try {
    req.userId = jwt.verify(req.cookies[COOKIE], secret).id;
    next();
  } catch {
    res.status(401).json({ error: 'Please log in' });
  }
};
