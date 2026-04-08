const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const db = require('../database/connection');
const authorize = require('../middleware/authorize');
const logger = require('../utils/logger');

router.get('/', authorize('owner', 'staff', 'trainee'), async (req, res) => {
  const agencyId = req.agency.id;
  try {
    const notifications = db.prepare(`SELECT * FROM notifications WHERE agency_id = ? AND user_id = ? ORDER BY created_at DESC`).all(agencyId, req.user.id);
    res.json(notifications);
  } catch (err) {
    logger.error(`Notifications list error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/read', authorize('owner', 'staff', 'trainee'), [
  param('id').isInt()
], async (req, res) => {
  const agencyId = req.agency.id;
  const id = req.params.id;
  try {
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND agency_id = ? AND user_id = ?`).run(id, agencyId, req.user.id);
    res.json({ message: 'Notification marked read' });
  } catch (err) {
    logger.error(`Mark read error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
