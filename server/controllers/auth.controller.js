import { setLoginCookie, clearLoginCookie } from '../lib/session.js';
import { publicUser } from '../services/auth.service.js';

const FORGOT_REPLY = { message: 'If an account uses that email, a reset link is on its way. It works for 30 minutes.' };

// HTTP layer for accounts: read the request, call the service, write the response.
export function createAuthController({ authService, secret, appUrl }) {
  return {
    async register(req, res) {
      const user = await authService.register(req.body || {});
      setLoginCookie(res, user, secret);
      res.status(201).json({ email: user.email, budget: 0 });
    },
    async login(req, res) {
      const user = await authService.login(req.body || {}, req.ip);
      setLoginCookie(res, user, secret);
      res.json(publicUser(user));
    },
    logout(req, res) {
      clearLoginCookie(res);
      res.json({ ok: true });
    },
    async forgot(req, res) {
      const baseUrl = appUrl || `${req.protocol}://${req.get('host')}`;
      await authService.requestReset(req.body?.email, req.ip, baseUrl);
      res.json(FORGOT_REPLY);
    },
    async reset(req, res) {
      const user = await authService.resetPassword(req.body || {}, req.ip);
      setLoginCookie(res, user, secret);
      res.json(publicUser(user));
    },
    // Who is logged in? The page calls this on load so a refresh keeps you signed in.
    me(req, res) {
      res.json(publicUser(req.user));
    },
    async setBudget(req, res) {
      const user = await authService.setBudget(req.userId, req.body?.amount);
      res.json({ budget: user.budget });
    },
  };
}
