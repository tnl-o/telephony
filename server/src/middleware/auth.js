'use strict';

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { JWT_SECRET } = require('../config');

/**
 * Authentication middleware.
 * Reads the JWT from the httpOnly cookie named "token",
 * verifies it, and attaches the full user record to req.user.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies && req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired. Please log in again.' });
      }
      return res.status(401).json({ error: 'Invalid token. Please log in again.' });
    }

    const user = await User.findByPk(payload.id, {
      attributes: ['id', 'login', 'role'],
    });

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }

    req.user = user;
    return next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server error during authentication.' });
  }
};

module.exports = authMiddleware;
