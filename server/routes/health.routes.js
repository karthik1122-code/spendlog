import { Router } from 'express';

// Cheap route that says the server is up (used by uptime checks).
// Reports 503 when the database is unreachable, so the host stops sending traffic and restarts the app.
export function healthRoutes({ dbReady }) {
  const router = Router();
  router.get('/health', (req, res) => {
    const db = dbReady() ? 'ok' : 'down';
    res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()) });
  });
  return router;
}
