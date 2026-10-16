# Explaining SpendLog

**Why:** the smallest app that still covers what most web jobs need: accounts, a database, a protected API and a React front end.

**Flow:** the browser sends JSON to Express. Express checks the JWT cookie, reads or writes MongoDB through Mongoose, and returns JSON. React updates its state.

## Decisions
- Passwords are hashed with bcrypt; only the hash is stored.
- The JWT lives in an httpOnly cookie, so page scripts cannot read it.
- Every expense query includes the user id, so users cannot see, edit or delete each other's data.
- `createApp` takes the models as arguments so tests can use in-memory fakes.
- Totals, monthly charts and stats are computed from the one expenses list, never stored, so they cannot go out of date.

## How each feature works (say these out loud)

**Staying logged in on refresh.** The page calls `GET /api/me` once on load. If the cookie is valid the server returns the email and budget, and React shows the tracker; if not, it shows the login form. A "Loading" state avoids a flash of the login form.

**Editing an expense.** `PUT /api/expenses/:id` runs the same checks as adding one (`readExpense`), then `findOneAndUpdate` with both the id and the user id, so someone else's expense gives a 404. In React, clicking the pencil turns that row into a form (`editingId` plus a `draft`), and saving swaps the updated item into state.

**Monthly budget.** The budget is one number on the user. `PUT /api/budget` rejects negatives. The page compares the selected month's total with it and shows a progress bar, "left of budget" or "over budget".

**CSV export.** `GET /api/expenses.csv` builds the text in `csv.js`. Every value is quoted, and values starting with `=`, `+`, `-` or `@` get a quote in front so Excel cannot run them as formulas.

**Login rate limit.** `rateLimit.js` counts failed logins per IP and email. After 5 in 15 minutes the server answers 429, even for the right password, until the window passes. It lives in memory, so it resets on restart.

**Error handler.** Express 5 passes errors from async routes to one error middleware. A bad id becomes 404, a Mongoose validation error becomes 400, and anything else becomes a plain 500 without leaking details.

**Month navigation, stats and six-month chart (front end only).** `month` is a 'YYYY-MM' key in state. The arrows shift it with `shiftMonth`. `monthList` filters the expenses to that month, and the total, category split, daily average, biggest expense and top category are all computed from it. The chart sums each of the last six months and scales the bars to the biggest one; clicking a bar selects that month.

**Search and "Show more".** Typing searches titles across all months; with an empty box the list shows the selected month. `limit` starts at 10 and grows by 10 each time you press "Show more", and it resets when the month, filter or search changes.

## Limits
No password reset, and the list is paged in the browser, not by the server. The rate limiter is per server in memory. The tests use fake models, not a real MongoDB.
