import { useEffect, useState } from 'react';
import { api } from './api.js';

const CATEGORIES = ['Food', 'Travel', 'Study', 'Fun', 'Other'];
const rupees = n => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sum = list => list.reduce((s, x) => s + x.amount, 0);
const PAGE = 10; // how many expenses the list shows at a time

// Months are written as 'YYYY-MM' keys, e.g. '2026-10', so they are easy to compare and shift.
const monthKey = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
const shiftMonth = (key, by) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + by, 1)); };
const monthLabel = (key, opts) => new Date(Number(key.slice(0, 4)), Number(key.slice(5)) - 1, 1).toLocaleString('en-IN', opts);
const daysIn = key => new Date(Number(key.slice(0, 4)), Number(key.slice(5)), 0).getDate();

// A static sample bill that shows what the app does before you sign in.
function SampleBill() {
  const rows = [['Chai', 'Food', 20], ['Metro to college', 'Travel', 45], ['Notebook', 'Study', 60], ['Movie night', 'Fun', 250]];
  return (
    <aside className="bill" aria-hidden="true">
      <p className="bill-head">Today's bill</p>
      {rows.map(([t, c, a]) => (
        <p className="line" key={t}><span><i className={'dot ' + c} />{t}</span><b>{rupees(a)}</b></p>
      ))}
      <p className="line grand"><span>Total</span><b>{rupees(375)}</b></p>
    </aside>
  );
}

