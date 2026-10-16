# Explaining SpendLog

**Why:** the smallest app that still covers what most web jobs need: accounts, a database, a protected API and a React front end.

**Flow:** the browser sends JSON to Express. Express checks the JWT cookie, reads or writes MongoDB through Mongoose, and returns JSON. React updates its state.

## Decisions
- Passwords are hashed with bcrypt; only the hash is stored.
- The JWT lives in an httpOnly cookie, so page scripts cannot read it.
- Every expense query includes the user id, so users cannot see, edit or delete each other's data.
- `createApp` takes the models as arguments so tests can use in-memory fakes.
- Totals, charts and stats are computed from the expenses on request, never stored, so they cannot go out of date.
- Filtering, searching and paging happen in the database (`skip`/`limit` plus a `countDocuments`), and a compound index `{ user, date }` backs the common query.
- Months follow the user's clock: the browser sends its time-zone offset and the server builds the month edges from it.

## How each feature works (say these out loud)

**Staying logged in on refresh.** The page calls `GET /api/me` once on load. If the cookie is valid the server returns the email and budget, and React shows the tracker; if not, it shows the login form. A "Loading" state avoids a flash of the login form.

**Editing an expense.** `PUT /api/expenses/:id` runs the same checks as adding one (`readExpense`), then `findOneAndUpdate` with both the id and the user id, so someone else's expense gives a 404. In React, clicking the pencil turns that row into a form (`editingId` plus a `draft`), and saving swaps the updated item into state.

**Monthly budget.** The budget is one number on the user. `PUT /api/budget` rejects negatives. The page compares the selected month's total with it and shows a progress bar, "left of budget" or "over budget".

**CSV export.** `GET /api/expenses.csv` builds the text in `csv.js`. Every value is quoted, and values starting with `=`, `+`, `-` or `@` get a quote in front so Excel cannot run them as formulas.

**Login rate limit.** `rateLimit.js` counts failed logins per IP and email. After 5 in 15 minutes the server answers 429, even for the right password, until the window passes. It lives in memory, so it resets on restart.

**Error handler.** Express 5 passes errors from async routes to one error middleware. A bad id becomes 404, a Mongoose validation error becomes 400, and anything else becomes a plain 500 without leaking details.

**Paged list and search (server).** `GET /api/expenses` builds one Mongo filter from the query string: always the user id, then category, then either a title search (case-insensitive, with regex characters escaped so `(` cannot break it) or a month range. It returns `{ items, total, page, pages }`. A search ignores the month, so it finds old expenses too.

**Summary (server).** `GET /api/summary` loads only the date range it needs and passes it to the pure function `buildSummary`, which returns the total, category split, biggest expense, top category, daily average and the last six months. Because it is a pure function it has its own tests.

**Month navigation and the chart (client).** `month` is a 'YYYY-MM' key in state; the arrows shift it. Changing it refetches both the summary and the list. Clicking a bar in the six-month chart selects that month.

**Loading data without bugs (client).** Each `useEffect` sets an `ignore` flag in its cleanup, so a slow old response cannot overwrite a newer one. Search is debounced (`useDebounced`): it waits 300 ms after you stop typing before asking the server.

**Quick add, undo and toast (client).** After adding, focus returns to the title box so you can keep typing. Deleting shows a toast with Undo that re-creates the expense with its original date; the toast closes itself after 6 seconds.

**Security and operations (server).** Security headers on every response, `x-powered-by` removed, `trust proxy` so the rate limiter sees the real visitor behind Render, a one-line request log, `/api/health`, and a clean shutdown on SIGTERM.

**Landing page and sign-in (client).** Logged-out visitors see `Landing.jsx`: a hero, a clearly labelled sample dashboard, a features grid and three steps. "Get started" and "Log in" open the sign-in form in a native `<dialog>`, which gives focus trapping and Esc-to-close for free. After a successful login the app swaps to the dashboard.

**Dashboard layout (client).** A top bar with month arrows and the user, four KPI cards (the change vs last month is `(this - last) / last` taken from the six-month history the server already sent), two charts, the quick-add form and a transactions table. Pressing `/` focuses the search box. On phones the table rows turn into stacked cards with CSS only.

## Limits
No password reset. Summaries are calculated in JavaScript, not with a MongoDB aggregation pipeline. The rate limiter is per server in memory. The tests use fake models, not a real MongoDB.
