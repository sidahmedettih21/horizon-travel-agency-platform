const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.put('/', authenticate, authorize('owner'), (req, res) => {
  const { primary_color, secondary_color, logo_url, favicon_url, font_family } = req.body;
  const updates = [];
  const values = [];
  if (primary_color !== undefined)   { updates.push('primary_color = ?'); values.push(primary_color); }
  if (secondary_color !== undefined) { updates.push('secondary_color = ?'); values.push(secondary_color); }
  if (logo_url !== undefined)        { updates.push('logo_url = ?'); values.push(logo_url); }
  if (favicon_url !== undefined)     { updates.push('favicon_url = ?'); values.push(favicon_url); }
  if (font_family !== undefined)     { updates.push('font_family = ?'); values.push(font_family); }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.agency.id);
  const stmt = db.prepare(`UPDATE agencies SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
  stmt.run(...values);
  res.json({ success: true });
});

module.exports = router;
