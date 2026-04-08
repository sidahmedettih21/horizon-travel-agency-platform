const db = require('../server/database/connection');
const { encrypt } = require('../server/utils/encryption');

const clients = db.prepare("SELECT id, passport_number FROM clients WHERE passport_number IS NOT NULL AND passport_number NOT LIKE '{%'").all();
for (const client of clients) {
  const encrypted = JSON.stringify(encrypt(client.passport_number));
  db.prepare("UPDATE clients SET passport_number = ? WHERE id = ?").run(encrypted, client.id);
  console.log(`Encrypted client ${client.id}`);
}
console.log(`Done. ${clients.length} passports encrypted.`);
