import { useEffect, useState } from 'react';
import { api } from './api.js';
import { monthKey, rupees } from './format.js';
import { useDebounced } from './hooks.js';
import Summary from './Summary.jsx';
import AddForm from './AddForm.jsx';
import Ledger from './Ledger.jsx';

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

  return (
    <div className="shell">
      <header className="top">
        <h1 className="brand small">Spend<span>Log</span></h1>
        <p className="who">{user.email} <button className="link" onClick={onLogout}>Log out</button></p>
      </header>

      <aside className="rail">
        <Summary summary={summary} month={month} currentMonth={currentMonth} onMonth={changeMonth}
          budget={budget} budgetInput={budgetInput} onBudgetInput={setBudgetInput} onSaveBudget={saveBudget} />
      </aside>

      <main className="main">
        <AddForm onAdd={addExpense} />
        {error && <p className="error" role="alert">{error}</p>}
        <Ledger data={list} filter={filter} onFilter={changeFilter} query={query} onQuery={changeQuery} searching={Boolean(search)}
          onPage={setPage} onEdit={editExpense} onDelete={deleteExpense} />
      </main>

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
  return user ? <Tracker user={user} onLogout={logout} /> : <AuthForm onLoggedIn={setUser} />;
}
