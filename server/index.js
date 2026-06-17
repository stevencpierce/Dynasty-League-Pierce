'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const config = require('./config');
const { seed } = require('./seed');

// Bootstrap data (commissioner, settings, starter bylaws) before serving.
seed();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 14 },
  })
);

// API routes.
app.use('/api/auth', require('./routes/auth'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/league', require('./routes/league'));
app.use('/api/cap', require('./routes/cap'));
app.use('/api/trades', require('./routes/trades'));
app.use('/api/bylaws', require('./routes/bylaws'));
app.use('/api/extras', require('./routes/extras'));
app.use('/api/import', require('./routes/importer'));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// Static frontend.
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA fallback for non-API GET routes.
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// JSON error handler.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(config.port, () => {
  console.log(`Dynasty League Pierce running at http://localhost:${config.port}`);
});

module.exports = { app, server };
