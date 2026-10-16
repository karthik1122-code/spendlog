import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Sign-in and sign-up in a modal. The built-in <dialog> element gives focus trapping and Esc to close.
function AuthDialog({ mode, onMode, onClose, onLoggedIn }) {
  const ref = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      setError('');
      onLoggedIn(await api(mode === 'login' ? '/login' : '/register', 'POST', { email, password }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="auth" onClose={onClose} onClick={e => { if (e.target === ref.current) ref.current.close(); }}>
      <form className="auth-form" onSubmit={submit}>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your free account'}</h2>
        <p className="muted">{mode === 'login' ? 'Log in to see your spending.' : 'No card needed. Start logging in under a minute.'}</p>
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 6 characters" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => { onMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
        </button>
      </form>
    </dialog>
  );
}

// Adds the class "in" once the element scrolls into view, so CSS can animate it.
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) { el?.classList.add('in'); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

// A small, clearly labelled sample of the dashboard so visitors see the product before signing up.
function Preview() {
  const bars = [['May', 38], ['Jun', 54], ['Jul', 31], ['Aug', 70], ['Sep', 82], ['Oct', 62]];
  const split = [['Food', 'Food', 46, '₹2,240'], ['Travel', 'Travel', 27, '₹1,310'], ['Study', 'Study', 17, '₹820'], ['Fun', 'Fun', 10, '₹490']];
  return (
    <div className="visual" aria-hidden="true">
    <span className="fchip c1"><i className="dot Food" />Lunch ₹180 added</span>
    <span className="fchip c2">₹1,140 left this month</span>
    <span className="fchip c3"><i className="dot Travel" />Metro ₹40</span>
    <div className="preview">
      <div className="preview-bar"><i /><i /><i /><span>spendlog</span></div>
      <div className="preview-body">
        <div className="p-kpis">
          <div className="p-card"><small>Spent in October</small><b>₹4,860.00</b><em className="down">▼ 8% vs Sep</em></div>
          <div className="p-card"><small>Budget</small><b>₹1,140.00</b><span className="p-track"><span style={{ width: '81%' }} /></span><em>left of ₹6,000</em></div>
        </div>
        <div className="p-charts">
          <div className="p-card p-trend">
            <small>Last six months</small>
            <div className="p-bars">{bars.map(([m, h]) => <span key={m} className={m === 'Oct' ? 'on' : ''}><i style={{ height: h + '%' }} /><small>{m}</small></span>)}</div>
          </div>
          <div className="p-card p-split">
            <small>Where it went</small>
            {split.map(([k, c, w, v]) => <p key={k}><span><i className={'dot ' + c} />{k}</span><span className="p-t"><span className={'seg ' + c} style={{ width: w * 2 + '%' }} /></span><b>{v}</b></p>)}
          </div>
        </div>
      </div>
      <p className="sample">Sample data</p>
    </div>
    </div>
  );
}

const FEATURES = [
  ['Log a spend in seconds', 'Type what you bought, tap a category, press Enter. The cursor jumps back so you can keep going.'],
  ['A budget that tells you early', 'Set one monthly number and watch how much is left. It turns red the moment you pass it.'],
  ['Every month, one click', 'Flip through past months, compare with the month before, and see the last six at a glance.'],
  ['Search and export', 'Find any expense across all months in a moment, or download everything as a CSV.'],
  ['Undo mistakes', 'Deleted the wrong line? One click on Undo brings it back with its original date.'],
  ['Private by design', 'Passwords are hashed, your session lives in a cookie scripts cannot read, and nobody else can see your expenses.'],
];

export default function Landing({ onLoggedIn }) {
  const [mode, setMode] = useState(null); // null, 'login' or 'register'
  const featRef = useReveal();
  const stepRef = useReveal();
  const finalRef = useReveal();
  return (
    <div className="landing">
      <header className="site-nav">
        <a className="brand small" href="#top" aria-label="SpendLog home">Spend<span>Log</span></a>
        <nav aria-label="Main">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <button className="link" onClick={() => setMode('login')}>Log in</button>
          <button className="primary sm" onClick={() => setMode('register')}>Get started</button>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <h1>Know where your money went, before the month ends.</h1>
            <p className="lede">SpendLog is a simple expense tracker with monthly budgets, instant search and private accounts. Log what you spend in seconds and see exactly where it goes.</p>
            <div className="cta">
              <button className="primary lg" onClick={() => setMode('register')}>Get started, it's free</button>
              <button className="ghost lg" onClick={() => setMode('login')}>Log in</button>
            </div>
            <p className="fine">No card needed · Works on your phone · Export anytime</p>
          </div>
          <Preview />
        </section>

        <section id="features" className="section">
          <h2>Everything you need, nothing you don't</h2>
          <ul className="features reveal" ref={featRef}>
            {FEATURES.map(([title, text]) => <li key={title} className="feature"><h3>{title}</h3><p>{text}</p></li>)}
          </ul>
        </section>

        <section id="how" className="section">
          <h2>Up and running in three steps</h2>
          <ol className="steps reveal" ref={stepRef}>
            <li><b>1</b><h3>Create your account</h3><p>An email and a password. That's it.</p></li>
            <li><b>2</b><h3>Log what you spend</h3><p>Add each expense as it happens, with a category and a date.</p></li>
            <li><b>3</b><h3>See where it goes</h3><p>Totals, a budget bar and a six-month chart update as you add.</p></li>
          </ol>
        </section>

        <section className="section final reveal" ref={finalRef}>
          <h2>Start your ledger today</h2>
          <p className="lede">It takes under a minute, and your first expense is the hardest part.</p>
          <button className="primary lg" onClick={() => setMode('register')}>Create free account</button>
        </section>
      </main>

      <footer className="foot">
        <span>SpendLog · built by Karthik Uppari</span>
        <a href="https://github.com/karthik1122-code/spendlog" target="_blank" rel="noreferrer">Source on GitHub</a>
      </footer>

      {mode && <AuthDialog mode={mode} onMode={setMode} onClose={() => setMode(null)} onLoggedIn={onLoggedIn} />}
    </div>
  );
}