function AuthForm({ onLoggedIn }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    try {
      setError('');
      onLoggedIn(await api(mode === 'login' ? '/login' : '/register', 'POST', { email, password }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="welcome">
      <section>
        <h1 className="brand">Spend<span>Log</span></h1>
        <p className="pitch">Know where your pocket money went, one line at a time.</p>
        <SampleBill />
      </section>
      <form className="panel" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Start your ledger'}</h2>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 6 characters" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary">{mode === 'login' ? 'Log in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
        </button>
      </form>
    </div>
  );
}

function Tracker({ user, onLogout }) {
  const [expenses, setExpenses] = useState([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [filter, setFilter] = useState(null);
  const [error, setError] = useState('');
  const [budget, setBudget] = useState(user.budget || 0);
  const [budgetInput, setBudgetInput] = useState(user.budget ? String(user.budget) : '');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: '', amount: '', category: 'Food' });
  const currentMonth = monthKey(new Date());
  const [month, setMonth] = useState(currentMonth);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => { api('/expenses').then(setExpenses).catch(e => setError(e.message)); }, []);

  async function add(e) {
    e.preventDefault();
    try {
      setError('');
      const created = await api('/expenses', 'POST', { title, amount, category });
      setExpenses([created, ...expenses]);
      setTitle(''); setAmount('');
      setMonth(currentMonth); // new expenses are dated today, so jump back to this month
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    try {
      setError('');
      await api('/expenses/' + id, 'DELETE');
      setExpenses(expenses.filter(x => x._id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(x) {
    setEditingId(x._id);
    setDraft({ title: x.title, amount: String(x.amount), category: x.category });
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      setError('');
      const updated = await api('/expenses/' + editingId, 'PUT', draft);
      setExpenses(expenses.map(x => (x._id === editingId ? updated : x)));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveBudget(e) {
    e.preventDefault();
    try {
      setError('');
      const saved = await api('/budget', 'PUT', { amount: budgetInput || 0 });
      setBudget(saved.budget);
    } catch (err) {
      setError(err.message);
    }
  }

  // Everything below is worked out from the one `expenses` list, so nothing extra is stored.
  const monthList = expenses.filter(x => monthKey(x.date) === month);
  const total = sum(monthList);
  const split = CATEGORIES.map(c => ({ c, v: sum(monthList.filter(x => x.category === c)) })).filter(x => x.v > 0);
  const biggest = monthList.reduce((m, x) => (x.amount > (m?.amount ?? 0) ? x : m), null);
  const topCategory = [...split].sort((a, b) => b.v - a.v)[0];
  const perDay = total / (month === currentMonth ? new Date().getDate() : daysIn(month));
  const history = Array.from({ length: 6 }, (_, i) => {
    const key = shiftMonth(currentMonth, i - 5);
    return { key, v: sum(expenses.filter(x => monthKey(x.date) === key)) };
  });
  const peak = Math.max(...history.map(h => h.v), 1);

  const q = query.trim().toLowerCase();
  const pool = q ? expenses : monthList; // a search looks through every month
  const matches = pool.filter(x => (!filter || x.category === filter) && (!q || x.title.toLowerCase().includes(q)));
  const shown = matches.slice(0, limit);
  const goToMonth = key => { setMonth(key); setLimit(PAGE); };
  const used = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
  const over = budget > 0 && total > budget;

  return (
    <main className="tracker">
      <header>
        <h1 className="brand small">Spend<span>Log</span></h1>
        <p className="who">{user.email} <button className="link" onClick={onLogout}>Log out</button></p>
      </header>

      <section className="summary">
        <div className="month-nav">
          <button className="nav" aria-label="Previous month" onClick={() => goToMonth(shiftMonth(month, -1))}>‹</button>
          <p className="eyebrow">{monthLabel(month, { month: 'long', year: 'numeric' })}</p>
          <button className="nav" aria-label="Next month" disabled={month === currentMonth} onClick={() => goToMonth(shiftMonth(month, 1))}>›</button>
        </div>
        <p className="total">{rupees(total)}</p>
        <p className="muted">{month === currentMonth ? 'spent this month' : 'spent that month'} · {rupees(sum(expenses))} all time</p>
        {split.length > 0 && (
          <>
            <div className="bar" role="img" aria-label={'Spending split: ' + split.map(x => `${x.c} ${rupees(x.v)}`).join(', ')}>
              {split.map(x => <span key={x.c} className={'seg ' + x.c} style={{ flexGrow: x.v }} />)}
            </div>
            <ul className="legend">
              {split.map(x => (
                <li key={x.c}><i className={'dot ' + x.c} />{x.c} <b>{rupees(x.v)}</b> <small>{Math.round((x.v / total) * 100)}%</small></li>
              ))}
            </ul>
          </>
        )}
        {monthList.length > 0 && (
          <dl className="stats">
            <div><dt>Daily average</dt><dd>{rupees(perDay)}</dd></div>
            <div><dt>Biggest</dt><dd>{rupees(biggest.amount)}</dd><small>{biggest.title}</small></div>
            <div><dt>Top category</dt><dd>{topCategory.c}</dd><small>{Math.round((topCategory.v / total) * 100)}% of spend</small></div>
          </dl>
        )}
        <div className="history" role="group" aria-label="Spending in the last six months">
          {history.map(h => (
            <button key={h.key} className={h.key === month ? 'col on' : 'col'} aria-pressed={h.key === month}
              aria-label={`${monthLabel(h.key, { month: 'long', year: 'numeric' })}: ${rupees(h.v)}`} onClick={() => goToMonth(h.key)}>
              <span className="col-bar" style={{ height: Math.max(4, (h.v / peak) * 100) + '%' }} />
              <small>{monthLabel(h.key, { month: 'short' })}</small>
            </button>
          ))}
        </div>
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
          <form className="budget-form" onSubmit={saveBudget}>
            <input aria-label="Monthly budget in rupees" type="number" min="0" step="1" inputMode="numeric" placeholder="Monthly budget (₹)" value={budgetInput} onChange={e => setBudgetInput(e.target.value)} />
            <button className="chip">{budget > 0 ? 'Update budget' : 'Set budget'}</button>
          </form>
        </div>
      </section>

      <form className="entry" onSubmit={add}>
        <input aria-label="What did you buy" placeholder="What did you buy?" value={title} onChange={e => setTitle(e.target.value)} required />
        <input aria-label="Amount in rupees" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="₹ amount" value={amount} onChange={e => setAmount(e.target.value)} required />
        <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <button className="primary">Add line</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}

      <section className="ledger">
        <input className="search" type="search" aria-label="Search expenses" placeholder="Search all months" value={query} onChange={e => { setQuery(e.target.value); setLimit(PAGE); }} />
        <div className="filters" role="group" aria-label="Filter by category">
          <button className={!filter ? 'chip on' : 'chip'} onClick={() => { setFilter(null); setLimit(PAGE); }}>All</button>
          {CATEGORIES.map(c => <button key={c} className={filter === c ? 'chip on' : 'chip'} onClick={() => { setFilter(filter === c ? null : c); setLimit(PAGE); }}><i className={'dot ' + c} />{c}</button>)}
          <a className="chip export" href="/api/expenses.csv" download>Export CSV</a>
        </div>
        {shown.length === 0 ? (
          <p className="empty">{
            q ? `No expenses match "${query.trim()}".`
              : expenses.length === 0 ? 'Nothing logged yet. Add the first thing you bought today, even a ₹20 chai.'
              : filter ? `No ${filter} expenses in ${monthLabel(month, { month: 'long' })}.`
              : `Nothing logged in ${monthLabel(month, { month: 'long', year: 'numeric' })}.`
          }</p>
        ) : (
          <ul>
            {shown.map(x => (
              editingId === x._id ? (
                <li key={x._id} className="line">
                  <form className="edit-row" onSubmit={saveEdit}>
                    <input aria-label="Title" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} required />
                    <input aria-label="Amount in rupees" type="number" step="0.01" min="0.01" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })} required />
                    <select aria-label="Category" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
                    <button className="primary">Save</button>
                    <button type="button" className="link" onClick={() => setEditingId(null)}>Cancel</button>
                  </form>
                </li>
              ) : (
                <li key={x._id} className="line">
                  <span className="what"><i className={'dot ' + x.category} />{x.title}<small>{new Date(x.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></span>
                  <span className="leader" aria-hidden="true" />
                  <b>{rupees(x.amount)}</b>
                  <button className="del" aria-label={'Edit ' + x.title} onClick={() => startEdit(x)}>✎</button>
                  <button className="del" aria-label={'Delete ' + x.title} onClick={() => remove(x._id)}>×</button>
                </li>
              )
            ))}
          </ul>
        )}
        {matches.length > limit && <button className="chip more" onClick={() => setLimit(limit + PAGE)}>Show more ({matches.length - limit} left)</button>}
      </section>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // On first load ask the server who we are, so a refresh keeps the login.
  useEffect(() => {
    api('/me').then(setUser).catch(() => {}).finally(() => setChecking(false));
  }, []);

  async function logout() { await api('/logout', 'POST'); setUser(null); }

  if (checking) return <main className="tracker"><p className="muted">Loading…</p></main>;
  return user ? <Tracker user={user} onLogout={logout} /> : <AuthForm onLoggedIn={setUser} />;
}
