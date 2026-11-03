# SpendLog

A small full-stack expense tracker. Create an account, log what you spend, set a monthly budget, and see totals, category split and a six-month chart.

It is for students and anyone who wants to know where their money went before the month ends, without a bank connection or a spreadsheet. Adding an expense takes one line and Enter, so the form sits at the top of the dashboard.

**Stack:** React (Vite) · Express 5 · MongoDB with Mongoose · JWT in an httpOnly cookie · bcrypt

## Run it

```bash
npm install
cp .env.example .env        # fill in MONGODB_URI and JWT_SECRET
npm run server              # API on http://localhost:4000
npm run client              # React dev server (proxies /api to the API)
npm test                    # 16 API tests, no database needed
npm run build && MONGODB_URI=mongodb://localhost:27017/spendlog-e2e npm run test:e2e   # browser journey
```

Production: `npm run build`, then `npm run server` serves the API and the built React app from one port.

CI (`.github/workflows/ci.yml`) runs the API tests, the build and the browser journey (sign up, add, edit, delete with undo, reload, search) against a MongoDB service on every push and pull request.

Environment: `MONGODB_URI` (MongoDB connection string), `JWT_SECRET` (long random string; `render.yaml` generates one), optional `PORT` (default 4000). For password-reset email: `RESEND_API_KEY`, `EMAIL_FROM` (a sender on a domain verified in Resend) and `APP_URL` (the public site URL used in the link). Without a Resend key, reset links are printed to the server log.

## Layout

The server is split into layers. A request flows top to bottom, and each layer only talks to the one below it:

```
request -> middleware -> routes -> controllers -> services -> models -> MongoDB
```

```
server/
  index.js                 Connects to MongoDB, builds the app, starts listening
  app.js                   Wires the layers together (createApp takes models as arguments, so tests pass fakes)
  config/constants.js      Categories, password rules, limits: values shared by the API and the database
  models/index.js          User, Expense and LoginAttempt schemas (LoginAttempt rows expire through a TTL index)
  routes/                  URL -> controller, plus which routes need login
    index.js               Mounts every router under /api
    health.routes.js       GET /api/health
    auth.routes.js         register, login, logout, forgot, reset, me, budget
    expense.routes.js      expenses CRUD, summary, CSV
  controllers/             HTTP only: read req, call a service, write res (cookies, status codes)
    auth.controller.js
    expense.controller.js
  services/                Business rules and database calls; no req/res, throws AppError on bad input
    auth.service.js        Accounts, login lock, password reset, budget
    expense.service.js     List with filters and paging, summary, create, update, delete
  validators/              Pure checks for request input (expense fields, email, password, paging)
  middleware/
    auth.js                requireAuth: verifies the cookie and the session version
    security.js            Security headers and the request logger
    errorHandler.js        Turns AppError and library errors into JSON with the right status
  lib/                     Small helpers with no Express or database code
    AppError.js            Error with an HTTP status (badRequest, notFound, ...)
    session.js             Sign, set, clear and read the JWT cookie
    rateLimit.js           Failed-login counter (MongoDB in production, memory in tests)
    email.js               Sends the reset email through Resend, or prints it in development
    csv.js                 Builds the CSV download and neutralises spreadsheet formulas
    dates.js               Time-zone aware month ranges, regex escaping, the summary builder
  tests/api.test.js        API tests with in-memory fake models
client/src/
  main.jsx, App.jsx        Entry; App chooses the landing page or the dashboard
  pages/
    Landing.jsx            Marketing page and the sign-in / sign-up / reset dialog
    Dashboard.jsx          Signed-in page: holds state, loads data, passes it to components
  components/
    Kpis.jsx               Four headline cards: spent, budget, daily average, top category
    Insights.jsx           Six-month chart and the category breakdown
    AddForm.jsx            Quick-add form (category chips, date, Enter to add)
    Ledger.jsx             Transactions: search, filters, inline edit, page buttons
    Toast.jsx              Undo message after a delete
  lib/
    api.js                 fetch helper that throws the server's error message
    format.js              Rupee, month and date helpers
    hooks.js               useDebounced
e2e/                       Browser tests (Playwright) against the real server and MongoDB
```

### Where to change things

| You want to... | Change |
| --- | --- |
| Add an API endpoint | Route in `routes/`, handler in `controllers/`, logic in `services/` |
| Add a field to expenses | `models/index.js` (schema), `validators/expense.validator.js` (check), `components/AddForm.jsx` (form) |
| Change a business rule (limits, who can see what) | `services/` |
| Change an error message or status | The service that throws it (`lib/AppError.js` helpers) |
| Add a category | `config/constants.js` (the client reads the same list in `lib/format.js`) |
| Protect a route with login | Add `requireAuth` to it in `routes/` |
| Change the dashboard layout | `pages/Dashboard.jsx` and the component it renders |

## API

| Method | Path | Needs login | What it does |
| --- | --- | --- | --- |
| GET | /api/health | no | `{ status, db }`: 200 when MongoDB is connected, 503 when it is not (Render uses this) |
| POST | /api/register | no | Create account, set login cookie |
| POST | /api/login | no | Check password, set login cookie (rate limited) |
| POST | /api/forgot | no | Email a single-use reset link (30 minutes). Same reply whether or not the account exists |
| POST | /api/reset | no | `{ token, password }`: set a new password, sign out other devices, sign in here |
| POST | /api/logout | no | Clear the cookie |
| GET | /api/me | yes | Who is logged in and their monthly budget |
| PUT | /api/budget | yes | Set the monthly budget |
| GET | /api/expenses | yes | One page of expenses: `?month=2026-10&category=Food&q=chai&page=1&limit=10&tz=-330` |
| GET | /api/summary | yes | Month total, category split, biggest, daily average and the last six months |
| GET | /api/expenses.csv | yes | Download all your expenses as CSV (every month, not only the filtered view) |
| POST | /api/expenses | yes | Add an expense (optional `date`, not in the future) |
| PUT | /api/expenses/:id | yes | Edit one of your expenses |
| DELETE | /api/expenses/:id | yes | Delete one of your expenses |

## Limits

Request bodies are capped at 100 kb; titles at 120 characters. Totals are calculated in JavaScript from the month's expenses, not with a MongoDB aggregation pipeline (a good next step). Failed logins are counted in MongoDB, so the lock survives restarts and is shared between servers. Password-reset email needs a Resend account with a verified sender. It is a learning project.
