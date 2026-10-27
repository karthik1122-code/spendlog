import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';

// A tiny version of Mongo's filter matching: user, category, date range and title regex.
function matches(e, f) {
  if (f.user && e.user !== f.user) return false;
  if (f.category && e.category !== f.category) return false;
  if (f.date && !(e.date >= f.date.$gte && e.date < f.date.$lt)) return false;
  if (f.title && !new RegExp(f.title.$regex, f.title.$options).test(e.title)) return false;
  return true;
}
// Like a Mongoose query: chain sort/skip/limit, then await it for the array.
function query(list) {
  let rows = list.slice();
  const q = {
    sort() { rows.sort((a, b) => b.date - a.date || (a._id < b._id ? 1 : -1)); return q; },
    skip(n) { rows = rows.slice(n); return q; },
    limit(n) { rows = rows.slice(0, n); return q; },
    then: (ok, fail) => Promise.resolve(rows).then(ok, fail),
  };
  return q;
}

// In-memory stand-ins for the Mongoose models, so tests need no database.
function fakeModels() {
  const users = [], expenses = [];
  let n = 0;
  return {
    User: {
      findOne: async q => users.find(u => u.email === q.email) || null,
      findById: async id => users.find(u => u.id === id) || null,
      create: async d => { const u = { ...d, id: 'u' + ++n }; users.push(u); return u; },
      findByIdAndUpdate: async (id, patch) => Object.assign(users.find(u => u.id === id), patch),
    },
    Expense: {
      find: filter => query(expenses.filter(e => matches(e, filter))),
      countDocuments: async filter => expenses.filter(e => matches(e, filter)).length,
      create: async d => { const e = { date: new Date(), ...d, _id: 'e' + ++n }; expenses.push(e); return e; },
      findOneAndUpdate: async (q, patch) => {
        const e = expenses.find(x => x._id === q._id && x.user === q.user);
        return e ? Object.assign(e, patch) : null;
      },
      findOneAndDelete: async q => {
        const i = expenses.findIndex(e => e._id === q._id && e.user === q.user);
        return i < 0 ? null : expenses.splice(i, 1)[0];
      },
    },
  };
}

async function start() {
  const server = createApp({ ...fakeModels(), secret: 'test-secret' }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { method = 'GET', body, cookie } = {}) => {
    const r = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body && JSON.stringify(body),
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON, e.g. the CSV download */ }
    return { status: r.status, cookie: (r.headers.get('set-cookie') || '').split(';')[0], json, text, headers: Object.fromEntries(r.headers) };
  };
  return { call, close: () => server.close() };
}

test('register, then log in with the right and wrong password', async () => {
  const { call, close } = await start();
  const reg = await call('/api/register', { method: 'POST', body: { email: 'a@b.com', password: 'secret1' } });
  assert.equal(reg.status, 201);
  assert.ok(reg.cookie.startsWith('token='));
  assert.equal((await call('/api/register', { method: 'POST', body: { email: 'a@b.com', password: 'secret1' } })).status, 409);
  assert.equal((await call('/api/login', { method: 'POST', body: { email: 'a@b.com', password: 'nope' } })).status, 401);
  assert.equal((await call('/api/login', { method: 'POST', body: { email: 'a@b.com', password: 'secret1' } })).status, 200);
  close();
});

test('expenses need login and are private to each user', async () => {
  const { call, close } = await start();
  assert.equal((await call('/api/expenses')).status, 401);
  const a = (await call('/api/register', { method: 'POST', body: { email: 'a@b.com', password: 'secret1' } })).cookie;
  const b = (await call('/api/register', { method: 'POST', body: { email: 'c@d.com', password: 'secret2' } })).cookie;
  const added = await call('/api/expenses', { method: 'POST', cookie: a, body: { title: 'Lunch', amount: 120, category: 'Food' } });
  assert.equal(added.status, 201);
  assert.equal((await call('/api/expenses', { cookie: a })).json.total, 1);
  assert.equal((await call('/api/expenses', { cookie: b })).json.total, 0);
  assert.equal((await call(`/api/expenses/${added.json._id}`, { method: 'DELETE', cookie: b })).status, 404);
  assert.equal((await call(`/api/expenses/${added.json._id}`, { method: 'DELETE', cookie: a })).status, 200);
  close();
});

