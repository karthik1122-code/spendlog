// Turn expenses into CSV text for download.
// Values starting with = + - @ would run as formulas in Excel, so we put a quote in front of them.
const cell = value => {
  let s = String(value ?? '');
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};

export function toCsv(expenses) {
  const rows = expenses.map(e => [new Date(e.date).toISOString().slice(0, 10), e.title, e.category, e.amount]);
  return [['date', 'title', 'category', 'amount'], ...rows].map(r => r.map(cell).join(',')).join('\n');
}
