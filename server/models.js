import mongoose from 'mongoose';
import { CATEGORIES } from './constants.js';

// A user: email + hashed password. We never store the plain password.
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  budget: { type: Number, default: 0, min: 0 }, // monthly budget in rupees, 0 means not set
  sessionVersion: { type: Number, default: 0 }, // bumped on password reset to sign out old cookies
  resetTokenHash: { type: String, default: null }, // sha256 of the emailed reset token, never the token itself
  resetTokenExpires: { type: Date, default: null },
});

// An expense belongs to one user. Amount is stored in rupees.
const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  category: { type: String, enum: CATEGORIES, default: 'Other' },
  date: { type: Date, default: Date.now },
});

// Most queries ask for one user's expenses newest first, so index exactly that.
expenseSchema.index({ user: 1, date: -1 });

// Failed logins per IP + email. MongoDB deletes each row when expiresAt passes (TTL index).
const loginAttemptSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LoginAttempt = mongoose.model('LoginAttempt', loginAttemptSchema);
export const User = mongoose.model('User', userSchema);
export const Expense = mongoose.model('Expense', expenseSchema);
