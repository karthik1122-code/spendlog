import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { RESET_TTL_MS } from '../config/constants.js';
import { badRequest, conflict, tooMany, unauthorized } from '../lib/AppError.js';
import { isEmail, isPassword, isResetToken, PASSWORD_RULE } from '../validators/auth.validator.js';

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
export const publicUser = user => ({ email: user.email, budget: user.budget || 0 });

// Accounts: register, login, password reset. Knows nothing about HTTP; throws AppError on bad input.
export function createAuthService({ User, limiter, sendEmail }) {
  return {
    async register({ email, password }) {
      if (!isEmail(email) || typeof password !== 'string') throw badRequest('Enter a valid email address');
      if (!isPassword(password)) throw badRequest(PASSWORD_RULE);
      if (await User.findOne({ email })) throw conflict('That email is already registered');
      return User.create({ email, passwordHash: await bcrypt.hash(password, 10) });
    },

    // `ip` is part of the lock key, so one attacker cannot lock everyone out of an account from elsewhere.
    async login({ email, password }, ip) {
      if (typeof email !== 'string' || typeof password !== 'string') throw badRequest('Enter your email and password');
      const key = `${ip}|${email.toLowerCase()}`;
      if (await limiter.blocked(key)) throw tooMany('Too many attempts. Try again in 15 minutes, or reset your password');
      const user = await User.findOne({ email });
      // Same message for "no such user" and "wrong password" so attackers learn nothing.
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        await limiter.fail(key);
        throw unauthorized('Wrong email or password');
      }
      await limiter.clear(key);
      return user;
    },

    // Emails a single-use link. Silent when the email has no account, so it cannot be used to find accounts.
    async requestReset(rawEmail, ip, baseUrl) {
      const email = String(rawEmail || '').trim().toLowerCase();
      if (!isEmail(email)) throw badRequest('Enter a valid email address');
      const key = `forgot|${ip}`;
      if (await limiter.blocked(key)) throw tooMany('Too many reset requests. Try again in 15 minutes');
      await limiter.fail(key); // counts requests, so one visitor cannot flood someone's inbox
      const user = await User.findOne({ email });
      if (!user) return;
      const token = crypto.randomBytes(32).toString('base64url');
      await User.findByIdAndUpdate(user.id, { resetTokenHash: sha256(token), resetTokenExpires: new Date(Date.now() + RESET_TTL_MS) });
      try {
        await sendEmail({
          to: user.email,
          subject: 'Reset your SpendLog password',
          text: `Someone asked to reset the password for this SpendLog account.\n\nChoose a new password here (the link works for 30 minutes, once):\n${baseUrl}/?reset=${token}\n\nIf it was not you, ignore this email. Your password has not changed.`,
        });
      } catch (err) {
        console.error('Password reset email failed:', err.message);
      }
    },

    // Sets the new password and bumps the session version, which signs out every old cookie.
    async resetPassword({ token, password }, ip) {
      if (!isResetToken(token)) throw badRequest('This reset link is not valid. Ask for a new one');
      if (!isPassword(password)) throw badRequest(PASSWORD_RULE);
      const user = await User.findOne({ resetTokenHash: sha256(token) });
      if (!user || !user.resetTokenExpires || new Date(user.resetTokenExpires) < new Date()) {
        throw badRequest('This reset link has expired or was already used. Ask for a new one');
      }
      const updated = await User.findByIdAndUpdate(user.id, {
        passwordHash: await bcrypt.hash(password, 10),
        resetTokenHash: null,
        resetTokenExpires: null,
        sessionVersion: (user.sessionVersion || 0) + 1,
      }, { new: true });
      await limiter.clear(`${ip}|${user.email}`);
      return updated;
    },

    async setBudget(userId, raw) {
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < 0) throw badRequest('Budget must be zero or more');
      return User.findByIdAndUpdate(userId, { budget: amount }, { new: true });
    },
  };
}
