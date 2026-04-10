'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const db = require('./models');
const { BCRYPT_SALT_ROUNDS } = require('./config');
const { runMigrations } = require('./migrations');
const authRoutes  = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const callsRoutes = require('./routes/calls');

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost';

// Trust proxy — required for express-rate-limit to see real client IP behind Nginx
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// CORS — allow the configured frontend origin and allow credentials (cookies)
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ---------------------------------------------------------------------------
// Body parsing & cookie parsing
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Health-check endpoint (no auth required)
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/auth',  authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/calls', callsRoutes);

// ---------------------------------------------------------------------------
// 404 handler — catch requests to unknown routes
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Sequelize unique constraint violation
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors && err.errors[0] ? err.errors[0].path : 'field';
    return res.status(409).json({ error: `A record with this ${field} already exists.` });
  }

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    return res
      .status(400)
      .json({ error: err.errors.map((e) => e.message).join(', ') });
  }

  // JWT errors surfaced outside middleware
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'An unexpected error occurred. Please try again later.'
      : err.message || 'Internal Server Error';

  return res.status(statusCode).json({ error: message });
});

// ---------------------------------------------------------------------------
// Database sync + seed + server start
// ---------------------------------------------------------------------------
const seedDefaultAdmin = async () => {
  const { User } = db;

  const adminCount = await User.count({ where: { role: 'admin' } });

  if (adminCount === 0) {
    // Generate a random password and log it once
    const randomPassword = crypto.randomBytes(16).toString('hex');
    console.log('No admin user found — creating default admin (login: admin)');
    console.log(`⚠️  DEFAULT ADMIN PASSWORD: ${randomPassword}`);
    console.log('⚠️  Save this password and change it immediately after first login!');

    const passwordHash = await bcrypt.hash(randomPassword, BCRYPT_SALT_ROUNDS);
    await User.create({
      login: 'admin',
      passwordHash,
      role: 'admin',
    });
  }
};

const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('[db] Connection established.');

    await runMigrations(db.sequelize);
    console.log('[db] Migrations complete.');

    await seedDefaultAdmin();

    app.listen(PORT, () => {
      console.log(`[server] Listening on port ${PORT}`);
      console.log(`[server] Frontend origin: ${FRONTEND_ORIGIN}`);
      console.log(`[server] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('[startup] Fatal error:', err);
    process.exit(1);
  }
};

startServer();

module.exports = app;
