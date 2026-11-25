import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';

// Sign-in, sign-up, forgot password and reset password in one modal.
// The built-in <dialog> element gives focus trapping and Esc to close.
const TEXT = {
  login: { title: 'Welcome back', sub: 'Log in to see your spending.', button: 'Log in' },
  register: { title: 'Create your free account', sub: 'No card needed. Start logging in under a minute.', button: 'Create account' },
  forgot: { title: 'Reset your password', sub: 'Enter your email and we will send you a link to choose a new password.', button: 'Send reset link' },
  reset: { title: 'Choose a new password', sub: 'After this, any other device signed in to your account is signed out.', button: 'Save new password' },
};

function AuthDialog({ mode, onMode, onClose, onLoggedIn, resetToken }) {
  const ref = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const t = TEXT[mode];

  function go(next) { onMode(next); setError(''); setNotice(''); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'forgot') {
        setNotice((await api('/forgot', 'POST', { email })).message);
        setBusy(false);
        return;
      }
      if (mode === 'reset') {
        const user = await api('/reset', 'POST', { token: resetToken, password });
        window.history.replaceState(null, '', '/');
        onLoggedIn(user);
        return;
      }
      onLoggedIn(await api(mode === 'login' ? '/login' : '/register', 'POST', { email, password }));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} className="auth" onClose={onClose} onClick={e => { if (e.target === ref.current) ref.current.close(); }}>
      <form className="auth-form" onSubmit={submit}>
        <h2>{t.title}</h2>
        <p className="muted">{t.sub}</p>
        {mode !== 'reset' && <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus /></label>}
        {mode !== 'forgot' && (
          <label>{mode === 'reset' ? 'New password' : 'Password'}<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 6 characters" autoFocus={mode === 'reset'} /></label>
        )}
        {mode === 'login' && <button type="button" className="link small" onClick={() => go('forgot')}>Forgot password?</button>}
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}
        <button className="primary" disabled={busy}>{busy ? 'One moment…' : t.button}</button>
        {mode === 'register' || mode === 'login'
          ? <button type="button" className="link" onClick={() => go(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}</button>
          : <button type="button" className="link" onClick={() => { window.history.replaceState(null, '', '/'); go('login'); }}>Back to log in</button>}
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

// A small, clearly labelled sample of the ledger so visitors see the product before signing up.
function Preview() {
  const rows = [
    ['Mon 20', 'Masala dosa, canteen', 'Food', '₹60'],
    ['Mon 20', 'Metro card recharge', 'Travel', '₹500'],
    ['Tue 21', 'DSA book, 2nd hand', 'Study', '₹240'],
    ['Wed 22', 'Chai with the team', 'Food', '₹20'],
    ['Fri 24', 'Movie, Sunday show', 'Fun', '₹180'],
  ];
  return (
    <div className="visual" aria-hidden="true">
      <div className="preview">
        <div className="pv-head">
          <span className="pv-month">November</span>
          <span className="pv-total"><small>spent</small>₹4,860</span>
        </div>
        <ul className="pv-rows">
          {rows.map(([d, t, c, a]) => (
            <li key={t}><span className="pv-date">{d}</span><span className="pv-title"><i className={'dot ' + c} />{t}</span><b>{a}</b></li>
          ))}
          <li className="pv-new"><span className="pv-date">Today</span><span className="pv-title pv-typing">Lunch<span className="caret" /></span><b>₹180</b></li>
        </ul>
        <span className="pv-stamp">₹1,140<small>left of ₹6,000</small></span>
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
  // A password-reset email links to /?reset=<token>, which opens the dialog straight on "Choose a new password".
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('reset'));
  const [mode, setMode] = useState(resetToken ? 'reset' : null); // null, 'login', 'register', 'forgot' or 'reset'
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState('');
  // One click into a private demo account with a month of sample expenses, so visitors can look around first.
  async function tryDemo() {
    setDemoBusy(true);
    setDemoError('');
    try { onLoggedIn(await api('/demo', 'POST')); } catch (err) { setDemoError(err.message); setDemoBusy(false); }
  }
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
            <p className="lede">SpendLog is a pocket ledger for your money. Write down what you spend in two seconds, set one monthly budget, and see exactly where it went.</p>
            <div className="cta">
              <button className="primary lg" onClick={() => setMode('register')}>Get started, it's free</button>
              <button className="ghost lg" onClick={tryDemo} disabled={demoBusy}>{demoBusy ? 'Opening demo…' : 'Try the demo'}</button>
            </div>
            {demoError && <p className="error" role="alert">{demoError}</p>}
            <p className="fine">The demo needs no sign-up. Works on your phone. Export to CSV anytime.</p>
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
          <h2>Start your ledger today.</h2>
          <p className="lede">It takes under a minute, and your first expense is the hardest part.</p>
          <button className="primary lg" onClick={() => setMode('register')}>Create free account</button>
        </section>
      </main>

      <footer className="foot">
        <span>SpendLog · built by Karthik Uppari</span>
        <a href="https://github.com/karthik1122-code/spendlog" target="_blank" rel="noreferrer">Source on GitHub</a>
      </footer>

      {mode && <AuthDialog key={mode === 'reset' ? 'reset' : 'auth'} mode={mode} onMode={setMode} onClose={() => setMode(null)} onLoggedIn={onLoggedIn} resetToken={resetToken} />}
    </div>
  );
}
