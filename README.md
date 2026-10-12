# SpendLog

A small full-stack expense tracker. Create an account, log what you spend, see totals by category.

**Stack:** React (Vite) · Express 5 · MongoDB with Mongoose · JWT in an httpOnly cookie · bcrypt

## Run it

```bash
npm install
cp .env.example .env        # fill in MONGODB_URI and JWT_SECRET
npm run server              # API on http://localhost:4000
npm run client              # React dev server (proxies /api to the API)
npm test                    # 3 tests, no database needed
```

Production: `npm run build`, then `npm run server` serves the API and the built React app from one port.

## Layout

```
server/
  models.js    User and Expense schemas
  auth.js      JWT cookie helpers and the requireAuth middleware
  app.js       All routes (register, login, logout, expenses)
  app.test.js  Tests with in-memory fake models
  index.js     Connects to MongoDB, starts the server
client/src/
  App.jsx      Login form and the expense tracker
  api.js       fetch helper
```

## API

| Method | Path | Needs login | What it does |
| --- | --- | --- | --- |
| POST | /api/register | no | Create account, set login cookie |
| POST | /api/login | no | Check password, set login cookie |
| POST | /api/logout | no | Clear the cookie |
| GET | /api/expenses | yes | Your expenses, newest first |
| POST | /api/expenses | yes | Add an expense |
| DELETE | /api/expenses/:id | yes | Delete one of your expenses |

## Limits

No edit, no pagination, no password reset, no rate limiting. It is a learning project.