test('rejects bad input', async () => {
  const { call, close } = await start();
  assert.equal((await call('/api/register', { method: 'POST', body: { email: 'a@b.com', password: '123' } })).status, 400);
  const c = (await call('/api/register', { method: 'POST', body: { email: 'a@b.com', password: 'secret1' } })).cookie;
  assert.equal((await call('/api/expenses', { method: 'POST', cookie: c, body: { title: 'x', amount: -5 } })).status, 400);
  close();
});

const signUp = (call, email = 'a@b.com') =>
  call('/api/register', { method: 'POST', body: { email, password: 'secret1' } }).then(r => r.cookie);

test('/api/me restores the session from the cookie', async () => {
  const { call, close } = await start();
  assert.equal((await call('/api/me')).status, 401);
  const cookie = await signUp(call);
  const me = await call('/api/me', { cookie });
  assert.equal(me.status, 200);
  assert.deepEqual(me.json, { email: 'a@b.com', budget: 0 });
  close();
});

test('you can edit your own expense but not someone else\'s', async () => {
  const { call, close } = await start();
  const a = await signUp(call, 'a@b.com');
  const b = await signUp(call, 'c@d.com');
  const { json: made } = await call('/api/expenses', { method: 'POST', cookie: a, body: { title: 'Lunch', amount: 120, category: 'Food' } });
  const edit = { title: 'Lunch with team', amount: 200, category: 'Fun' };
  const ok = await call(`/api/expenses/${made._id}`, { method: 'PUT', cookie: a, body: edit });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.amount, 200);
  assert.equal((await call(`/api/expenses/${made._id}`, { method: 'PUT', cookie: b, body: edit })).status, 404);
  assert.equal((await call(`/api/expenses/${made._id}`, { method: 'PUT', cookie: a, body: { ...edit, amount: 0 } })).status, 400);
  assert.equal((await call(`/api/expenses/${made._id}`, { method: 'PUT', cookie: a, body: { ...edit, category: 'Weird' } })).status, 400);
  close();
});

test('monthly budget can be set and is returned by /api/me', async () => {
  const { call, close } = await start();
  const cookie = await signUp(call);
  assert.equal((await call('/api/budget', { method: 'PUT', cookie, body: { amount: -1 } })).status, 400);
  assert.equal((await call('/api/budget', { method: 'PUT', cookie, body: { amount: 6000 } })).json.budget, 6000);
  assert.equal((await call('/api/me', { cookie })).json.budget, 6000);
  assert.equal((await call('/api/budget', { method: 'PUT', body: { amount: 5 } })).status, 401);
  close();
});

test('CSV export lists only your expenses and neutralises formulas', async () => {
  const { call, close } = await start();
  const a = await signUp(call, 'a@b.com');
  const b = await signUp(call, 'c@d.com');
  await call('/api/expenses', { method: 'POST', cookie: a, body: { title: '=SUM(A1)', amount: 5, category: 'Other' } });
  await call('/api/expenses', { method: 'POST', cookie: b, body: { title: 'Secret', amount: 9 } });
  const csv = await call('/api/expenses.csv', { cookie: a });
  assert.equal(csv.status, 200);
  assert.equal(csv.text.split('\n').length, 2); // header + one row
  assert.ok(csv.text.includes('"\'=SUM(A1)"'));
  assert.ok(!csv.text.includes('Secret'));
  assert.equal((await call('/api/expenses.csv')).status, 401);
  close();
});

test('too many wrong passwords are blocked with 429', async () => {
  const { call, close } = await start();
  await signUp(call);
  const wrong = () => call('/api/login', { method: 'POST', body: { email: 'a@b.com', password: 'bad-pass' } });
  for (let i = 0; i < 5; i++) assert.equal((await wrong()).status, 401);
  assert.equal((await wrong()).status, 429);
  // even the right password is refused while blocked
  assert.equal((await call('/api/login', { method: 'POST', body: { email: 'a@b.com', password: 'secret1' } })).status, 429);
  close();
});

const add = (call, cookie, title, amount, category = 'Food', date) =>
  call('/api/expenses', { method: 'POST', cookie, body: { title, amount, category, date } });

test('the list is paged, newest first, with a total', async () => {
  const { call, close } = await start();
  const c = await signUp(call);
  for (let i = 1; i <= 12; i++) await add(call, c, 'Item ' + i, i, 'Food', `2026-10-${String(i).padStart(2, '0')}T12:00:00Z`);
  const one = (await call('/api/expenses?limit=10', { cookie: c })).json;
  assert.equal(one.items.length, 10);
  assert.equal(one.total, 12);
  assert.equal(one.pages, 2);
  assert.equal(one.items[0].title, 'Item 12'); // newest first
  const two = (await call('/api/expenses?limit=10&page=2', { cookie: c })).json;
  assert.deepEqual(two.items.map(x => x.title), ['Item 2', 'Item 1']);
  close();
});

