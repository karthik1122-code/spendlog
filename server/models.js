import mongoose from 'mongoose';

// A user: email + hashed password. We never store the plain password.
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
});

// An expense belongs to one user. Amount is stored in rupees.
const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  category: { type: String, enum: ['Food', 'Travel', 'Study', 'Fun', 'Other'], default: 'Other' },
  date: { type: Date, default: Date.now },
});

export const User = mongoose.model('User', userSchema);
export const Expense = mongoose.model('Expense', expenseSchema);
