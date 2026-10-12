# Explaining SpendLog

**Why:** the smallest app that still covers what most web jobs need: accounts, a database, a protected API and a React front end.

**Flow:** the browser sends JSON to Express. Express checks the JWT cookie, reads or writes MongoDB through Mongoose, and returns JSON. React updates its state.

**Decisions**
- Passwords are hashed with bcrypt; only the hash is stored.
- The JWT lives in an httpOnly cookie, so page scripts cannot read it.
- Every expense query includes the user id, so users cannot see or delete each other's data.
- `createApp` takes the models as arguments so tests can use in-memory fakes.
- Totals are computed from the list, never stored, so they cannot go out of date.

**Limits:** no edit, pagination, password reset or rate limiting; the tests use fake models, not a real MongoDB.
