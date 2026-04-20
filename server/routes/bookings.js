const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const db = require('../database/connection');
const authorize = require('../middleware/authorize');
const authenticate = require('../middleware/authenticate');
const logger = require('../utils/logger');

router.get('/', authorize('owner', 'staff'), async (req, res) => {
  const agencyId = req.agency.id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM bookings WHERE agency_id = ?').get(agencyId).count;
    const bookings = db.prepare(`
      SELECT b.*, c.name as client_name, c.phone as client_phone
      FROM bookings b
      LEFT JOIN clients c ON b.client_id = c.id
      WHERE b.agency_id = ?
      ORDER BY b.created_at DESC LIMIT ? OFFSET ?
    `).all(agencyId, limit, offset);
    res.json({ data: bookings, pagination: { total, limit, offset } });
  } catch (err) {
    logger.error(`Bookings list error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get('/:uuid', authenticate, authorize('owner', 'staff'), (req, res) => {
  const booking = db.prepare(`
    SELECT b.*, c.name as client_name, c.phone as client_phone
    FROM bookings b JOIN clients c ON b.client_id = c.id
    WHERE b.uuid = ? AND b.agency_id = ?
  `).get(req.params.uuid, req.agency.id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (booking.details) booking.details = JSON.parse(booking.details);
  res.json(booking);
});
router.delete('/:uuid', authenticate, authorize('owner', 'staff'), (req, res) => {
  const stmt = db.prepare('DELETE FROM bookings WHERE uuid = ? AND agency_id = ?');
  const info = stmt.run(req.params.uuid, req.agency.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Booking not found' });
  res.json({ success: true });
});
router.post('/', authorize('owner', 'staff'), [
  body('client_id').isInt(),
  body('type').isIn(['omra', 'hajj', 'visa', 'flight', 'hotel', 'package']),
  body('total_amount').optional().isFloat(),
  body('notes').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });

  const agencyId = req.agency.id;
  const { client_id, staff_id, type, total_amount, currency = 'DZD', notes, travel_date, return_date } = req.body;

  try {
    const result = db.prepare(`
      INSERT INTO bookings (agency_id, client_id, staff_id, type, total_amount, currency, notes, travel_date, return_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(agencyId, client_id, staff_id || null, type, total_amount, currency, notes, travel_date, return_date);
    const newBooking = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(newBooking);
  } catch (err) {
    logger.error(`Create booking error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authorize('owner', 'staff'), [
  param('id').isInt()
], async (req, res) => {
  const agencyId = req.agency.id;
  const bookingId = req.params.id;
  const allowed = ["status","notes","total_amount","travel_date","return_date","staff_id"];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });

  try {
    const booking = db.prepare(`SELECT id FROM bookings WHERE id = ? AND agency_id = ?`).get(bookingId, agencyId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), bookingId, agencyId];
    db.prepare(`UPDATE bookings SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agency_id = ?`).run(...values);
    const updated = db.prepare(`SELECT * FROM bookings WHERE id = ?`).get(bookingId);
    res.json(updated);
  } catch (err) {
    logger.error(`Update booking error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
