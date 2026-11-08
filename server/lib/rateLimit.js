// Stops password guessing: after `max` failed logins for the same IP + email,
// further attempts are refused until the window passes.
// With a LoginAttempt model the counts live in MongoDB (they survive restarts and are shared
// between instances, and a TTL index deletes them). Without one they live in memory (used by tests).
export function loginLimiter({ max = 5, windowMs = 15 * 60 * 1000, LoginAttempt } = {}) {
  if (LoginAttempt) {
    return {
      async blocked(key) {
        const a = await LoginAttempt.findOne({ key, expiresAt: { $gt: new Date() } }).lean();
        return (a?.count ?? 0) >= max;
      },
      async fail(key) {
        const now = new Date();
        // An expired row the TTL sweeper has not removed yet starts a fresh window.
        await LoginAttempt.deleteOne({ key, expiresAt: { $lte: now } });
        await LoginAttempt.updateOne(
          { key },
          { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + windowMs) } },
          { upsert: true },
        );
      },
      async clear(key) { await LoginAttempt.deleteOne({ key }); },
    };
  }

  const hits = new Map(); // key -> { count, resetAt }
  const live = key => {
    const h = hits.get(key);
    if (!h || h.resetAt <= Date.now()) { hits.delete(key); return null; }
    return h;
  };
  return {
    blocked: async key => (live(key)?.count ?? 0) >= max,
    async fail(key) {
      const h = live(key);
      if (h) h.count += 1; else hits.set(key, { count: 1, resetAt: Date.now() + windowMs });
    },
    clear: async key => { hits.delete(key); },
  };
}
