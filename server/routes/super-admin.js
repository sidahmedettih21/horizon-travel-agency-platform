const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/connection');

// Super admin authentication middleware
function superAuth(req, res, next) {
  const token = req.cookies.horizon_super_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS512'] });
    req.superAdmin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Login (separate from regular agency login)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const admin = db.prepare('SELECT * FROM super_admins WHERE email = ?').get(email);
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

  const isValid = await bcrypt.compare(password + admin.salt, admin.password_hash);
  if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: admin.id, email: admin.email, role: 'super_admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.cookie('horizon_super_token', token, { httpOnly: true, secure: true, sameSite: 'strict' });
  res.json({ message: 'Super admin login successful', admin: { id: admin.id, name: admin.name } });
});

// List all agencies
router.get('/agencies', superAuth, (req, res) => {
  const agencies = db.prepare(`
    SELECT id, uuid, name, subdomain, custom_domain, is_active, subscription_plan, tier,
           created_at, (SELECT COUNT(*) FROM users WHERE agency_id = agencies.id) as staff_count
    FROM agencies ORDER BY created_at DESC
  `).all();
  res.json(agencies);
});

// Toggle feature for an agency
router.patch('/agencies/:id/features', superAuth, (req, res) => {
  const { id } = req.params;
  const { feature, enabled } = req.body;
  const agency = db.prepare('SELECT features FROM agencies WHERE id = ?').get(id);
  if (!agency) return res.status(404).json({ error: 'Agency not found' });

  const features = JSON.parse(agency.features || '{}');
  features[feature] = enabled;
  db.prepare('UPDATE agencies SET features = ? WHERE id = ?').run(JSON.stringify(features), id);

  // Audit log
  db.prepare(`
    INSERT INTO system_audit (super_admin_id, action, target_type, target_id, details, ip_address)
    VALUES (?, 'toggle_feature', 'agency', ?, ?, ?)
  `).run(req.superAdmin.id, id, JSON.stringify({ feature, enabled }), req.ip);

  res.json({ success: true, features });
});

// Get system stats
router.get('/stats', superAuth, (req, res) => {
  const totalAgencies = db.prepare('SELECT COUNT(*) as count FROM agencies').get().count;
  const totalBookings = db.prepare('SELECT COUNT(*) as count FROM bookings').get().count;
  const totalRevenue = db.prepare('SELECT SUM(amount) as total FROM transactions WHERE type = ?').get('income').total || 0;
  res.json({ totalAgencies, totalBookings, totalRevenue });
});

module.exports = router;