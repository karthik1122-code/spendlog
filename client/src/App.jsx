import { useEffect, useState } from 'react';
import { api } from './api.js';

const CATEGORIES = ['Food', 'Travel', 'Study', 'Fun', 'Other'];
const rupees = n => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sum = list => list.reduce((s, x) => s + x.amount, 0);

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

  useEffect(() => { api('/expenses').then(setExpenses).catch(e => setError(e.message)); }, []);

  async function add(e) {
    e.preventDefault();
    try {
      setError('');
      const created = await api('/expenses', 'POST', { title, amount, category });
      setExpenses([created, ...expenses]);
      setTitle(''); setAmount('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    await api('/expenses/' + id, 'DELETE');
    setExpenses(expenses.filter(x => x._id !== id));
  }

  const now = new Date();
  const thisMonth = expenses.filter(x => { const d = new Date(x.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const total = sum(thisMonth);
  const split = CATEGORIES.map(c => ({ c, v: sum(thisMonth.filter(x => x.category === c)) })).filter(x => x.v > 0);
  const shown = filter ? expenses.filter(x => x.category === filter) : expenses;

  return (
    <main className="tracker">
      <header>
        <h1 className="brand small">Spend<span>Log</span></h1>
        <p className="who">{user.email} <button className="link" onClick={onLogout}>Log out</button></p>
      </header>

      <section className="summary">
        <p className="eyebrow">{now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</p>
        <p className="total">{rupees(total)}</p>
        <p className="muted">spent this month · {rupees(sum(expenses))} all time</p>
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
      </section>

      <form className="entry" onSubmit={add}>
        <input aria-label="What did you buy" placeholder="What did you buy?" value={title} onChange={e => setTitle(e.target.value)} required />
        <input aria-label="Amount in rupees" type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="₹ amount" value={amount} onChange={e => setAmount(e.target.value)} required />
        <select aria-label="Category" value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <button className="primary">Add line</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}

      <section className="ledger">
        <div className="filters" role="group" aria-label="Filter by category">
          <button className={!filter ? 'chip on' : 'chip'} onClick={() => setFilter(null)}>All</button>
          {CATEGORIES.map(c => <button key={c} className={filter === c ? 'chip on' : 'chip'} onClick={() => setFilter(filter === c ? null : c)}><i className={'dot ' + c} />{c}</button>)}
        </div>
        {shown.length === 0 ? (
          <p className="empty">{expenses.length === 0 ? 'Nothing logged yet. Add the first thing you bought today, even a ₹20 chai.' : `No ${filter} expenses yet.`}</p>
        ) : (
          <ul>
            {shown.map(x => (
              <li key={x._id} className="line">
                <span className="what"><i className={'dot ' + x.category} />{x.title}<small>{new Date(x.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></span>
                <span className="leader" aria-hidden="true" />
                <b>{rupees(x.amount)}</b>
                <button className="del" aria-label={'Delete ' + x.title} onClick={() => remove(x._id)}>×</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  async function logout() { await api('/logout', 'POST'); setUser(null); }
  return user ? <Tracker user={user} onLogout={logout} /> : <AuthForm onLoggedIn={setUser} />;
}
