'use strict';

/**
 * Admin middleware.
 * Must be used AFTER authMiddleware — relies on req.user being set.
 * Returns 403 if the authenticated user does not have the 'admin' role.
 */
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator role required.' });
  }

  return next();
};

module.exports = adminMiddleware;
