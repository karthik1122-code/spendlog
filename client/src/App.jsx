import { useEffect, useState } from 'react';
import { api } from './api.js';
import { monthKey, monthLabel, rupees, shiftMonth } from './format.js';
import { useDebounced } from './hooks.js';
import Kpis from './Kpis.jsx';
import Insights from './Insights.jsx';
import Landing from './Landing.jsx';
import AddForm from './AddForm.jsx';
import Ledger from './Ledger.jsx';

// Shows a message for a few seconds; "Undo" brings back a deleted expense.
function Toast({ toast, onUndo, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{toast.message}</span>
      <button className="link" onClick={onUndo}>Undo</button>
    </div>
  );
}

function Tracker({ user, onLogout }) {
  const currentMonth = monthKey(new Date());
  const tz = new Date().getTimezoneOffset(); // minutes behind UTC (India: -330), so the server splits months on our clock

  const [month, setMonth] = useState(currentMonth);
  const [filter, setFilter] = useState(null);
  const [query, setQuery] = useState('');
  const search = useDebounced(query.trim(), 300); // only ask the server once typing pauses
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState(null);
  const [list, setList] = useState(null);
  const [refresh, setRefresh] = useState(0); // bump this number to reload both from the server
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [budget, setBudget] = useState(user.budget || 0);
  const [budgetInput, setBudgetInput] = useState(user.budget ? String(user.budget) : '');
  const reload = () => setRefresh(n => n + 1);

  // Summary for the chosen month. `ignore` stops a slow, old response from overwriting a newer one.
  useEffect(() => {
    let ignore = false;
    api(`/summary?month=${month}&tz=${tz}`).then(d => { if (!ignore) setSummary(d); }).catch(e => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [month, refresh, tz]);

  // One page of expenses. A search covers every month; otherwise the list shows the chosen month.
  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams({ page, tz });
    if (search) params.set('q', search); else params.set('month', month);
    if (filter) params.set('category', filter);
    api('/expenses?' + params).then(d => {
      if (ignore) return;
      if (d.items.length === 0 && d.page > 1) setPage(d.page - 1); // we deleted the last row of a page
      else setList(d);
    }).catch(e => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [month, filter, search, page, refresh, tz]);

  const changeMonth = key => { setMonth(key); setPage(1); };
  const changeFilter = value => { setFilter(value); setPage(1); };
  const changeQuery = value => { setQuery(value); setPage(1); };

  async function addExpense(data) {
    await api('/expenses', 'POST', data);
    setQuery(''); setFilter(null); setPage(1);
    setMonth(data.date ? monthKey(data.date) : currentMonth); // jump to the month we just added to
    reload();
  }

  async function editExpense(id, draft) {
    await api('/expenses/' + id, 'PUT', draft);
    reload();
  }

  async function deleteExpense(x) {
    try {
      setError('');
      await api('/expenses/' + x._id, 'DELETE');
      setToast({ message: `Deleted ${x.title} (${rupees(x.amount)})`, expense: x });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function undoDelete() {
    const { title, amount, category, date } = toast.expense;
    setToast(null);
    try {
      await api('/expenses', 'POST', { title, amount, category, date });
      reload();
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

  const initial = (user.email[0] || '?').toUpperCase();
  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand small">Spend<span>Log</span></h1>
        <div className="month-nav" role="group" aria-label="Month">
          <button className="nav" aria-label="Previous month" onClick={() => changeMonth(shiftMonth(month, -1))}>‹</button>
          <p>{monthLabel(month, { month: 'long', year: 'numeric' })}</p>
          <button className="nav" aria-label="Next month" disabled={month === currentMonth} onClick={() => changeMonth(shiftMonth(month, 1))}>›</button>
        </div>
        <div className="user">
          <span className="avatar" aria-hidden="true">{initial}</span>
          <span className="who">{user.email}</span>
          <button className="link" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <div className="dash">
        <Kpis summary={summary} month={month} budget={budget} budgetInput={budgetInput} onBudgetInput={setBudgetInput} onSaveBudget={saveBudget} />
        <Insights summary={summary} month={month} onMonth={changeMonth} />
        <AddForm onAdd={addExpense} />
        {error && <p className="error" role="alert">{error}</p>}
        <Ledger data={list} filter={filter} onFilter={changeFilter} query={query} onQuery={changeQuery} searching={Boolean(search)}
          onPage={setPage} onEdit={editExpense} onDelete={deleteExpense} />
      </div>

      {toast && <Toast toast={toast} onUndo={undoDelete} onClose={() => setToast(null)} />}
    </div>
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

  if (checking) return <main className="loading"><p className="muted">Loading…</p></main>;
  return user ? <Tracker user={user} onLogout={logout} /> : <Landing onLoggedIn={setUser} />;
}
