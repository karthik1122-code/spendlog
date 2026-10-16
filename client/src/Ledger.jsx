import { useState } from 'react';
import { CATEGORIES, dayHeading, rupees } from './format.js';

// The list: search, category filter, rows grouped by day, inline edit, and page buttons.
export default function Ledger({ data, filter, onFilter, query, onQuery, searching, onPage, onEdit, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: '', amount: '', category: 'Food' });
  const [editError, setEditError] = useState('');

  function startEdit(x) {
    setEditingId(x._id);
    setEditError('');
    setDraft({ title: x.title, amount: String(x.amount), category: x.category });
  }

  async function save(e) {
    e.preventDefault();
    try {
      await onEdit(editingId, draft);
      setEditingId(null);
    } catch (err) {
      setEditError(err.message);
    }
  }

  // The server already sorted newest first, so consecutive rows from the same day share a heading.
  const groups = [];
  for (const x of data?.items ?? []) {
    const heading = dayHeading(x.date);
    if (groups.at(-1)?.heading === heading) groups.at(-1).rows.push(x);
    else groups.push({ heading, rows: [x] });
  }

  return (
    <section className="ledger card" aria-busy={!data}>
      <input className="search" type="search" aria-label="Search expenses" placeholder="Search all months" value={query} onChange={e => onQuery(e.target.value)} />
      <div className="filters" role="group" aria-label="Filter by category">
        <button className={!filter ? 'chip on' : 'chip'} onClick={() => onFilter(null)}>All</button>
        {CATEGORIES.map(c => <button key={c} className={filter === c ? 'chip on' : 'chip'} onClick={() => onFilter(filter === c ? null : c)}><i className={'dot ' + c} />{c}</button>)}
        <a className="chip export" href="/api/expenses.csv" download>Export CSV</a>
      </div>

      {searching && data && <p className="muted found">{data.total} {data.total === 1 ? 'match' : 'matches'} across all months</p>}

      {!data ? (
        <ul className="skeletons" aria-hidden="true">{[0, 1, 2].map(i => <li key={i} />)}</ul>
      ) : data.items.length === 0 ? (
        <p className="empty">{searching ? 'Nothing matches that search.' : filter ? `No ${filter} expenses in this month.` : 'Nothing logged this month. Add what you bought above, even a ₹20 chai.'}</p>
      ) : (
        groups.map(g => (
          <div key={g.heading} className="day">
            <h3>{g.heading}</h3>
            <ul>
              {g.rows.map(x => editingId === x._id ? (
                <li key={x._id} className="line">
                  <form className="edit-row" onSubmit={save}>
                    <input aria-label="Title" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} required />
                    <input aria-label="Amount in rupees" type="number" step="0.01" min="0.01" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} required />
                    <select aria-label="Category" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                    <button className="primary">Save</button>
                    <button type="button" className="link" onClick={() => setEditingId(null)}>Cancel</button>
                    {editError && <p className="error" role="alert">{editError}</p>}
                  </form>
                </li>
              ) : (
                <li key={x._id} className="line">
                  <span className="what"><i className={'dot ' + x.category} />{x.title}</span>
                  <span className="leader" aria-hidden="true" />
                  <b>{rupees(x.amount)}</b>
                  <span className="actions">
                    <button className="del" aria-label={'Edit ' + x.title} onClick={() => startEdit(x)}>✎</button>
                    <button className="del" aria-label={'Delete ' + x.title} onClick={() => onDelete(x)}>×</button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}

      {data && data.pages > 1 && (
        <nav className="pager" aria-label="Pages">
          <button className="chip" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</button>
          <span className="muted">Page {data.page} of {data.pages}</span>
          <button className="chip" disabled={data.page >= data.pages} onClick={() => onPage(data.page + 1)}>Next</button>
        </nav>
      )}
    </section>
  );
}
