import { CATEGORIES, monthLabel, rupees, shiftMonth } from './format.js';

// The left panel: month picker, total, split by category, stats, six-month chart and the budget.
export default function Summary({ summary, month, currentMonth, onMonth, budget, budgetInput, onBudgetInput, onSaveBudget }) {
  const total = summary?.total ?? 0;
  const split = summary ? CATEGORIES.map(c => ({ c, v: summary.byCategory[c] || 0 })).filter(x => x.v > 0) : [];
  const peak = Math.max(...(summary?.history.map(h => h.total) ?? [0]), 1);
  const used = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
  const over = budget > 0 && total > budget;

  return (
    <section className="summary card" aria-busy={!summary}>
      <div className="month-nav">
        <button className="nav" aria-label="Previous month" onClick={() => onMonth(shiftMonth(month, -1))}>‹</button>
        <p className="eyebrow">{monthLabel(month, { month: 'long', year: 'numeric' })}</p>
        <button className="nav" aria-label="Next month" disabled={month === currentMonth} onClick={() => onMonth(shiftMonth(month, 1))}>›</button>
      </div>

      <p className={summary ? 'total' : 'total skeleton'}>{summary ? rupees(total) : '₹0,000.00'}</p>
      <p className="muted">{summary ? `${summary.count} ${summary.count === 1 ? 'expense' : 'expenses'}` : 'Loading…'}</p>

      {split.length > 0 && (
        <>
          <div className="bar" role="img" aria-label={'Spending split: ' + split.map(x => `${x.c} ${rupees(x.v)}`).join(', ')}>
            {split.map(x => <span key={x.c} className={'seg ' + x.c} style={{ flexGrow: x.v }} />)}
          </div>
          <ul className="legend">
            {split.map(x => <li key={x.c}><i className={'dot ' + x.c} />{x.c} <b>{rupees(x.v)}</b> <small>{Math.round((x.v / total) * 100)}%</small></li>)}
          </ul>
        </>
      )}

      {summary && summary.count > 0 && (
        <dl className="stats">
          <div><dt>Daily average</dt><dd>{rupees(summary.perDay)}</dd></div>
          <div><dt>Biggest</dt><dd>{rupees(summary.biggest.amount)}</dd><small>{summary.biggest.title}</small></div>
          <div><dt>Top category</dt><dd>{summary.topCategory}</dd></div>
        </dl>
      )}

      {summary && (
        <div className="history" role="group" aria-label="Spending in the last six months">
          {summary.history.map(h => (
            <button key={h.month} className={h.month === month ? 'col on' : 'col'} aria-pressed={h.month === month}
              aria-label={`${monthLabel(h.month, { month: 'long', year: 'numeric' })}: ${rupees(h.total)}`} onClick={() => onMonth(h.month)}>
              <span className="col-bar" style={{ height: Math.max(4, (h.total / peak) * 100) + '%' }} />
              <small>{monthLabel(h.month, { month: 'short' })}</small>
            </button>
          ))}
        </div>
      )}

      <div className="budget">
        {budget > 0 && (
          <>
            <div className="budget-bar" role="progressbar" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={Math.min(total, budget)} aria-label="Share of monthly budget spent">
              <span className={over ? 'budget-fill over' : 'budget-fill'} style={{ width: used + '%' }} />
            </div>
            <p className={over ? 'error' : 'muted'}>
              {over ? `Over budget by ${rupees(total - budget)}` : `${rupees(budget - total)} left of your ${rupees(budget)} budget`}
            </p>
          </>
        )}
        <form className="budget-form" onSubmit={onSaveBudget}>
          <input aria-label="Monthly budget in rupees" type="number" min="0" step="1" inputMode="numeric" placeholder="Monthly budget (₹)" value={budgetInput} onChange={e => onBudgetInput(e.target.value)} />
          <button className="chip">{budget > 0 ? 'Update' : 'Set budget'}</button>
        </form>
      </div>
    </section>
  );
}