test('month filter follows the user\'s time zone', async () => {
  const { call, close } = await start();
  const c = await signUp(call);
  // 20:30 UTC on 30 Sep is 02:00 on 1 Oct in India (offset -330).
  await add(call, c, 'Late night', 10, 'Food', '2026-09-30T20:30:00Z');
  await add(call, c, 'Mid month', 20, 'Food', '2026-10-15T10:00:00Z');
  const india = (await call('/api/expenses?month=2026-10&tz=-330', { cookie: c })).json;
  assert.deepEqual(india.items.map(x => x.title).sort(), ['Late night', 'Mid month']);
  const utc = (await call('/api/expenses?month=2026-10&tz=0', { cookie: c })).json;
  assert.deepEqual(utc.items.map(x => x.title), ['Mid month']);
  close();
});

test('search covers all months, filters by category, and survives regex characters', async () => {
  const { call, close } = await start();
  const c = await signUp(call);
  await add(call, c, 'Chai', 20, 'Food', '2026-05-01T10:00:00Z');
  await add(call, c, 'Chai tapri', 30, 'Food', '2026-10-01T10:00:00Z');
  await add(call, c, 'Bus (night)', 50, 'Travel', '2026-10-02T10:00:00Z');
  assert.equal((await call('/api/expenses?q=chai', { cookie: c })).json.total, 2);
  assert.equal((await call('/api/expenses?q=(', { cookie: c })).status, 200);
  assert.equal((await call('/api/expenses?q=(', { cookie: c })).json.total, 1);
  assert.equal((await call('/api/expenses?category=Travel', { cookie: c })).json.total, 1);
  close();
});

test('summary gives totals, categories, biggest and six months of history', async () => {
  const { call, close } = await start();
  const c = await signUp(call);
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);
  await add(call, c, 'Tea', 20, 'Food', now.toISOString());
  await add(call, c, 'Metro', 80, 'Travel', now.toISOString());
  const s = (await call(`/api/summary?month=${thisMonth}`, { cookie: c })).json;
  assert.equal(s.total, 100);
  assert.deepEqual(s.byCategory, { Food: 20, Travel: 80 });
  assert.equal(s.topCategory, 'Travel');
  assert.deepEqual(s.biggest, { title: 'Metro', amount: 80 });
  assert.equal(s.history.length, 6);
  assert.equal(s.history[5].month, thisMonth);
  assert.equal(s.history[5].total, 100);
  assert.equal((await call('/api/summary')).status, 401);
  close();
});

test('health route, security headers and date checks', async () => {
  const { call, close } = await start();
  const health = await call('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.json.status, 'ok');
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['x-frame-options'], 'DENY');
  assert.equal(health.headers['x-powered-by'], undefined);
  const c = await signUp(call);
  assert.equal((await add(call, c, 'Time travel', 5, 'Food', '2999-01-01')).status, 400);
  assert.equal((await add(call, c, 'Bad date', 5, 'Food', 'not-a-date')).status, 400);
  close();
});

test('health reports 503 when the database is down', async () => {
  const server = createApp({ ...fakeModels(), secret: 's', dbReady: () => false }).listen(0);
  const r = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).db, 'down');
  server.close();
});

test('rejects oversized and malformed bodies with JSON errors', async () => {
  const { call, close } = await start();
  const big = await call('/api/register', { method: 'POST', body: { email: 'x@y.com', password: 'x'.repeat(200 * 1024) } });
  assert.equal(big.status, 413);
  assert.equal(big.json.error, 'Request is too large');
  close();
});

test('validates email, password and expense limits', async () => {
  const { call, close } = await start();
  assert.equal((await call('/api/register', { method: 'POST', body: { email: 'not-an-email', password: 'secret1' } })).status, 400);
  assert.equal((await call('/api/register', { method: 'POST', body: { email: 'a@b.com', password: 'x'.repeat(200) } })).status, 400);
  const c = await signUp(call);
  assert.equal((await add(call, c, 'x'.repeat(121), 5, 'Food')).status, 400);
  assert.equal((await add(call, c, 'Huge', 2e9, 'Food')).status, 400);
  assert.equal((await add(call, c, 'Chai', 20, 'Food')).status, 201);
  close();
});
