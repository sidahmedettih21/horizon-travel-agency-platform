const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { generateDailyQRToken } = require('../utils/qrGenerator');

router.get('/qr', authenticate, (req, res) => {
  const token = generateDailyQRToken(req.agency.id, new Date().toISOString().split('T')[0]);
  res.json({ token });
});

router.get('/', authenticate, authorize('owner', 'staff'), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 200);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM attendance WHERE agency_id = ?').get(req.agency.id).count;
    const records = db.prepare(`
      SELECT a.*, u.first_name, u.last_name
      FROM attendance a JOIN users u ON a.user_id = u.id
      WHERE a.agency_id = ? ORDER BY a.date DESC, a.check_in_time DESC LIMIT ? OFFSET ?
    `).all(req.agency.id, limit, offset);
    res.json({ data: records, pagination: { total, limit, offset } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/manual', authenticate, authorize('owner', 'staff'), (req, res) => {
  const { user_id, date, status } = req.body;
  if (!user_id || !date) return res.status(400).json({ error: 'Missing fields' });
  try {
    const stmt = db.prepare(`
      INSERT INTO attendance (agency_id, user_id, date, check_in_time, status)
      VALUES (?, ?, ?, TIME('now'), ?)
      ON CONFLICT(agency_id, user_id, date) DO UPDATE SET status=excluded.status, check_in_time=TIME('now')
    `);
    stmt.run(req.agency.id, user_id, date, status);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
