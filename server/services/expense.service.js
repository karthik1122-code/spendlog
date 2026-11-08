import { CATEGORIES, PAGE } from '../config/constants.js';
import { badRequest, notFound } from '../lib/AppError.js';
import { buildSummary, escapeRegex, isMonthKey, monthKeyAt, monthRange, shiftMonth } from '../lib/dates.js';
import { readExpense, readPaging } from '../validators/expense.validator.js';

// Expenses for one user. Every query includes the user's id, so nobody can read or change another user's data.
export function createExpenseService({ Expense }) {
  return {
    // One page of expenses. Filtering, searching and paging all happen in the database.
    async list(userId, query, tz) {
      const { month, category, q } = query;
      const { page, limit } = readPaging(query, PAGE);
      const filter = { user: userId };
      if (CATEGORIES.includes(category)) filter.category = category;
      if (typeof q === 'string' && q.trim()) {
        filter.title = { $regex: escapeRegex(q.trim().slice(0, 60)), $options: 'i' }; // search covers every month
      } else if (isMonthKey(month)) {
        const { start, end } = monthRange(month, tz);
        filter.date = { $gte: start, $lt: end };
      }
      const [items, total] = await Promise.all([
        Expense.find(filter).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
        Expense.countDocuments(filter),
      ]);
      return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
    },

    // Totals for one month plus the last six months, so the page never downloads every expense.
    async summary(userId, requestedMonth, tz) {
      const current = monthKeyAt(new Date(), tz);
      const month = isMonthKey(requestedMonth) ? requestedMonth : current;
      const from = monthRange([shiftMonth(current, -5), month].sort()[0], tz).start;
      const to = monthRange([current, month].sort()[1], tz).end;
      const expenses = await Expense.find({ user: userId, date: { $gte: from, $lt: to } });
      return buildSummary(expenses, month, tz);
    },

    all: userId => Expense.find({ user: userId }).sort({ date: -1 }),

    async create(userId, body) {
      const { error, value } = readExpense(body);
      if (error) throw badRequest(error);
      return Expense.create({ user: userId, ...value });
    },

    async update(userId, id, body) {
      const { error, value } = readExpense(body);
      if (error) throw badRequest(error);
      const updated = await Expense.findOneAndUpdate({ _id: id, user: userId }, value, { new: true, runValidators: true });
      if (!updated) throw notFound('Expense not found');
      return updated;
    },

    async remove(userId, id) {
      const gone = await Expense.findOneAndDelete({ _id: id, user: userId });
      if (!gone) throw notFound('Expense not found');
    },
  };
}
