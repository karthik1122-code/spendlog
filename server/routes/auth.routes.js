import { Router } from 'express';

// /api/register, /login, /demo, /logout, /forgot, /reset, /me, /budget
export function authRoutes({ authController: c, requireAuth }) {
  const router = Router();
  router.post('/register', c.register);
  router.post('/login', c.login);
  router.post('/demo', c.demo);
  router.post('/logout', c.logout);
  router.post('/forgot', c.forgot);
  router.post('/reset', c.reset);
  router.get('/me', requireAuth, c.me);
  router.put('/budget', requireAuth, c.setBudget);
  return router;
}
