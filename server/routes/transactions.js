const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../database/connection');
const authorize = require('../middleware/authorize');
const logger = require('../utils/logger');

router.get('/', authorize('owner', 'staff'), async (req, res) => {
  const agencyId = req.agency.id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE agency_id = ?').get(agencyId).count;
    const transactions = db.prepare(`
      SELECT * FROM transactions WHERE agency_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(agencyId, limit, offset);
    res.json({ data: transactions, pagination: { total, limit, offset } });
  } catch (err) {
    logger.error(`Transactions list error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authorize('owner', 'staff'), [
  body('booking_id').optional().isInt(),
  body('type').isIn(['income', 'expense']),
  body('amount').isFloat(),
  body('payment_method').optional().isIn(['cash', 'ccp', 'dahabia', 'baridimob', 'virement'])
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });

  const agencyId = req.agency.id;
  const { booking_id, type, amount, currency = 'DZD', payment_method, description, reference } = req.body;

  try {
    const result = db.prepare(`
      INSERT INTO transactions (agency_id, booking_id, type, amount, currency, payment_method, description, reference)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(agencyId, booking_id || null, type, amount, currency, payment_method, description, reference);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    logger.error(`Create transaction error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/summary', authorize('owner', 'staff'), async (req, res) => {
  const agencyId = req.agency.id;
  try {
    const summary = db.prepare(`
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
      FROM transactions WHERE agency_id = ?
    `).get(agencyId);
    res.json(summary);
  } catch (err) {
    logger.error(`Transaction summary error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
