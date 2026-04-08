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
