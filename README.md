# SpendLog

A small full-stack expense tracker. Create an account, log what you spend, set a monthly budget, and see totals, category split and a six-month chart.

**Stack:** React (Vite) · Express 5 · MongoDB with Mongoose · JWT in an httpOnly cookie · bcrypt

## Run it

```bash
npm install
cp .env.example .env        # fill in MONGODB_URI and JWT_SECRET
npm run server              # API on http://localhost:4000
npm run client              # React dev server (proxies /api to the API)
npm test                    # 13 tests, no database needed
```

Production: `npm run build`, then `npm run server` serves the API and the built React app from one port.

## Layout

```
server/
  models.js    User and Expense schemas
  auth.js      JWT cookie helpers and the requireAuth middleware
  app.js       All routes (accounts, session check, budget, expenses, CSV) and the error handler
  constants.js The five categories, shared by the API and the database
  rateLimit.js Blocks repeated wrong-password logins (429)
  csv.js       Builds the CSV download and neutralises spreadsheet formulas
  queries.js   Pure helpers: time-zone aware month ranges, regex escaping, the summary builder
  app.test.js  Tests with in-memory fake models
  index.js     Connects to MongoDB, starts the server
client/src/
  App.jsx      Login form, the Tracker (state and data loading) and the undo toast
  Summary.jsx  Month picker, total, category split, stats, six-month chart, budget
  AddForm.jsx  Quick-add form (category chips, date, Enter to add)
  Ledger.jsx   Search, filters, day groups, inline edit, page buttons
  format.js    Rupee, month and date helpers
  hooks.js     useDebounced
  api.js       fetch helper
```

## API

| Method | Path | Needs login | What it does |
| --- | --- | --- | --- |
| GET | /api/health | no | `{ status: 'ok' }` for uptime checks |
| POST | /api/register | no | Create account, set login cookie |
| POST | /api/login | no | Check password, set login cookie (rate limited) |
| POST | /api/logout | no | Clear the cookie |
| GET | /api/me | yes | Who is logged in and their monthly budget |
| PUT | /api/budget | yes | Set the monthly budget |
| GET | /api/expenses | yes | One page of expenses: `?month=2026-10&category=Food&q=chai&page=1&limit=10&tz=-330` |
| GET | /api/summary | yes | Month total, category split, biggest, daily average and the last six months |
| GET | /api/expenses.csv | yes | Download your expenses as CSV |
| POST | /api/expenses | yes | Add an expense (optional `date`, not in the future) |
| PUT | /api/expenses/:id | yes | Edit one of your expenses |
| DELETE | /api/expenses/:id | yes | Delete one of your expenses |

## Limits

No password reset. Totals are calculated in JavaScript from the month's expenses, not with a MongoDB aggregation pipeline (a good next step). The login rate limiter lives in memory, so it resets when the server restarts and is not shared between servers. It is a learning project.
