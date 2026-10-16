import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { setLoginCookie, clearLoginCookie, requireAuth } from './auth.js';
import { CATEGORIES } from './constants.js';
import { loginLimiter } from './rateLimit.js';
import { toCsv } from './csv.js';

// Check and clean the fields of an expense. Returns { error } or { value }.
function readExpense(body = {}) {
  const title = String(body.title || '').trim();
  const amount = Number(body.amount);
  const category = body.category || 'Other';
  if (!title || !(amount > 0)) return { error: 'Title and a positive amount are required' };
  if (!CATEGORIES.includes(category)) return { error: 'Pick a valid category' };
  return { value: { title, amount, category } };
}

// The models are passed in so tests can use in-memory fakes instead of a real database.
export function createApp({ User, Expense, secret }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const auth = requireAuth(secret);
  const limiter = loginLimiter();

  // ---- Accounts ----
  app.post('/api/register', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Email and a password of at least 6 characters are required' });
    }
    if (await User.findOne({ email })) return res.status(409).json({ error: 'That email is already registered' });
    const user = await User.create({ email, passwordHash: await bcrypt.hash(password, 10) });
    setLoginCookie(res, user.id, secret);
    res.status(201).json({ email: user.email, budget: 0 });
  });

  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body || {};
    const key = `${req.ip}|${String(email).toLowerCase()}`;
    if (limiter.blocked(key)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes' });
    const user = email && (await User.findOne({ email }));
    // Same message for "no such user" and "wrong password" so attackers learn nothing.
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      limiter.fail(key);
      return res.status(401).json({ error: 'Wrong email or password' });
    }
    limiter.clear(key);
    setLoginCookie(res, user.id, secret);
    res.json({ email: user.email, budget: user.budget || 0 });
  });

  app.post('/api/logout', (req, res) => { clearLoginCookie(res); res.json({ ok: true }); });

  // Who is logged in? The page calls this on load so a refresh keeps you signed in.
  app.get('/api/me', auth, async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: 'Please log in' });
    res.json({ email: user.email, budget: user.budget || 0 });
  });

  // ---- Monthly budget ----
  app.put('/api/budget', auth, async (req, res) => {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'Budget must be zero or more' });
    const user = await User.findByIdAndUpdate(req.userId, { budget: amount }, { new: true });
    res.json({ budget: user.budget });
  });

  // ---- Expenses (every route below needs a logged-in user) ----
  app.get('/api/expenses', auth, async (req, res) => {
    res.json(await Expense.find({ user: req.userId }).sort({ date: -1 }));
  });

  app.get('/api/expenses.csv', auth, async (req, res) => {
    const list = await Expense.find({ user: req.userId }).sort({ date: -1 });
    res.type('text/csv').attachment('spendlog-expenses.csv').send(toCsv(list));
  });

  app.post('/api/expenses', auth, async (req, res) => {
    const { error, value } = readExpense(req.body);
    if (error) return res.status(400).json({ error });
    res.status(201).json(await Expense.create({ user: req.userId, ...value }));
  });

  // Filtering by user means you can only edit or delete your own expenses.
  app.put('/api/expenses/:id', auth, async (req, res) => {
    const { error, value } = readExpense(req.body);
    if (error) return res.status(400).json({ error });
    const updated = await Expense.findOneAndUpdate({ _id: req.params.id, user: req.userId }, value, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ error: 'Expense not found' });
    res.json(updated);
  });

  app.delete('/api/expenses/:id', auth, async (req, res) => {
    const gone = await Expense.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!gone) return res.status(404).json({ error: 'Expense not found' });
    res.json({ ok: true });
  });

  // Last stop for errors thrown in any route (Express 5 forwards async errors here).
  app.use((err, req, res, next) => {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Expense not found' }); // malformed id
    if (err.name === 'ValidationError') return res.status(400).json({ error: Object.values(err.errors)[0].message });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}
