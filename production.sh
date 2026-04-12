#!/bin/bash
set -e
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔧 Horizon Production Setup (Fixed)${NC}"
cd ~/horizon/horizon-travel-agency-platform

# 1. Apply Multi-Owner Migration (idempotent)
echo -e "${YELLOW}📦 Applying multi-owner database migration...${NC}"
cat > server/database/migrations/003_multi_owner.sql << 'EOF'
-- Add columns if they don't exist (SQLite doesn't have IF NOT EXISTS for columns, so we use PRAGMA)
ALTER TABLE agencies ADD COLUMN parent_agency_id INTEGER REFERENCES agencies(id);
ALTER TABLE agencies ADD COLUMN tier TEXT DEFAULT 'standard' CHECK(tier IN ('standard', 'pro', 'enterprise'));
ALTER TABLE agencies ADD COLUMN features TEXT DEFAULT '{}';

CREATE TABLE IF NOT EXISTS agency_owners (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'owner' CHECK(role IN ('owner', 'admin', 'viewer')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, agency_id)
);

CREATE TABLE IF NOT EXISTS super_admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  super_admin_id INTEGER REFERENCES super_admins(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
EOF

# Handle duplicate column errors gracefully by using a temporary script
node -e "
const db = require('./server/database/connection');
const migrations = [
  'ALTER TABLE agencies ADD COLUMN parent_agency_id INTEGER REFERENCES agencies(id)',
  'ALTER TABLE agencies ADD COLUMN tier TEXT DEFAULT \\'standard\\' CHECK(tier IN (\\'standard\\', \\'pro\\', \\'enterprise\\'))',
  'ALTER TABLE agencies ADD COLUMN features TEXT DEFAULT \\'{}\\''
];
migrations.forEach(sql => {
  try { db.exec(sql); console.log('✓', sql.split(' ').slice(0,5).join(' ')); }
  catch(e) { if (!e.message.includes('duplicate column')) throw e; }
});
const tables = [
  'CREATE TABLE IF NOT EXISTS agency_owners (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE, role TEXT DEFAULT \\'owner\\' CHECK(role IN (\\'owner\\',\\'admin\\',\\'viewer\\')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, agency_id))',
  'CREATE TABLE IF NOT EXISTS super_admins (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
  'CREATE TABLE IF NOT EXISTS system_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, super_admin_id INTEGER REFERENCES super_admins(id), action TEXT NOT NULL, target_type TEXT, target_id INTEGER, details TEXT, ip_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
];
tables.forEach(sql => db.exec(sql));
console.log('✓ All tables created/verified');
"

# 2. Create Super Admin
echo -e "${YELLOW}👑 Creating super admin...${NC}"
node -e "
const db = require('./server/database/connection');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const salt = crypto.randomBytes(16).toString('hex');
const hash = bcrypt.hashSync('super123' + salt, 10);
db.prepare('INSERT OR IGNORE INTO super_admins (email, password_hash, salt, name) VALUES (?,?,?,?)')
  .run('super@horizon.dz', hash, salt, 'Sidahmed');
console.log('✓ Super admin ready (super@horizon.dz / super123)');
"

# 3. Super Admin Routes (if not exists)
if [ ! -f server/routes/super-admin.js ]; then
  echo -e "${YELLOW}📡 Creating super admin routes...${NC}"
  cat > server/routes/super-admin.js << 'EOF'
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/connection');

function superAuth(req, res, next) {
  const token = req.cookies.horizon_super_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.superAdmin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const admin = db.prepare('SELECT * FROM super_admins WHERE email = ?').get(email);
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
  const isValid = await bcrypt.compare(password + admin.salt, admin.password_hash);
  if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: admin.id, email, role: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.cookie('horizon_super_token', token, { httpOnly: true, secure: true, sameSite: 'strict' });
  res.json({ message: 'Super admin login', admin: { id: admin.id, name: admin.name } });
});

router.get('/agencies', superAuth, (req, res) => {
  const agencies = db.prepare('SELECT id, name, subdomain, tier, features, is_active FROM agencies').all();
  res.json(agencies.map(a => ({ ...a, features: JSON.parse(a.features || '{}') })));
});

router.patch('/agencies/:id/features', superAuth, (req, res) => {
  const { id } = req.params;
  const { feature, enabled } = req.body;
  const agency = db.prepare('SELECT features FROM agencies WHERE id = ?').get(id);
  if (!agency) return res.status(404).json({ error: 'Agency not found' });
  const features = JSON.parse(agency.features || '{}');
  features[feature] = enabled;
  db.prepare('UPDATE agencies SET features = ? WHERE id = ?').run(JSON.stringify(features), id);
  res.json({ success: true });
});

module.exports = router;
EOF
  # Register route in server.js
  if ! grep -q "super-admin" server/server.js; then
    sed -i "/const contentRoutes = require/a const superAdminRoutes = require('./routes/super-admin');" server/server.js
    sed -i "/app.use('\/api\/content'/a app.use('\/api\/v1\/super', superAdminRoutes);" server/server.js
  fi
fi

# 4. Feature Gate Middleware
if [ ! -f server/middleware/feature-gate.js ]; then
  cat > server/middleware/feature-gate.js << 'EOF'
function requireFeature(feature) {
  return (req, res, next) => {
    const features = JSON.parse(req.agency?.features || '{}');
    if (features[feature] === true) next();
    else res.status(403).json({ error: `Feature '${feature}' not available` });
  };
}
module.exports = requireFeature;
EOF
fi

echo -e "${GREEN}✅ Setup complete!${NC}"
