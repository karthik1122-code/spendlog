import { useEffect, useState } from 'react';
import { api } from './api.js';

const CATEGORIES = ['Food', 'Travel', 'Study', 'Fun', 'Other'];

function AuthForm({ onLoggedIn }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    try {
      setError('');
      const user = await api(mode === 'login' ? '/login' : '/register', 'POST', { email, password });
      onLoggedIn(user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>SpendLog</h1>
      <p className="muted">Track what you spend. Sign in to start.</p>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password (6+ characters)" value={password} onChange={e => setPassword(e.target.value)} required />
      {error && <p className="error">{error}</p>}
      <button>{mode === 'login' ? 'Log in' : 'Create account'}</button>
      <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'New here? Create an account' : 'Have an account? Log in'}
      </button>
    </form>
  );
}

function Tracker({ user, onLogout }) {
  const [expenses, setExpenses] = useState([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [error, setError] = useState('');

  // Load this user's expenses once, when the page opens.
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

  // Totals are computed from the list, not stored.
  const total = expenses.reduce((sum, x) => sum + x.amount, 0);
  const byCategory = CATEGORIES.map(c => ({ c, sum: expenses.filter(x => x.category === c).reduce((s, x) => s + x.amount, 0) })).filter(x => x.sum > 0);

  return (
    <main className="card wide">
      <header>
        <h1>SpendLog</h1>
        <span className="muted">{user.email} <button className="link" onClick={onLogout}>Log out</button></span>
      </header>

      <p className="total">Total spent: ₹{total.toFixed(2)}</p>
      <ul className="chips">{byCategory.map(x => <li key={x.c}>{x.c}: ₹{x.sum.toFixed(2)}</li>)}</ul>

      <form className="row" onSubmit={add}>
        <input placeholder="What did you buy?" value={title} onChange={e => setTitle(e.target.value)} required />
        <input type="number" step="0.01" min="0.01" placeholder="₹" value={amount} onChange={e => setAmount(e.target.value)} required />
        <select value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        <button>Add</button>
      </form>
      {error && <p className="error">{error}</p>}

      {expenses.length === 0 ? <p className="muted">No expenses yet. Add your first one above.</p> : (
        <ul className="list">
          {expenses.map(x => (
            <li key={x._id}>
              <span>{x.title} <small className="muted">{x.category} · {new Date(x.date).toLocaleDateString()}</small></span>
              <span>₹{x.amount.toFixed(2)} <button className="link" onClick={() => remove(x._id)}>Delete</button></span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  async function logout() { await api('/logout', 'POST'); setUser(null); }
  return user ? <Tracker user={user} onLogout={logout} /> : <AuthForm onLoggedIn={setUser} />;
}
