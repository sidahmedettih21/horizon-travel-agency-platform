const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../database/connection');
const logger = require('../utils/logger');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation error', details: errors.array() });
  }

  const { email, password } = req.body;
  const agencyId = req.agency.id;

  try {
    const user = db.prepare(`
      SELECT id, email, password_hash, salt, role, account_status,
             failed_login_attempts, lock_until, first_name, last_name
      FROM users WHERE agency_id = ? AND email = ?
    `).get(agencyId, email);

    if (!user || user.account_status === 'deleted') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      return res.status(423).json({ error: 'Account locked', message: 'Too many failed attempts' });
    }

    const isValid = await bcrypt.compare(password + user.salt, user.password_hash);
    if (!isValid) {
      db.prepare(`
        UPDATE users SET failed_login_attempts = failed_login_attempts + 1,
        lock_until = CASE WHEN failed_login_attempts + 1 >= 5
        THEN datetime('now', '+15 minutes') ELSE lock_until END
        WHERE id = ?
      `).run(user.id);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    db.prepare(`
      UPDATE users SET failed_login_attempts = 0, lock_until = NULL,
      last_login = CURRENT_TIMESTAMP WHERE id = ?
    `).run(user.id);

    const token = jwt.sign({
      userId: user.id,
      agencyId,
      role: user.role,
      email: user.email
    }, process.env.JWT_SECRET, {
      expiresIn: '7d',
      algorithm: 'HS512',
      issuer: 'horizon'
    });

    res.cookie('horizon_token', token, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    res.json({ message: 'Login successful', user: { id: user.id, role: user.role, name: `${user.first_name} ${user.last_name}` } });
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('horizon_token', { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'strict' });
  res.json({ message: 'Logged out' });
});

module.exports = router;
