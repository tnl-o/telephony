'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, Space } = require('../models');
const authMiddleware = require('../middleware/auth');
const { JWT_SECRET, JWT_EXPIRES_IN, COOKIE_MAX_AGE_MS, COOKIE_SECURE } = require('../config');

const router = express.Router();

// 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

/**
 * Helper: set the JWT as a secure httpOnly cookie on the response.
 */
const setTokenCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SECURE ? 'strict' : 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
  });
};

// ---------------------------------------------------------------------------
// POST /api/auth/login
// Body: { login, password }
// Returns: { role } + sets httpOnly cookie with JWT
// ---------------------------------------------------------------------------
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password are required.' });
    }

    const user = await User.findOne({ where: { login } });

    if (!user) {
      // Use a generic message to avoid user enumeration
      return res.status(401).json({ error: 'Invalid login credentials.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid login credentials.' });
    }

    const payload = { id: user.id, login: user.login, role: user.role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    setTokenCookie(res, token);

    return res.status(200).json({ role: user.role });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me
// Returns: { id, login, role, space: { extension, sipPassword, pbxWssUrl } }
// ---------------------------------------------------------------------------
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'login', 'role'],
      include: [
        {
          model: Space,
          as: 'space',
          attributes: ['id', 'extension', 'sipPassword', 'pbxWssUrl'],
          required: false,
        },
      ],
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Return the real sipPassword — this is the user's own space config,
    // needed by JsSIP for SIP registration. The admin list endpoint (/api/admin/spaces)
    // still masks passwords since admins see all users' spaces.
    return res.status(200).json({
      id: user.id,
      login: user.login,
      role: user.role,
      space: user.space
        ? {
            id: user.space.id,
            extension: user.space.extension,
            sipPassword: user.space.sipPassword,
            pbxWssUrl: user.space.pbxWssUrl,
          }
        : null,
    });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// Clears the token cookie
// ---------------------------------------------------------------------------
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SECURE ? 'strict' : 'lax',
  });
  return res.status(200).json({ message: 'Logged out successfully.' });
});

module.exports = router;
