const db = require('../server/database/connection');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const email = 'admin@anouarelsabah.com';
const password = 'anouar2026'; // Change this!
const firstName = 'Admin';
const lastName = 'Anouar';

// Get agency ID for demo
const agency = db.prepare(`SELECT id FROM agencies WHERE subdomain = 'demo'`).get();
if (!agency) {
  console.error('Agency not found');
  process.exit(1);
}

// Hash password
const salt = crypto.randomBytes(16).toString('hex');
const passwordHash = bcrypt.hashSync(password + salt, 10);

try {
  const stmt = db.prepare(`
    INSERT INTO users (agency_id, email, password_hash, salt, first_name, last_name, role, account_status)
    VALUES (?, ?, ?, ?, ?, ?, 'owner', 'active')
  `);
  stmt.run(agency.id, email, passwordHash, salt, firstName, lastName);
  console.log(`✅ Admin user created: ${email} / ${password}`);
} catch (err) {
  if (err.message.includes('UNIQUE constraint failed')) {
    console.log('⚠️ User already exists');
  } else {
    console.error(err);
  }
}