'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const { User, Space } = require('../models');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const { BCRYPT_SALT_ROUNDS } = require('../config');

const router = express.Router();

// Apply auth + admin guard to every route in this router
router.use(authMiddleware, adminMiddleware);

// ===========================================================================
// USERS
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/admin/users
// Returns list of all users (without passwordHash), each with their space
// ---------------------------------------------------------------------------
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'login', 'role', 'createdAt', 'updatedAt'],
      include: [
        {
          model: Space,
          as: 'space',
          attributes: ['id', 'extension', 'pbxWssUrl'],
          required: false,
        },
      ],
      order: [['id', 'ASC']],
    });

    return res.status(200).json(users);
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/users
// Body: { login, password, role? }
// Creates a new user
// ---------------------------------------------------------------------------
router.post('/users', async (req, res, next) => {
  try {
    const { login, password, role } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password are required.' });
    }

    if (typeof login !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Login and password must be strings.' });
    }

    if (login.length < 3 || login.length > 100) {
      return res.status(400).json({ error: 'Login must be between 3 and 100 characters.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: "Role must be either 'user' or 'admin'." });
    }

    const existing = await User.findOne({ where: { login } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this login already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const user = await User.create({
      login,
      passwordHash,
      role: role || 'user',
    });

    return res.status(201).json({
      id: user.id,
      login: user.login,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.errors.map((e) => e.message).join(', ') });
    }
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id/password
// Body: { password }
// Updates the password for a specific user
// ---------------------------------------------------------------------------
router.patch('/users/:id/password', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'New password is required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    await user.update({ passwordHash });

    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id
// Deletes a user (and their space via CASCADE)
// ---------------------------------------------------------------------------
router.delete('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (parseInt(id, 10) === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await user.destroy();

    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (err) {
    return next(err);
  }
});

// ===========================================================================
// SPACES
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /api/admin/spaces
// Returns list of all spaces with their associated user (login only)
// ---------------------------------------------------------------------------
router.get('/spaces', async (req, res, next) => {
  try {
    const spaces = await Space.findAll({
      attributes: ['id', 'extension', 'pbxWssUrl', 'userId', 'createdAt', 'updatedAt'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'login', 'role'],
        },
      ],
      order: [['id', 'ASC']],
    });

    // Mask SIP passwords in list responses
    const maskedSpaces = spaces.map((space) => {
      const data = space.toJSON();
      data.sipPassword = '****';
      return data;
    });

    return res.status(200).json(maskedSpaces);
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/spaces
// Body: { extension, sipPassword, pbxWssUrl, userId }
// Creates a new space and associates it with a user
// ---------------------------------------------------------------------------
router.post('/spaces', async (req, res, next) => {
  try {
    const { extension, sipPassword, pbxWssUrl, userId } = req.body;

    if (!extension || !sipPassword || !pbxWssUrl || !userId) {
      return res.status(400).json({
        error: 'extension, sipPassword, pbxWssUrl, and userId are all required.',
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const existingSpace = await Space.findOne({ where: { userId } });
    if (existingSpace) {
      return res.status(409).json({
        error: 'This user already has a space. Use PUT to update it.',
      });
    }

    const space = await Space.create({ extension, sipPassword, pbxWssUrl, userId });

    // Return masked password
    const responseData = space.toJSON();
    responseData.sipPassword = '****';
    return res.status(201).json(responseData);
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.errors.map((e) => e.message).join(', ') });
    }
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/spaces/:id
// Body: { extension?, sipPassword?, pbxWssUrl?, userId? }
// Fully or partially updates a space record
// ---------------------------------------------------------------------------
router.put('/spaces/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { extension, sipPassword, pbxWssUrl, userId } = req.body;

    const space = await Space.findByPk(id);
    if (!space) {
      return res.status(404).json({ error: 'Space not found.' });
    }

    // If changing userId, verify target user exists and has no other space
    if (userId !== undefined && userId !== space.userId) {
      const targetUser = await User.findByPk(userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found.' });
      }

      const conflictSpace = await Space.findOne({ where: { userId } });
      if (conflictSpace) {
        return res.status(409).json({
          error: 'The target user already has a space assigned.',
        });
      }
    }

    const updates = {};
    if (extension !== undefined) updates.extension = extension;
    if (sipPassword !== undefined) updates.sipPassword = sipPassword;
    if (pbxWssUrl !== undefined) updates.pbxWssUrl = pbxWssUrl;
    if (userId !== undefined) updates.userId = userId;

    await space.update(updates);
    await space.reload();

    // Return masked password
    const responseData = space.toJSON();
    responseData.sipPassword = '****';
    return res.status(200).json(responseData);
  } catch (err) {
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: err.errors.map((e) => e.message).join(', ') });
    }
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/spaces/:id
// Deletes a space record
// ---------------------------------------------------------------------------
router.delete('/spaces/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const space = await Space.findByPk(id);
    if (!space) {
      return res.status(404).json({ error: 'Space not found.' });
    }

    await space.destroy();

    return res.status(200).json({ message: 'Space deleted successfully.' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
