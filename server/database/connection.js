const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = path.resolve(process.env.DB_PATH || './data/horizon.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : null });

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('mmap_size = 268435456');

const migrationFiles = fs.readdirSync(path.join(__dirname, 'migrations'))
  .filter(f => f.endsWith('.sql'))
  .sort();
for (const file of migrationFiles) {
  const migration = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8');
  try { db.exec(migration); console.log('✓ Migration ' + file + ' applied'); } catch(e) { if (e.message.includes('duplicate column') || e.message.includes('already exists')) { console.log('⚠️  Skipping duplicate in ' + file); } else { throw e; } }
}

db.getAsync = (sql, params = []) => {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
};
db.allAsync = (sql, params = []) => {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
};
db.runAsync = (sql, params = []) => {
  const stmt = db.prepare(sql);
  const info = stmt.run(...params);
  return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
};

function runBackup() {
  const backupDir = path.dirname(dbPath);
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = Date.now();
  const backupFile = path.join(backupDir, `horizon.backup.${timestamp}.db`);
  try {
    db.pragma('wal_checkpoint(FULL)');
    fs.copyFileSync(dbPath, backupFile);
    console.log(`✓ Backup created: ${path.basename(backupFile)}`);
    let backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('horizon.backup.') && f.endsWith('.db'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }));
    backups.sort((a, b) => b.mtime - a.mtime);
    while (backups.length > 7) {
      fs.unlinkSync(path.join(backupDir, backups.pop().name));
    }
  } catch (err) {
    console.error(`Backup failed: ${err.message}`);
  }
}
setInterval(runBackup, 24 * 60 * 60 * 1000);
runBackup();

module.exports = db;
