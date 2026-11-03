import { AppError } from '../lib/AppError.js';

// Last stop for errors thrown in any route (Express 5 forwards async errors here).
// AppError carries its own status; known library errors get a clear message; anything else is a 500.
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' });
  if (err.name === 'CastError') return res.status(404).json({ error: 'Expense not found' }); // malformed id
  if (err.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors)[0].message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
}
