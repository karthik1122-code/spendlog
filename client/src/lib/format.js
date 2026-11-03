export const CATEGORIES = ['Food', 'Travel', 'Study', 'Fun', 'Other'];

export const rupees = n => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pad = n => String(n).padStart(2, '0');

// Months are 'YYYY-MM' keys, e.g. '2026-10': easy to compare, shift and send to the server.
export const monthKey = d => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}`; };
export const shiftMonth = (key, by) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + by, 1)); };
export const monthLabel = (key, opts) => new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1).toLocaleString('en-IN', opts);

// Value for <input type="date"> (today, on the user's clock).
export const todayInput = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// Noon on a chosen day, as an ISO string. Noon stays on the same calendar day in every time zone.
export const atNoon = dateInput => { const [y, m, d] = dateInput.split('-').map(Number); return new Date(y, m - 1, d, 12).toISOString(); };

// "Today", "Yesterday" or "12 Oct" for the day headings in the list.
export function dayHeading(date) {
  const d = new Date(date);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
