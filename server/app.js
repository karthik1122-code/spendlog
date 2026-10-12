import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { setLoginCookie, clearLoginCookie, requireAuth } from './auth.js';

// The models are passed in so tests can use in-memory fakes instead of a real database.
export function createApp({ User, Expense, secret }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const auth = requireAuth(secret);

  // ---- Accounts ----
  app.post('/api/register', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Email and a password of at least 6 characters are required' });
    }
    if (await User.findOne({ email })) return res.status(409).json({ error: 'That email is already registered' });
    const user = await User.create({ email, passwordHash: await bcrypt.hash(password, 10) });
    setLoginCookie(res, user.id, secret);
    res.status(201).json({ email: user.email });
  });

  app.post('/api/login', async (req, res) => {
    const { email, password } = req.body || {};
    const user = email && (await User.findOne({ email }));
    // Same message for "no such user" and "wrong password" so attackers learn nothing.
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }
    setLoginCookie(res, user.id, secret);
    res.json({ email: user.email });
  });

  app.post('/api/logout', (req, res) => { clearLoginCookie(res); res.json({ ok: true }); });

  // ---- Expenses (every route below needs a logged-in user) ----
  app.get('/api/expenses', auth, async (req, res) => {
    res.json(await Expense.find({ user: req.userId }).sort({ date: -1 }));
  });

  app.post('/api/expenses', auth, async (req, res) => {
    const { title, amount, category } = req.body || {};
    if (!title || !(Number(amount) > 0)) return res.status(400).json({ error: 'Title and a positive amount are required' });
    const expense = await Expense.create({ user: req.userId, title, amount: Number(amount), category });
    res.status(201).json(expense);
  });

  // Filtering by user means you can only delete your own expenses.
  app.delete('/api/expenses/:id', auth, async (req, res) => {
    const gone = await Expense.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!gone) return res.status(404).json({ error: 'Expense not found' });
    res.json({ ok: true });
  });

  return app;
}
