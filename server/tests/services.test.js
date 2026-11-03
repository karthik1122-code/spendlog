// Services have no Express code, so they can be tested by calling them directly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpenseService } from '../services/expense.service.js';
import { AppError } from '../lib/AppError.js';
import { readExpense, readPaging } from '../validators/expense.validator.js';

test('expense validator rejects bad input and cleans good input', () => {
  assert.equal(readExpense({ title: '', amount: 10 }).error, 'Title and a positive amount are required');
  assert.equal(readExpense({ title: 'Chai', amount: -5 }).error, 'Title and a positive amount are required');
  assert.equal(readExpense({ title: 'Chai', amount: 20, category: 'Nope' }).error, 'Pick a valid category');
  assert.deepEqual(readExpense({ title: '  Chai ', amount: '20' }).value, { title: 'Chai', amount: 20, category: 'Other' });
  assert.deepEqual(readPaging({ page: '0', limit: '999' }, { defaultLimit: 10, maxLimit: 50 }), { page: 1, limit: 50 });
});

test('expense service throws AppError with the right status', async () => {
  const Expense = {
    create: async d => ({ ...d, _id: 'e1' }),
    findOneAndDelete: async () => null,
    findOneAndUpdate: async () => null,
  };
  const service = createExpenseService({ Expense });
  await assert.rejects(service.create('u1', { title: '', amount: 1 }), e => e instanceof AppError && e.status === 400);
  await assert.rejects(service.remove('u1', 'missing'), e => e instanceof AppError && e.status === 404);
  await assert.rejects(service.update('u1', 'missing', { title: 'X', amount: 1 }), e => e.status === 404);
  assert.equal((await service.create('u1', { title: 'Lunch', amount: 150, category: 'Food' })).user, 'u1');
});
