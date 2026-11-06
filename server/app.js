import express from 'express';
import cookieParser from 'cookie-parser';
import { BODY_LIMIT } from './config/constants.js';
import { sendEmail as defaultSendEmail } from './lib/email.js';
import { loginLimiter } from './lib/rateLimit.js';
import { requireAuth } from './middleware/auth.js';
import { securityHeaders, requestLogger } from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createAuthService } from './services/auth.service.js';
import { createDemoService } from './services/demo.service.js';
import { createExpenseService } from './services/expense.service.js';
import { createAuthController } from './controllers/auth.controller.js';
import { createExpenseController } from './controllers/expense.controller.js';
import { apiRoutes } from './routes/index.js';

/**
 * Builds the Express app. Everything it depends on is passed in, so tests can hand it
 * in-memory fake models and a fake email sender instead of a real database and inbox.
 *
 *   request -> middleware -> routes -> controllers (HTTP) -> services (rules + database) -> models
 *
 * LoginAttempt is optional: with it, failed-login counts are kept in MongoDB instead of memory.
 */
export function createApp({ User, Expense, LoginAttempt, secret, log = false, dbReady = () => true, sendEmail = defaultSendEmail, appUrl = '' }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Render's proxy, so req.ip is the real visitor, not the proxy

  app.use(securityHeaders);
  if (log) app.use(requestLogger);
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(cookieParser());

  // Wire the layers together once.
  const limiter = loginLimiter({ LoginAttempt });
  const authService = createAuthService({ User, limiter, sendEmail });
  const expenseService = createExpenseService({ Expense });
  const deps = {
    dbReady,
    requireAuth: requireAuth(secret, User),
    authController: createAuthController({ authService, demoService: createDemoService({ User, Expense, limiter }), secret, appUrl }),
    expenseController: createExpenseController({ expenseService }),
  };

  app.use('/api', apiRoutes(deps));
  app.use(errorHandler);
  return app;
}
