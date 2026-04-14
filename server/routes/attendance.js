const express = require('express');
const router = express.Router();
const { query, body, validationResult } = require('express-validator');
const db = require('../database/connection');
const authorize = require('../middleware/authorize');
const logger = require('../utils/logger');
const { generateDailyQRToken, generateQRImage } = require('../utils/qrGenerator');

router.get('/qr', authorize('owner', 'staff'), async (req, res) => {
  const agencyId = req.agency.id;
  const dateStr = new Date().toISOString().split('T')[0];
  const token = generateDailyQRToken(agencyId, dateStr);
  try {
    const buffer = await generateQRImage(token);
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    logger.error(`QR generation error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/scan', authorize('trainee', 'staff', 'owner'), [
  body('token').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });

  const agencyId = req.agency.id;
  const { token } = req.body;
  const userId = req.user.id;
  const dateStr = new Date().toISOString().split('T')[0];
  const expectedToken = generateDailyQRToken(agencyId, dateStr);

  if (token !== expectedToken) {
    return res.status(400).json({ error: 'Invalid QR token' });
  }

  const now = new Date();
  const hour = now.getHours();
  const settings = JSON.parse(req.agency.settings || '{}');
  const windowStart = settings.attendance_start_hour || 8;
  const windowEnd = settings.attendance_end_hour || 11;
  if (hour < windowStart || hour > windowEnd) {
    return res.status(400).json({ error: 'Outside attendance window', message: `Only between ${windowStart}:00 and ${windowEnd}:00` });
  }

  const allowed = (process.env.ALLOWED_QR_IPS || '').split(',').map(s => s.trim());
  const clientIP = req.ip || req.connection.remoteAddress;
  // Simple exact-match or prefix-match (e.g., "192.168.1." matches all in that subnet)
  const ipOk = allowed.some(range => {
    if (range.includes('/')) {
      // For now, just strip the CIDR and do prefix match
  const base = range.split('/')[0];
      return clientIP.startsWith(base);
    }
    return clientIP === range || clientIP.startsWith(range);
  });
  if (!ipOk) {
    return res.status(403).json({ error: 'IP not allowed for attendance' });
  }

  try {
    const result = db.prepare(`
      INSERT OR REPLACE INTO attendance (agency_id, user_id, date, check_in_time, status, ip_address, qr_token)
      VALUES (?, ?, ?, time('now'), 'present', ?, ?)
    `).run(agencyId, userId, dateStr, clientIP, token);
    res.json({ message: 'Attendance recorded', status: 'present' });
  } catch (err) {
    logger.error(`Scan error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', authorize('owner', 'staff'), async (req, res) => {
  const agencyId = req.agency.id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM attendance WHERE agency_id = ?').get(agencyId).count;
    const records = db.prepare(`
      SELECT a.*, u.first_name, u.last_name
      FROM attendance a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.agency_id = ? ORDER BY a.date DESC LIMIT ? OFFSET ?
    `).all(agencyId, limit, offset);
    res.json({ data: records, pagination: { total, limit, offset } });
  } catch (err) {
    logger.error(`Attendance list error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
