import { CATEGORIES, monthLabel, rupees } from './format.js';

// Two charts: spending over the last six months (click a bar to open that month) and the split by category.
export default function Insights({ summary, month, onMonth }) {
  const peak = Math.max(...(summary?.history.map(h => h.total) ?? [0]), 1);
  const split = summary ? CATEGORIES.map(c => ({ c, v: summary.byCategory[c] || 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v) : [];

  return (
    <section className="insights">
      <article className="card">
        <h2>Last six months</h2>
        {!summary ? <div className="chart-skeleton" /> : (
          <div className="history" role="group" aria-label="Spending in the last six months">
            {summary.history.map(h => (
              <button key={h.month} className={h.month === month ? 'col on' : 'col'} aria-pressed={h.month === month}
                aria-label={`${monthLabel(h.month, { month: 'long', year: 'numeric' })}: ${rupees(h.total)}`} onClick={() => onMonth(h.month)}>
                <span className="col-value">{h.total > 0 ? '₹' + Math.round(h.total).toLocaleString('en-IN') : ''}</span>
                <span className="col-bar" style={{ height: Math.max(4, (h.total / peak) * 100) + '%' }} />
                <small>{monthLabel(h.month, { month: 'short' })}</small>
              </button>
            ))}
          </div>
        )}
      </article>

      <article className="card">
        <h2>Where it went</h2>
        {split.length === 0 ? <p className="empty small">{summary ? 'No spending in this month yet.' : 'Loading…'}</p> : (
          <ul className="split">
            {split.map(x => (
              <li key={x.c}>
                <span className="split-name"><i className={'dot ' + x.c} />{x.c}</span>
                <span className="split-track"><span className={'seg ' + x.c} style={{ width: (x.v / summary.total) * 100 + '%' }} /></span>
                <b>{rupees(x.v)}</b>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
