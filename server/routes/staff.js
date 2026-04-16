const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database/connection');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Helper to safely add columns if they don't exist (runs on first request)
function ensureColumns() {
  try { db.exec('ALTER TABLE users ADD COLUMN photo_url TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE users ADD COLUMN department TEXT'); } catch (_) {}
}

router.get('/', authenticate, authorize('owner'), (req, res) => {
  ensureColumns();
  try {
    const staff = db.prepare(`
      SELECT id, uuid, email, phone, first_name, last_name, role,
             account_status, photo_url, notes, created_at
      FROM users WHERE agency_id = ? ORDER BY created_at DESC
    `).all(req.agency.id);
    const enriched = staff.map(s => {
      let extra = {};
      try { extra = JSON.parse(s.notes || '{}'); } catch (_) {}
      return { ...s, age: extra.age || '', working_hours: extra.working_hours || '', education: extra.education || '' };
    });
    res.json(enriched);
  } catch (err) {
    console.error('[staff GET]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, authorize('owner'), async (req, res) => {
  ensureColumns();
  try {
    const { email, phone, first_name, last_name, role, password, age, working_hours, education, photo_url } = req.body;
    if (!email || !first_name || !last_name || !role || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(password + salt, 10);
    const extra = JSON.stringify({ age, working_hours, education });
    const stmt = db.prepare(`
      INSERT INTO users (agency_id, email, phone, password_hash, salt, first_name, last_name, role, account_status, notes, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `);
    const info = stmt.run(req.agency.id, email, phone, passwordHash, salt, first_name, last_name, role, extra, photo_url || null);
    const newStaff = db.prepare('SELECT id, uuid, email, first_name, last_name, role, photo_url FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: newStaff });
  } catch (err) {
    console.error('[staff POST]', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT & DELETE remain the same (omitted for brevity but keep your existing ones)
module.exports = router;
