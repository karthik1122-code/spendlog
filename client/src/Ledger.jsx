import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, dayHeading, rupees } from './format.js';

// The transactions list: search (press / to jump to it), category filters, edit in place, page buttons.
export default function Ledger({ data, filter, onFilter, query, onQuery, searching, onPage, onEdit, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: '', amount: '', category: 'Food' });
  const [editError, setEditError] = useState('');
  const searchRef = useRef(null);

  // Pressing "/" anywhere (outside a form field) focuses the search box.
  useEffect(() => {
    const onKey = e => {
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  return (
    <section className="ledger card" aria-busy={!data}>
      <div className="ledger-head">
        <h2>Transactions</h2>
        <div className="search-wrap">
          <input ref={searchRef} className="search" type="search" aria-label="Search expenses" placeholder="Search all months" value={query} onChange={e => onQuery(e.target.value)} />
          <kbd aria-hidden="true">/</kbd>
        </div>
        <a className="chip export" href="/api/expenses.csv" download>Export CSV</a>
      </div>

      <div className="filters" role="group" aria-label="Filter by category">
        <button className={!filter ? 'chip on' : 'chip'} onClick={() => onFilter(null)}>All</button>
        {CATEGORIES.map(c => <button key={c} className={filter === c ? 'chip on' : 'chip'} onClick={() => onFilter(filter === c ? null : c)}><i className={'dot ' + c} />{c}</button>)}
      </div>

      {searching && data && <p className="muted found">{data.total} {data.total === 1 ? 'match' : 'matches'} across all months</p>}

      {!data ? (
        <ul className="skeletons" aria-hidden="true">{[0, 1, 2, 3].map(i => <li key={i} />)}</ul>
      ) : data.items.length === 0 ? (
        <p className="empty">{searching ? 'Nothing matches that search.' : filter ? `No ${filter} expenses in this month.` : 'Nothing logged this month. Add what you bought above, even a ₹20 chai.'}</p>
      ) : (
        <>
          <div className="row head" aria-hidden="true"><span>Date</span><span>Description</span><span>Category</span><span className="num">Amount</span><span /></div>
          <ul className="rows">
            {data.items.map(x => editingId === x._id ? (
              <li key={x._id} className="row editing">
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
              <li key={x._id} className="row">
                <span className="when-cell">{dayHeading(x.date)}</span>
                <span className="desc">{x.title}</span>
                <span className="cat-cell"><i className={'dot ' + x.category} />{x.category}</span>
                <b className="num">{rupees(x.amount)}</b>
                <span className="actions">
                  <button className="del" aria-label={'Edit ' + x.title} onClick={() => startEdit(x)}>✎</button>
                  <button className="del" aria-label={'Delete ' + x.title} onClick={() => onDelete(x)}>×</button>
                </span>
              </li>
            ))}
          </ul>
        </>
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
