require('dotenv').config();
require('express-async-errors');

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { Pool } = require('pg');

const app = express();

// ── DATABASE ────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
app.locals.db = pool;

// ── MIDDLEWARE ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── FRONTEND — serve the public folder ─────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API ROUTES ──────────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/members', require('./routes/members'));
app.use('/api/verify',  require('./routes/verify'));
app.use('/api/stats',   require('./routes/stats'));

// ── HEALTH CHECK ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── FALLBACK — all other routes serve the frontend ──────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── ERROR HANDLER ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── START ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BGS running on port ${PORT}`));

module.exports = app;
