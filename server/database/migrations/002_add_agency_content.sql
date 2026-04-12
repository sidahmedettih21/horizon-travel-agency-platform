-- 002_add_agency_content.sql
CREATE TABLE IF NOT EXISTS agency_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('offer', 'gallery', 'video')),
  data TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agency_content_agency ON agency_content(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_content_type ON agency_content(agency_id, type);