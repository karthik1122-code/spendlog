import { useEffect, useState } from 'react';
import { api } from './lib/api.js';
import Landing from './pages/Landing.jsx';
import Dashboard from './pages/Dashboard.jsx';

// The free host sleeps when idle; after a few seconds, say so instead of looking frozen.
function SlowHint() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, []);
  return slow ? <p className="muted">Waking up the server. Free hosting can take up to 30 seconds after a quiet spell.</p> : null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // On first load ask the server who we are, so a refresh keeps the login.
  useEffect(() => {
    api('/me').then(setUser).catch(() => {}).finally(() => setChecking(false));
  }, []);

  // Even if the request fails, leave the dashboard; the cookie expires on its own.
  async function logout() { try { await api('/logout', 'POST'); } catch { /* offline */ } setUser(null); }

  if (checking) return <main className="loading"><p className="muted">Loading…</p><SlowHint /></main>;
  return user ? <Dashboard user={user} onLogout={logout} /> : <Landing onLoggedIn={setUser} />;
}
