import { CATEGORIES } from '../config/constants.js';

// Check and clean the fields of an expense. Returns { error } or { value }.
export function readExpense(body = {}) {
  const title = String(body.title || '').trim();
  const amount = Number(body.amount);
  const category = body.category || 'Other';
  if (!title || !(amount > 0)) return { error: 'Title and a positive amount are required' };
  if (title.length > 120) return { error: 'Keep the title under 120 characters' };
  if (amount > 1e9) return { error: 'That amount is too large' };
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

// Turn ?page=&limit= into safe numbers.
export function readPaging(query, { defaultLimit, maxLimit }) {
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  return { page, limit };
}
