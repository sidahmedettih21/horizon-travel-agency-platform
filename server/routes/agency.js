const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../database/connection');
const authorize = require('../middleware/authorize');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

router.get('/', authorize('owner'), (req, res) => {
  res.json(req.agency);
});

router.post('/staff', authorize('owner'), [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('first_name').trim().notEmpty(),
  body('last_name').trim().notEmpty(),
  body('role').isIn(['staff', 'trainee']),
  body('phone').optional().trim(),
  body('wilaya').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });

  const agencyId = req.agency.id;
  const { email, password, first_name, last_name, role, phone, wilaya } = req.body;

  try {
    const currentStaff = db.prepare(`
      SELECT COUNT(*) as count FROM users 
      WHERE agency_id = ? AND role IN ('staff', 'trainee') AND account_status = 'active'
    `).get(agencyId).count;

    if (currentStaff >= req.agency.max_staff) {
      return res.status(429).json({ error: 'Staff limit reached', message: `Maximum ${req.agency.max_staff} staff allowed` });
    }

    const existing = db.prepare(`SELECT id FROM users WHERE agency_id = ? AND email = ?`).get(agencyId, email);
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await bcrypt.hash(password + salt, 12);

    const result = db.prepare(`
      INSERT INTO users (agency_id, email, phone, password_hash, salt, first_name, last_name, role, wilaya)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(agencyId, email, phone, hash, salt, first_name, last_name, role, wilaya);

    const newUser = db.prepare(`SELECT id, uuid, email, first_name, last_name, role, wilaya, created_at FROM users WHERE id = ?`).get(result.lastInsertRowid);

    res.status(201).json({ message: 'Staff created successfully', user: newUser });
  } catch (err) {
    logger.error(`Create staff error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/staff', authorize('owner'), (req, res) => {
  const agencyId = req.agency.id;
  const staff = db.prepare(`
    SELECT id, uuid, email, first_name, last_name, role, wilaya, account_status, created_at 
    FROM users WHERE agency_id = ? AND role IN ('staff', 'trainee')
  `).all(agencyId);
  res.json(staff);
});

router.put('/', authorize('owner'), [
  body('primary_color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('secondary_color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('logo_url').optional().isURL(),
  body('font_family').optional().trim()
], async (req, res) => {
  const updates = {};
  if (req.body.primary_color) updates.primary_color = req.body.primary_color;
  if (req.body.secondary_color) updates.secondary_color = req.body.secondary_color;
  if (req.body.logo_url) updates.logo_url = req.body.logo_url;
  if (req.body.font_family) updates.font_family = req.body.font_family;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE agencies SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...Object.values(updates), req.agency.id);
  res.json({ message: 'Branding updated' });
});
router.put('/', authorize('owner'), [
  body('primary_color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('secondary_color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('logo_url').optional().isURL(),
  body('font_family').optional().trim()
], async (req, res) => {
  const updates = {};
  if (req.body.primary_color) updates.primary_color = req.body.primary_color;
  if (req.body.secondary_color) updates.secondary_color = req.body.secondary_color;
  if (req.body.logo_url) updates.logo_url = req.body.logo_url;
  if (req.body.font_family) updates.font_family = req.body.font_family;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE agencies SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...Object.values(updates), req.agency.id);
  res.json({ message: 'Branding updated' });
});
module.exports = router;
