const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const db = require('../database/connection');
const authorize = require('../middleware/authorize');
const logger = require('../utils/logger');
const { sendWhatsAppMessage, formatLeadMessage } = require('../utils/whatsapp');

router.get('/', authorize('owner', 'staff'), [
  query('status').optional().isIn(['pending', 'contacted', 'qualified', 'converted', 'lost']),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });

  const agencyId = req.agency.id;
  const { status, limit = 50, offset = 0 } = req.query;
  let sql = `SELECT * FROM leads WHERE agency_id = ? AND deleted_at IS NULL`;
  const params = [agencyId];
  if (status) { sql += ` AND status = ?`; params.push(status); }
  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  try {
    const leads = db.prepare(sql).all(...params);
    let total;
    if (status) {
      total = db.prepare(`SELECT COUNT(*) as count FROM leads WHERE agency_id = ? AND status = ? AND deleted_at IS NULL`).get(agencyId, status).count;
    } else {
      total = db.prepare(`SELECT COUNT(*) as count FROM leads WHERE agency_id = ? AND deleted_at IS NULL`).get(agencyId).count;
    }
    res.json({ data: leads, pagination: { total, limit, offset } });
  } catch (err) {
    logger.error(`Leads list error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authorize('owner', 'staff'), [
  body('name').trim().notEmpty(),
  body('phone').trim().notEmpty(),
  body('email').optional().isEmail(),
  body('service_interest').isIn(['omra', 'hajj', 'visa', 'flight', 'hotel', 'package', 'other']),
  body('status').optional().isIn(['pending', 'contacted', 'qualified', 'converted', 'lost']),
  body('notes').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });

  const agencyId = req.agency.id;
  const { name, phone, email, service_interest, status = 'pending', notes, source } = req.body;

  try {
    const result = db.prepare(`
      INSERT INTO leads (agency_id, name, phone, email, service_interest, status, notes, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(agencyId, name, phone, email, service_interest, status, notes, source);
    const newLead = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(result.lastInsertRowid);

    // WhatsApp notification (owner only for pilot)
    const agency = req.agency;
    const agencySettings = JSON.parse(agency.settings || '{}');
    let ownerPhone = agencySettings.owner_whatsapp;
    if (!ownerPhone) {
      const ownerUser = db.prepare(`SELECT phone FROM users WHERE agency_id = ? AND role = 'owner' LIMIT 1`).get(agencyId);
      ownerPhone = ownerUser?.phone;
    }
    if (ownerPhone && agencySettings.whatsapp_enabled !== false) {
      const leadUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/leads/${result.lastInsertRowid}`;
      const message = formatLeadMessage(newLead, agency, leadUrl);
      sendWhatsAppMessage(ownerPhone, message, agencyId).catch(e => logger.error(`WhatsApp error: ${e.message}`));
    }

    res.status(201).json(newLead);
  } catch (err) {
    logger.error(`Create lead error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authorize('owner', 'staff'), [
  param('id').isInt(),
  body('status').optional().isIn(['pending', 'contacted', 'qualified', 'converted', 'lost']),
  body('notes').optional().trim(),
  body('assigned_to').optional().isInt()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation error', details: errors.array() });

  const agencyId = req.agency.id;
  const leadId = req.params.id;
  const updates = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.notes !== undefined) updates.notes = req.body.notes;
  if (req.body.assigned_to !== undefined) updates.assigned_to = req.body.assigned_to;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const lead = db.prepare(`SELECT id FROM leads WHERE id = ? AND agency_id = ? AND deleted_at IS NULL`).get(leadId, agencyId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), leadId, agencyId];
    db.prepare(`UPDATE leads SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agency_id = ?`).run(...values);
    const updated = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(leadId);
    res.json(updated);
  } catch (err) {
    logger.error(`Update lead error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authorize('owner', 'staff'), [
  param('id').isInt()
], async (req, res) => {
  const agencyId = req.agency.id;
  const leadId = req.params.id;
  try {
    const lead = db.prepare(`SELECT id FROM leads WHERE id = ? AND agency_id = ? AND deleted_at IS NULL`).get(leadId, agencyId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    db.prepare(`UPDATE leads SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND agency_id = ?`).run(leadId, agencyId);
    res.status(204).send();
  } catch (err) {
    logger.error(`Delete lead error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
