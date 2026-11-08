import { readSession } from '../lib/session.js';

// Runs before protected routes. A valid, current cookie sets req.userId and req.user; otherwise 401.
export const requireAuth = (secret, User) => async (req, res, next) => {
  const session = readSession(req, secret);
  if (!session) return res.status(401).json({ error: 'Please log in' });
  const user = await User.findById(session.id);
  if (!user || (user.sessionVersion || 0) !== (session.v || 0)) return res.status(401).json({ error: 'Please log in' });
  req.userId = session.id;
  req.user = user;
  next();
};
