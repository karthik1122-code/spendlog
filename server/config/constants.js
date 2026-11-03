// Values shared by the API and the database, kept in one place so they cannot drift apart.

// The five spending categories.
export const CATEGORIES = ['Food', 'Travel', 'Study', 'Fun', 'Other'];

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD = { min: 6, max: 128 };
export const RESET_TTL_MS = 30 * 60 * 1000;   // password-reset links work for 30 minutes
export const BODY_LIMIT = '100kb';            // one expense is tiny; refuse huge bodies early
export const PAGE = { defaultLimit: 10, maxLimit: 50 };
