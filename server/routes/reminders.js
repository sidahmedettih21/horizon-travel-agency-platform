const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const db = require('../database/connection');
const authorize = require('../middleware/authorize');
const logger = require('../utils/logger');

router.get('/', authorize('owner', 'staff', 'trainee'), async (req, res) => {
  const agencyId = req.agency.id;
  try {
    const reminders = db.prepare(`SELECT * FROM reminders WHERE agency_id = ? AND staff_id = ?`).all(agencyId, req.user.id);
    res.json(reminders);
  } catch (err) {
    logger.error(`Reminders list error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/done', authorize('owner', 'staff', 'trainee'), [
  param('id').isInt()
], async (req, res) => {
  const agencyId = req.agency.id;
  const id = req.params.id;
  try {
    db.prepare(`UPDATE reminders SET is_done = 1 WHERE id = ? AND agency_id = ? AND staff_id = ?`).run(id, agencyId, req.user.id);
    res.json({ message: 'Reminder marked done' });
  } catch (err) {
    logger.error(`Mark done error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
