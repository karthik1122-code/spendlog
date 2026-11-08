import { Router } from 'express';
import { healthRoutes } from './health.routes.js';
import { authRoutes } from './auth.routes.js';
import { expenseRoutes } from './expense.routes.js';

// All API routes, mounted under /api by app.js.
export function apiRoutes(deps) {
  const router = Router();
  router.use(healthRoutes(deps));
  router.use(authRoutes(deps));
  router.use(expenseRoutes(deps));
  return router;
}
