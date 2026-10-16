import mongoose from 'mongoose';
import { CATEGORIES } from './constants.js';

// A user: email + hashed password. We never store the plain password.
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  budget: { type: Number, default: 0, min: 0 }, // monthly budget in rupees, 0 means not set
});

// An expense belongs to one user. Amount is stored in rupees.
const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  category: { type: String, enum: CATEGORIES, default: 'Other' },
  date: { type: Date, default: Date.now },
});

export const User = mongoose.model('User', userSchema);
export const Expense = mongoose.model('Expense', expenseSchema);
