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
      create: async d => { const u = { ...d, id: 'u' + ++n }; users.push(u); return u; },
    },
    Expense: {
      find: q => ({ sort: async () => expenses.filter(e => e.user === q.user) }),
      create: async d => { const e = { ...d, _id: 'e' + ++n }; expenses.push(e); return e; },
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
    return { status: r.status, cookie: (r.headers.get('set-cookie') || '').split(';')[0], json: await r.json() };
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
