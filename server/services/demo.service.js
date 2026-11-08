import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { tooMany } from '../lib/AppError.js';

export const DEMO_DOMAIN = 'demo.spendlog.app';
export const DEMO_TTL_MS = 24 * 60 * 60 * 1000; // demo accounts are deleted a day after they are made

// A believable student month: [title, rupees, category, day of month]. Days after today are moved to today.
const THIS_MONTH = [
  ['Mess snacks', 60, 'Food', 1], ['Metro card recharge', 500, 'Travel', 2], ['Chai and samosa', 40, 'Food', 3],
  ['Data structures book', 450, 'Study', 4], ['Lunch with friends', 320, 'Food', 6], ['Auto to college', 90, 'Travel', 7],
  ['Movie ticket', 250, 'Fun', 9], ['Printouts for lab', 60, 'Study', 10], ['Swiggy dinner', 280, 'Food', 12],
  ['Rapido to station', 140, 'Travel', 14], ['Spotify', 59, 'Fun', 15], ['Coffee', 120, 'Food', 17],
  ['Notebook and pens', 180, 'Study', 19], ['Haircut', 150, 'Other', 21], ['Pizza night', 420, 'Food', 23],
];
// Rough totals for the five months before, so the six-month chart has a shape.
const EARLIER = [[3900, 'Food'], [4600, 'Travel'], [3400, 'Study'], [5200, 'Fun'], [4300, 'Food']];

export function sampleExpenses(userId, nowMs) {
  const now = new Date(nowMs);
  const y = now.getFullYear(), m = now.getMonth(), today = now.getDate();
  const rows = THIS_MONTH.map(([title, amount, category, day]) => ({ user: userId, title, amount, category, date: new Date(y, m, Math.min(day, today), 12) }));
  EARLIER.forEach(([total, category], i) => {
    const month = m - (i + 1);
    rows.push({ user: userId, title: 'Rent share and bills', amount: Math.round(total * 0.6), category: 'Other', date: new Date(y, month, 5, 12) });
    rows.push({ user: userId, title: `${category} spends`, amount: Math.round(total * 0.4), category, date: new Date(y, month, 18, 12) });
  });
  return rows;
}

// "Try the demo": a fresh, private account per visitor, filled with sample data, so no one sees anyone else's edits.
export function createDemoService({ User, Expense, limiter, now = () => Date.now() }) {
  return {
    async create(ip) {
      const key = `demo|${ip}`;
      if (await limiter.blocked(key)) throw tooMany('Too many demo accounts from this network. Try again in 15 minutes');
      await limiter.fail(key); // counts demos per network, so one visitor cannot fill the database
      await this.cleanup();
      const user = await User.create({
        email: `demo-${crypto.randomBytes(6).toString('hex')}@${DEMO_DOMAIN}`,
        passwordHash: await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 4), // random and never shown: no one can log in with it
        budget: 6000,
        demo: true,
        createdAt: new Date(now()),
      });
      await Expense.insertMany(sampleExpenses(user.id ?? user._id, now()));
      return user;
    },
    // Deletes demo accounts older than a day, with their expenses.
    async cleanup() {
      const old = await User.find({ demo: true, createdAt: { $lt: new Date(now() - DEMO_TTL_MS) } });
      if (!old.length) return 0;
      const ids = old.map(u => u.id ?? u._id);
      await Expense.deleteMany({ user: { $in: ids } });
      await User.deleteMany({ _id: { $in: ids } });
      return ids.length;
    },
  };
}
