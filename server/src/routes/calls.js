'use strict';

const express = require('express');
const { CallHistory } = require('../models');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// ---------------------------------------------------------------------------
// GET /api/calls
// Returns the last 50 call history records for the authenticated user
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const records = await CallHistory.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 50,
      attributes: ['id', 'direction', 'number', 'duration', 'createdAt'],
    });

    return res.status(200).json(records);
  } catch (err) {
    return next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/calls
// Body: { direction: 'incoming'|'outgoing'|'missed', number: string, duration: number }
// Creates a call history record for the authenticated user
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { direction, number, duration } = req.body;

    if (!direction || !number) {
      return res.status(400).json({ error: 'direction and number are required.' });
    }

    if (!['incoming', 'outgoing', 'missed'].includes(direction)) {
      return res
        .status(400)
        .json({ error: "direction must be 'incoming', 'outgoing', or 'missed'." });
    }

    const durationSec = Number.isFinite(Number(duration)) ? Math.max(0, Math.floor(Number(duration))) : 0;

    const record = await CallHistory.create({
      userId: req.user.id,
      direction,
      number: String(number).slice(0, 100),
      duration: durationSec,
    });

    return res.status(201).json({
      id: record.id,
      direction: record.direction,
      number: record.number,
      duration: record.duration,
      createdAt: record.createdAt,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
