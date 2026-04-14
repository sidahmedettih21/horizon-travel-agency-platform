const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const db = require('../database/connection');
const authorize = require('../middleware/authorize');
const logger = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');

router.get('/', authorize('owner', 'staff'), async (req, res) => {
  const agencyId = req.agency.id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM clients WHERE agency_id = ?').get(agencyId).count;
    const clients = db.prepare(`
      SELECT id, uuid, name, phone, email, wilaya, notes, created_at, updated_at
      FROM clients WHERE agency_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(agencyId, limit, offset);
    res.json({ data: clients, pagination: { total, limit, offset } });
  } catch (err) {
    logger.error(`Clients list error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authorize('owner', 'staff'), [
  body('name').trim().notEmpty(),
  body('phone').trim().notEmpty(),
  body('email').optional().isEmail(),
  body('passport_number').optional().trim(),
  body('passport_expiry').optional().isISO8601(),
  body('wilaya').optional().trim(),
  body('notes').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });

  const agencyId = req.agency.id;
  let { name, phone, email, passport_number, passport_expiry, wilaya, notes } = req.body;

  if (passport_number) passport_number = JSON.stringify(encrypt(passport_number));
  if (passport_expiry) passport_expiry = JSON.stringify(encrypt(passport_expiry));

  try {
    const result = db.prepare(`
      INSERT INTO clients (agency_id, name, phone, email, passport_number, passport_expiry, wilaya, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(agencyId, name, phone, email, passport_number, passport_expiry, wilaya, notes);
    const newClient = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(result.lastInsertRowid);
    if (newClient.passport_number) try { newClient.passport_number = decrypt(JSON.parse(newClient.passport_number)); } catch (e) {}
    if (newClient.passport_expiry) try { newClient.passport_expiry = decrypt(JSON.parse(newClient.passport_expiry)); } catch (e) {}
    res.status(201).json(newClient);
  } catch (err) {
    logger.error(`Create client error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authorize('owner', 'staff'), [
  param('id').isInt()
], async (req, res) => {
  const agencyId = req.agency.id;
  const clientId = req.params.id;
  const allowedFields = ['name', 'phone', 'email', 'passport_number', 'passport_expiry', 'wilaya', 'notes'];
  const updates = {};
allowedFields.forEach(field => {
  if (req.body[field] !== undefined) updates[field] = req.body[field];
});

  if (updates.passport_number !== undefined) updates.passport_number = JSON.stringify(encrypt(updates.passport_number));
  if (updates.passport_expiry !== undefined) updates.passport_expiry = JSON.stringify(encrypt(updates.passport_expiry));

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });

  try {
    const client = db.prepare(`SELECT id FROM clients WHERE id = ? AND agency_id = ?`).get(clientId, agencyId);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), clientId, agencyId];
    db.prepare(`UPDATE clients SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agency_id = ?`).run(...values);

    let updated = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(clientId);
    if (updated.passport_number) try { updated.passport_number = decrypt(JSON.parse(updated.passport_number)); } catch (e) {}
    if (updated.passport_expiry) try { updated.passport_expiry = decrypt(JSON.parse(updated.passport_expiry)); } catch (e) {}
    res.json(updated);
  } catch (err) {
    logger.error(`Update client error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/bookings', authorize('owner', 'staff'), async (req, res) => {
  const agencyId = req.agency.id;
  const clientId = req.params.id;
  try {
    const bookings = db.prepare(`
      SELECT b.*, c.passport_number, c.passport_expiry 
      FROM bookings b JOIN clients c ON b.client_id = c.id 
      WHERE b.agency_id = ? AND b.client_id = ?
    `).all(agencyId, clientId);
    bookings.forEach(b => {
      if (b.passport_number) try { b.passport_number = decrypt(JSON.parse(b.passport_number)); } catch (e) {}
      if (b.passport_expiry) try { b.passport_expiry = decrypt(JSON.parse(b.passport_expiry)); } catch (e) {}
    });
    res.json(bookings);
  } catch (err) {
    logger.error(`Client bookings error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
