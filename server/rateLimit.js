// Stops password guessing: after `max` failed logins for the same IP + email,
// further attempts are refused until the window passes. Kept in memory (resets on restart).
export function loginLimiter({ max = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const hits = new Map(); // key -> { count, resetAt }
  const live = key => {
    const h = hits.get(key);
    if (!h || h.resetAt <= Date.now()) { hits.delete(key); return null; }
    return h;
  };
  return {
    blocked: key => (live(key)?.count ?? 0) >= max,
    fail(key) {
      const h = live(key);
      if (h) h.count += 1; else hits.set(key, { count: 1, resetAt: Date.now() + windowMs });
    },
    clear: key => hits.delete(key),
  };
}
