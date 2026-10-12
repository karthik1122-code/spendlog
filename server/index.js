import mongoose from 'mongoose';
import { User, Expense } from './models.js';
import { createApp } from './app.js';

const { MONGODB_URI, JWT_SECRET, PORT = 4000 } = process.env;
if (!MONGODB_URI || !JWT_SECRET) {
  console.error('Set MONGODB_URI and JWT_SECRET (see .env.example)');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
const app = createApp({ User, Expense, secret: JWT_SECRET });

// In production the same server also serves the built React app.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
app.use(express.static(dist));
app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(PORT, () => console.log(`SpendLog on http://localhost:${PORT}`));
