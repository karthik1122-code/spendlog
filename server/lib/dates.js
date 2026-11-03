// Pure helpers for dates, filters and summaries. No database in here, so they are easy to unit test.

// Escape characters that mean something in a regular expression, so a search for "(" cannot crash the query.
export const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The browser sends its time-zone offset in minutes (India is -330). Month edges must follow the user's clock, not UTC.
export const readTz = value => {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) <= 840 ? Math.trunc(n) : 0;
};

export const isMonthKey = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value));

// 'YYYY-MM' for a moment, as seen on the user's clock.
export const monthKeyAt = (date, tz) => new Date(new Date(date).getTime() - tz * 60000).toISOString().slice(0, 7);

export const shiftMonth = (key, by) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
};

// [start, end) of a month in real UTC moments, for a user with the given offset.
export function monthRange(key, tz) {
  const [y, m] = key.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1) + tz * 60000), end: new Date(Date.UTC(y, m, 1) + tz * 60000) };
}

export const daysInMonth = key => { const [y, m] = key.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

// Everything the summary panel needs, worked out from a list of expenses.
export function buildSummary(expenses, month, tz, now = new Date()) {
  const current = monthKeyAt(now, tz);
  const totals = new Map();
  for (const e of expenses) {
    const k = monthKeyAt(e.date, tz);
    totals.set(k, (totals.get(k) || 0) + e.amount);
  }

  const inMonth = expenses.filter(e => monthKeyAt(e.date, tz) === month);
  const byCategory = {};
  let total = 0;
  let biggest = null;
  for (const e of inMonth) {
    total += e.amount;
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    if (!biggest || e.amount > biggest.amount) biggest = { title: e.title, amount: e.amount };
  }
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const dayOfMonth = new Date(new Date(now).getTime() - tz * 60000).getUTCDate();
  const daysCounted = month === current ? dayOfMonth : daysInMonth(month);
  const history = Array.from({ length: 6 }, (_, i) => {
    const key = shiftMonth(current, i - 5);
    return { month: key, total: totals.get(key) || 0 };
  });

  return { month, current, total, count: inMonth.length, byCategory, biggest, topCategory, perDay: total / daysCounted, history };
}
