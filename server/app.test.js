import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';

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
      find: q => ({ sort: async () => expenses.filter(e => e.user === q.user) }),
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
    return { status: r.status, cookie: (r.headers.get('set-cookie') || '').split(';')[0], json, text };
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
  assert.equal((await call('/api/expenses', { cookie: a })).json.length, 1);
  assert.equal((await call('/api/expenses', { cookie: b })).json.length, 0);
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
