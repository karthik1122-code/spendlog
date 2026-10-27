// Forgot-password flow in a real browser. Same setup as journey.e2e.js (needs MONGODB_URI and a build).
// Without RESEND_API_KEY the server prints the reset email to its log, and the test reads the link from there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4900 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
let server, browser, log = '';

test.before(async () => {
  assert.ok(process.env.MONGODB_URI, 'set MONGODB_URI to a test database');
  server = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), JWT_SECRET: 'e2e-secret', RESEND_API_KEY: '', APP_URL: BASE, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  server.stdout.on('data', (d) => { log += d.toString(); });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch();
});
test.after(async () => { await browser?.close(); server?.kill(); });

test('forgot password emails a link that sets a new password and signs in', async () => {
  const email = `reset-${Date.now()}@example.com`;
  await fetch(`${BASE}/api/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'old-secret' }) });

  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.getByRole('button', { name: /^log in$/i }).first().click();
  await page.getByRole('button', { name: /forgot password/i }).click();
  await page.getByRole('heading', { name: /reset your password/i }).waitFor();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /send reset link/i }).click();
  await page.getByRole('status').getByText(/reset link is on its way/i).waitFor();

  let url;
  for (let i = 0; i < 20 && !url; i++) {
    url = log.match(/https?:\/\/\S+\?reset=[A-Za-z0-9_-]+/)?.[0];
    if (!url) await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(url, 'the reset link should be printed in development');

  await page.goto(url);
  await page.getByRole('heading', { name: /choose a new password/i }).waitFor();
  await page.getByLabel('New password').fill('new-secret');
  await page.getByRole('button', { name: /save new password/i }).click();
  await page.getByLabel('What did you buy').waitFor({ timeout: 10000 }); // signed in
  assert.equal(new URL(page.url()).search, '', 'the token is removed from the address bar');

  const old = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'old-secret' }) });
  assert.equal(old.status, 401);
  assert.deepEqual(errors, []);
  await page.close();
});
