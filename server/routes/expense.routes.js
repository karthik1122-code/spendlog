import { Router } from 'express';

// Every expense route needs a logged-in user.
// GET /api/expenses?month=2026-10&category=Food&q=chai&page=2&limit=10&tz=-330
export function expenseRoutes({ expenseController: c, requireAuth: auth }) {
  const router = Router();
  router.get('/expenses', auth, c.list);
  router.get('/expenses.csv', auth, c.exportCsv);
  router.get('/summary', auth, c.summary);
  router.post('/expenses', auth, c.create);
  router.put('/expenses/:id', auth, c.update);
  router.delete('/expenses/:id', auth, c.remove);
  return router;
}
