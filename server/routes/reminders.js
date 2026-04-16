const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const authenticate = require('../middleware/authenticate');

router.get('/', authenticate, (req, res) => {
  try {
    const reminders = db.prepare(`
      SELECT * FROM reminders WHERE agency_id = ? AND (staff_id = ? OR staff_id IS NULL)
      ORDER BY due_at ASC
    `).all(req.agency.id, req.user.id);
    res.json(reminders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, (req, res) => {
  const { title, due_at, staff_id } = req.body;
  if (!title || !due_at) return res.status(400).json({ error: 'Missing fields' });
  try {
    const stmt = db.prepare(`
      INSERT INTO reminders (agency_id, staff_id, title, due_at)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(req.agency.id, staff_id || req.user.id, title, due_at);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/done', authenticate, (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('UPDATE reminders SET is_done = 1 WHERE id = ? AND agency_id = ?');
  const info = stmt.run(id, req.agency.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

module.exports = router;
