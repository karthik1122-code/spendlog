import mongoose from 'mongoose';
import { User, Expense, LoginAttempt } from './models.js';
import { createApp } from './app.js';

const { MONGODB_URI, JWT_SECRET, PORT = 4000 } = process.env;
if (!MONGODB_URI || !JWT_SECRET) {
  console.error('Set MONGODB_URI and JWT_SECRET (see .env.example)');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
const app = createApp({ User, Expense, LoginAttempt, secret: JWT_SECRET, appUrl: process.env.APP_URL || '', log: true, dbReady: () => mongoose.connection.readyState === 1 });

// In production the same server also serves the built React app.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
app.use(express.static(dist));
app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')));

const server = app.listen(PORT, () => console.log(`SpendLog on http://localhost:${PORT}`));

// When the host stops the app, finish open requests and close the database cleanly.
process.on('SIGTERM', () => server.close(async () => { await mongoose.disconnect(); process.exit(0); }));
