import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { setLoginCookie, clearLoginCookie, requireAuth } from './auth.js';
import { CATEGORIES } from './constants.js';
import { loginLimiter } from './rateLimit.js';
import { toCsv } from './csv.js';
import { buildSummary, escapeRegex, isMonthKey, monthKeyAt, monthRange, readTz, shiftMonth } from './queries.js';

// Check and clean the fields of an expense. Returns { error } or { value }.
function readExpense(body = {}) {
  const title = String(body.title || '').trim();
  const amount = Number(body.amount);
  const category = body.category || 'Other';
  if (!title || !(amount > 0)) return { error: 'Title and a positive amount are required' };
  if (!CATEGORIES.includes(category)) return { error: 'Pick a valid category' };
  const value = { title, amount, category };
  if (body.date) {
    const date = new Date(body.date);
    if (Number.isNaN(date.getTime())) return { error: 'That date is not valid' };
    if (date.getTime() > Date.now() + 24 * 3600 * 1000) return { error: 'The date cannot be in the future' };
    value.date = date;
  }
  return { value };
}

// The models are passed in so tests can use in-memory fakes instead of a real database.
export function createApp({ User, Expense, secret, log = false }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Render's proxy, so req.ip is the real visitor, not the proxy

  // Basic security headers on every response.
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
    next();
  });
  // One log line per request: method, path, status and how long it took.
  if (log) {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => console.log(`${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - started}ms`));
      next();
    });
  }
  app.use(express.json());
  app.use(cookieParser());
  const auth = requireAuth(secret);
  const limiter = loginLimiter();

  // Cheap route that says the server is up (used by uptime checks).
  app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: Math.round(process.uptime()) }));

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
  // One page of expenses. Filtering, searching and paging all happen in the database.
  // ?month=2026-10 &category=Food &q=chai (search covers every month) &page=2 &limit=10 &tz=-330
  app.get('/api/expenses', auth, async (req, res) => {
    const { month, category, q } = req.query;
    const tz = readTz(req.query.tz);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    const filter = { user: req.userId };
    if (CATEGORIES.includes(category)) filter.category = category;
    if (typeof q === 'string' && q.trim()) {
      filter.title = { $regex: escapeRegex(q.trim().slice(0, 60)), $options: 'i' };
    } else if (isMonthKey(month)) {
      const { start, end } = monthRange(month, tz);
      filter.date = { $gte: start, $lt: end };
    }

    const [items, total] = await Promise.all([
      Expense.find(filter).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
      Expense.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  });

  // Totals for one month plus the last six months, so the page never downloads every expense.
  app.get('/api/summary', auth, async (req, res) => {
    const tz = readTz(req.query.tz);
    const current = monthKeyAt(new Date(), tz);
    const month = isMonthKey(req.query.month) ? req.query.month : current;
    const from = monthRange([shiftMonth(current, -5), month].sort()[0], tz).start;
    const to = monthRange([current, month].sort()[1], tz).end;
    const expenses = await Expense.find({ user: req.userId, date: { $gte: from, $lt: to } });
    res.json(buildSummary(expenses, month, tz));
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
