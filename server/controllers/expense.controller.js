import { readTz } from '../lib/dates.js';
import { toCsv } from '../lib/csv.js';

// HTTP layer for expenses. ?tz= is the browser's offset in minutes, so month edges follow the user's clock.
export function createExpenseController({ expenseService }) {
  return {
    async list(req, res) {
      res.json(await expenseService.list(req.userId, req.query, readTz(req.query.tz)));
    },
    async summary(req, res) {
      res.json(await expenseService.summary(req.userId, req.query.month, readTz(req.query.tz)));
    },
    async exportCsv(req, res) {
      const list = await expenseService.all(req.userId);
      res.type('text/csv').attachment('spendlog-expenses.csv').send(toCsv(list));
    },
    async create(req, res) {
      res.status(201).json(await expenseService.create(req.userId, req.body));
    },
    async update(req, res) {
      res.json(await expenseService.update(req.userId, req.params.id, req.body));
    },
    async remove(req, res) {
      await expenseService.remove(req.userId, req.params.id);
      res.json({ ok: true });
    },
  };
}
