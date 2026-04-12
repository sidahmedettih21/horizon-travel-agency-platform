const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');


// Public: Get active content by type for an agency
router.get('/:agencyId/:type', async (req, res) => {
  try {
    const { agencyId, type } = req.params;
    const rows = db.prepare(`
      SELECT uuid, type, data, sort_order, updated_at
      FROM agency_content
      WHERE agency_id = ? AND type = ? AND is_active = 1
      ORDER BY sort_order, created_at DESC
    `).all(agencyId, type);
    res.json(rows.map(r => ({ ...r, data: JSON.parse(r.data) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: List all content (including inactive)
router.get('/admin/:type', authenticate, authorize('owner', 'staff'), async (req, res) => {
  try {
    const { type } = req.params;
    const rows = db.prepare(`
      SELECT id, uuid, type, data, is_active, sort_order, created_at, updated_at
      FROM agency_content
      WHERE agency_id = ? AND type = ?
      ORDER BY sort_order, created_at DESC
    `).all(req.user.agencyId, type);
    res.json(rows.map(r => ({ ...r, data: JSON.parse(r.data) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Create new content
router.post('/admin/:type', authenticate, authorize('owner', 'staff'), async (req, res) => {
  try {
    const { type } = req.params;
    const { data, sort_order = 0, is_active = true } = req.body;
    const stmt = db.prepare(`
      INSERT INTO agency_content (agency_id, type, data, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(req.user.agencyId, type, JSON.stringify(data), is_active ? 1 : 0, sort_order);
    const newRow = db.prepare(`SELECT * FROM agency_content WHERE id = ?`).get(info.lastInsertRowid);
    newRow.data = JSON.parse(newRow.data);
    res.status(201).json(newRow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Update content
router.put('/admin/:type/:uuid', authenticate, authorize('owner', 'staff'), async (req, res) => {
  try {
    const { type, uuid } = req.params;
    const { data, sort_order, is_active } = req.body;
    const stmt = db.prepare(`
      UPDATE agency_content
      SET data = ?, sort_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE uuid = ? AND agency_id = ? AND type = ?
    `);
    const info = stmt.run(JSON.stringify(data), sort_order, is_active ? 1 : 0, uuid, req.user.agencyId, type);
    if (info.changes === 0) return res.status(404).json({ error: 'Content not found' });
    const updated = db.prepare(`SELECT * FROM agency_content WHERE uuid = ?`).get(uuid);
    updated.data = JSON.parse(updated.data);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Delete content
router.delete('/admin/:type/:uuid', authenticate, authorize('owner', 'staff'), async (req, res) => {
  try {
    const { type, uuid } = req.params;
    const stmt = db.prepare(`DELETE FROM agency_content WHERE uuid = ? AND agency_id = ? AND type = ?`);
    const info = stmt.run(uuid, req.user.agencyId, type);
    if (info.changes === 0) return res.status(404).json({ error: 'Content not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;