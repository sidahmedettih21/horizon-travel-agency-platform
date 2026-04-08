# 1. Fix bookings.js PUT allowlist
sed -i '/const updates = { ...req.body };/c\  const allowed = ["status","notes","total_amount","travel_date","return_date","staff_id"];\n  const updates = {};\n  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });\n  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });' server/routes/bookings.js

# 2. Create owner seed script
cat > scripts/create-owner.js << 'EOF'
const db = require('../server/database/connection');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Agency subdomain: ', subdomain => {
  rl.question('Owner email: ', email => {
    rl.question('Owner password: ', password => {
      rl.close();
      const agency = db.prepare('SELECT id, max_staff FROM agencies WHERE subdomain = ?').get(subdomain);
      if (!agency) return console.error('Agency not found');
      const salt = crypto.randomBytes(16).toString('hex');
      bcrypt.hash(password + salt, 12).then(hash => {
        db.prepare(`INSERT INTO users (agency_id, email, password_hash, salt, first_name, last_name, role, account_status)
                    VALUES (?, ?, ?, ?, 'Agency', 'Owner', 'owner', 'active')`)
          .run(agency.id, email, hash, salt);
        console.log(`Owner created for ${subdomain}`);
        process.exit();
      });
    });
  });
});
EOF

# 3. Add PUT /agency branding endpoint
cat >> server/routes/agency.js << 'EOF'
router.put('/', authorize('owner'), [
  body('primary_color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('secondary_color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('logo_url').optional().isURL(),
  body('font_family').optional().trim()
], async (req, res) => {
  const updates = {};
  if (req.body.primary_color) updates.primary_color = req.body.primary_color;
  if (req.body.secondary_color) updates.secondary_color = req.body.secondary_color;
  if (req.body.logo_url) updates.logo_url = req.body.logo_url;
  if (req.body.font_family) updates.font_family = req.body.font_family;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields to update' });
  const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE agencies SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...Object.values(updates), req.agency.id);
  res.json({ message: 'Branding updated' });
});
EOF

git add . && git commit -m "fix: bookings PUT allowlist, owner seed script, branding endpoint" && git push
