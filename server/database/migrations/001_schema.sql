PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA mmap_size = 268435456;

CREATE TABLE IF NOT EXISTS agencies (
id INTEGER PRIMARY KEY AUTOINCREMENT,
uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),
name TEXT NOT NULL,
subdomain TEXT UNIQUE NOT NULL,
custom_domain TEXT UNIQUE,
logo_url TEXT,
primary_color TEXT DEFAULT '#F46323',
secondary_color TEXT DEFAULT '#80C838',
font_family TEXT DEFAULT 'Inter',
settings TEXT DEFAULT '{}',
is_active BOOLEAN DEFAULT 1,
subscription_plan TEXT DEFAULT 'basic',
max_staff INTEGER DEFAULT 5,
max_clients INTEGER DEFAULT 200,
subscription_expires_at DATETIME,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),
agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
email TEXT NOT NULL,
phone TEXT,
password_hash TEXT NOT NULL,
salt TEXT NOT NULL,
first_name TEXT NOT NULL,
last_name TEXT NOT NULL,
role TEXT CHECK(role IN ('owner', 'staff', 'trainee')) NOT NULL,
wilaya TEXT,
account_status TEXT DEFAULT 'active' CHECK(account_status IN ('active', 'suspended', 'deleted')),
failed_login_attempts INTEGER DEFAULT 0,
lock_until DATETIME,
last_login DATETIME,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
UNIQUE(agency_id, email)
);

CREATE TABLE IF NOT EXISTS leads (
id INTEGER PRIMARY KEY AUTOINCREMENT,
uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),
agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
name TEXT NOT NULL,
phone TEXT NOT NULL,
email TEXT,
service_interest TEXT CHECK(service_interest IN ('omra', 'hajj', 'visa', 'flight', 'hotel', 'package', 'other')),
status TEXT CHECK(status IN ('pending', 'contacted', 'qualified', 'converted', 'lost')) DEFAULT 'pending',
notes TEXT,
source TEXT,
deleted_at DATETIME,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
id INTEGER PRIMARY KEY AUTOINCREMENT,
uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),
agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
name TEXT NOT NULL,
phone TEXT NOT NULL,
email TEXT,
passport_number TEXT,
passport_expiry DATE,
wilaya TEXT,
notes TEXT,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
id INTEGER PRIMARY KEY AUTOINCREMENT,
uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),
agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
client_id INTEGER NOT NULL REFERENCES clients(id),
staff_id INTEGER REFERENCES users(id),
type TEXT CHECK(type IN ('omra', 'hajj', 'visa', 'flight', 'hotel', 'package')) NOT NULL,
status TEXT CHECK(status IN ('inquiry', 'confirmed', 'processing', 'completed', 'cancelled')) DEFAULT 'inquiry',
total_amount DECIMAL(12,2),
currency TEXT DEFAULT 'DZD',
notes TEXT,
travel_date DATE,
return_date DATE,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
id INTEGER PRIMARY KEY AUTOINCREMENT,
uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),
agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
booking_id INTEGER REFERENCES bookings(id),
type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
amount DECIMAL(12,2) NOT NULL,
currency TEXT DEFAULT 'DZD',
payment_method TEXT CHECK(payment_method IN ('cash', 'ccp', 'dahabia', 'baridimob', 'virement')),
description TEXT,
reference TEXT,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
id INTEGER PRIMARY KEY AUTOINCREMENT,
uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),
agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
user_id INTEGER NOT NULL REFERENCES users(id),
date DATE NOT NULL,
check_in_time TIME,
status TEXT CHECK(status IN ('present', 'absent', 'late')) DEFAULT 'absent',
ip_address TEXT,
qr_token TEXT,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
UNIQUE(agency_id, user_id, date)
);

CREATE TABLE IF NOT EXISTS reminders (
id INTEGER PRIMARY KEY AUTOINCREMENT,
uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),
agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
staff_id INTEGER NOT NULL REFERENCES users(id),
lead_id INTEGER REFERENCES leads(id),
client_id INTEGER REFERENCES clients(id),
title TEXT NOT NULL,
due_at DATETIME NOT NULL,
is_done BOOLEAN DEFAULT 0,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
id INTEGER PRIMARY KEY AUTOINCREMENT,
agency_id INTEGER NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
user_id INTEGER NOT NULL REFERENCES users(id),
title TEXT NOT NULL,
body TEXT NOT NULL,
is_read BOOLEAN DEFAULT 0,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_agency ON users(agency_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_leads_agency ON leads(agency_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_clients_agency ON clients(agency_id);
CREATE INDEX IF NOT EXISTS idx_bookings_agency ON bookings(agency_id);
CREATE INDEX IF NOT EXISTS idx_transactions_agency ON transactions(agency_id);
CREATE INDEX IF NOT EXISTS idx_attendance_agency ON attendance(agency_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

INSERT OR IGNORE INTO agencies (uuid, name, subdomain, is_active, subscription_plan, max_staff, max_clients)
VALUES (lower(hex(randomblob(16))), 'Horizon Demo', 'demo', 1, 'unlimited', 100, 10000);
