const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database/connection');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// GET /api/v1/staff – List all staff for the agency (owner only)
router.get('/', authenticate, authorize('owner'), (req, res) => {
  try {
    const staff = db.prepare(`
      SELECT id, uuid, email, phone, first_name, last_name, role, department, account_status, notes, created_at
      FROM users WHERE agency_id = ? ORDER BY created_at DESC
    `).all(req.agency.id);
    // Parse extra fields from notes JSON
    const enrichedStaff = staff.map(s => {
      let extra = {};
      try { extra = JSON.parse(s.notes || '{}'); } catch (e) {}
      return {
        ...s,
        age: extra.age || '',
        wilaya: extra.wilaya || '',
        working_hours: extra.working_hours || '',
        education: extra.education || ''
      };
    });
    res.json(enrichedStaff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/staff – Create new staff (owner only)
router.post('/', authenticate, authorize('owner'), async (req, res) => {
  const { email, phone, first_name, last_name, role, department, password, age, wilaya, working_hours, education } = req.body;
  if (!email || !first_name || !last_name || !role || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(password + salt, 10);
  // Store extra fields as JSON in notes
  const extra = JSON.stringify({ age, wilaya, working_hours, education });
  try {
    const stmt = db.prepare(`
      INSERT INTO users (agency_id, email, phone, password_hash, salt, first_name, last_name, role, department, account_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `);
    const info = stmt.run(req.agency.id, email, phone, passwordHash, salt, first_name, last_name, role, department, extra);
    const newStaff = db.prepare('SELECT id, uuid, email, first_name, last_name, role, department, notes FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(newStaff);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/staff/:id – Update staff (owner only)
router.put('/:id', authenticate, authorize('owner'), async (req, res) => {
  const { id } = req.params;
  const allowed = ['phone', 'first_name', 'last_name', 'role', 'department', 'account_status'];
  const updates = [];
  const values = [];
  allowed.forEach(field => {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  });
  // Handle extra fields: update notes JSON
  const extraFields = ['age', 'wilaya', 'working_hours', 'education'];
  const hasExtra = extraFields.some(f => req.body[f] !== undefined);
  if (hasExtra) {
    // Get current notes
    const current = db.prepare('SELECT notes FROM users WHERE id = ?').get(id);
    let extra = {};
    try { extra = JSON.parse(current.notes || '{}'); } catch (e) {}
    extraFields.forEach(f => { if (req.body[f] !== undefined) extra[f] = req.body[f]; });
    updates.push('notes = ?');
    values.push(JSON.stringify(extra));
  }
  if (updates.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  values.push(id, req.agency.id);
  const stmt = db.prepare(`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agency_id = ?`);
  const info = stmt.run(...values);
  if (info.changes === 0) return res.status(404).json({ error: 'Staff not found' });
  res.json({ success: true });
});

// DELETE /api/v1/staff/:id – Soft delete (owner only)
router.delete('/:id', authenticate, authorize('owner'), (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('UPDATE users SET account_status = ? WHERE id = ? AND agency_id = ?');
  const info = stmt.run('deleted', id, req.agency.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Staff not found' });
  res.json({ success: true });
});

module.exports = router;