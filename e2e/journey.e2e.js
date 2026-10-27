// Browser journey against the real server and a real MongoDB.
// Needs MONGODB_URI and a production build:  npm run build && MONGODB_URI=... npm run test:e2e
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = 4800 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
let server, browser;

test.before(async () => {
  assert.ok(process.env.MONGODB_URI, 'set MONGODB_URI to a test database');
  server = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), JWT_SECRET: 'e2e-secret' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch();
});
test.after(async () => { await browser?.close(); server?.kill(); });

test('sign up, add, edit, delete with undo, and the data survives a reload', async () => {
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto(BASE);
  await page.getByRole('button', { name: /^get started$/i }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('secret12');
  await page.getByRole('button', { name: /^create account$/i }).click();

  const add = async (title, amount) => {
    await page.getByLabel('What did you buy').fill(title);
    await page.getByLabel('Amount in rupees').fill(String(amount));
    await page.getByRole('button', { name: /^add$/i }).click();
    await page.getByText(title, { exact: true }).waitFor();
  };
  await add('Chai', 20);
  await add('Lunch', 150);
  assert.match(await page.getByText(/^Spent in/).locator('..').innerText(), /₹170\.00/);

  await page.getByRole('button', { name: 'Edit Lunch' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Masala dosa');
  await page.keyboard.press('Enter');
  await page.getByText('Masala dosa', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Delete Chai' }).click();
  await page.getByRole('button', { name: /undo/i }).click();
  await page.getByText('Chai', { exact: true }).waitFor();

  await page.reload();
  await page.getByText('Masala dosa', { exact: true }).waitFor();
  await page.getByText('Chai', { exact: true }).waitFor();

  await page.getByLabel('Search expenses').fill('dosa');
  await page.getByText(/1 match/).waitFor();
  assert.deepEqual(errors, []);
  await page.close();
});

test('the dashboard fits a phone screen', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE);
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  await page.close();
});
