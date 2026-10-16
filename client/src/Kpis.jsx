import { monthLabel, rupees, shiftMonth } from './format.js';

// Four headline cards: spent (with change vs last month), budget, daily average, top category.
export default function Kpis({ summary, month, budget, budgetInput, onBudgetInput, onSaveBudget }) {
  const total = summary?.total ?? 0;
  const previous = summary?.history.find(h => h.month === shiftMonth(month, -1));
  const change = previous && previous.total > 0 ? Math.round(((total - previous.total) / previous.total) * 100) : null;
  const used = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
  const over = budget > 0 && total > budget;
  const topShare = summary?.topCategory ? Math.round((summary.byCategory[summary.topCategory] / total) * 100) : null;

  return (
    <section className="kpis" aria-label="This month at a glance" aria-busy={!summary}>
      <article className="card kpi">
        <h2>Spent in {monthLabel(month, { month: 'long' })}</h2>
        <p className={summary ? 'figure' : 'figure skeleton'}>{summary ? rupees(total) : '₹0,000.00'}</p>
        <p className="muted">
          {change === null ? (summary ? `${summary.count} ${summary.count === 1 ? 'expense' : 'expenses'}` : 'Loading…')
            : <span className={change > 0 ? 'up' : 'down'}>{change > 0 ? '▲' : change < 0 ? '▼' : '–'} {Math.abs(change)}%</span>}
          {change !== null && <> vs {monthLabel(shiftMonth(month, -1), { month: 'short' })}</>}
        </p>
      </article>

      <article className="card kpi">
        <h2>Budget</h2>
        {budget > 0 ? (
          <>
            <p className={over ? 'figure err' : 'figure'}>{over ? `−${rupees(total - budget)}` : rupees(budget - total)}</p>
            <div className="budget-bar" role="progressbar" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={Math.min(total, budget)} aria-label="Share of monthly budget spent">
              <span className={over ? 'budget-fill over' : 'budget-fill'} style={{ width: used + '%' }} />
            </div>
            <p className="muted">{over ? 'over' : 'left of'} {rupees(budget)}</p>
          </>
        ) : <p className="muted">No monthly budget yet.</p>}
        <form className="budget-form" onSubmit={onSaveBudget}>
          <input aria-label="Monthly budget in rupees" type="number" min="0" step="1" inputMode="numeric" placeholder="₹ per month" value={budgetInput} onChange={e => onBudgetInput(e.target.value)} />
          <button className="chip">{budget > 0 ? 'Update' : 'Set'}</button>
        </form>
      </article>

      <article className="card kpi">
        <h2>Daily average</h2>
        <p className={summary ? 'figure' : 'figure skeleton'}>{summary ? rupees(summary.perDay) : '₹000.00'}</p>
        <p className="muted">{summary?.biggest ? `Biggest: ${summary.biggest.title}, ${rupees(summary.biggest.amount)}` : 'Nothing spent yet'}</p>
      </article>

      <article className="card kpi">
        <h2>Top category</h2>
        <p className="figure plain">{summary?.topCategory ? <><i className={'dot ' + summary.topCategory} />{summary.topCategory}</> : '–'}</p>
        <p className="muted">{topShare !== null ? `${topShare}% of this month` : 'Add an expense to see it'}</p>
      </article>
    </section>
  );
}
