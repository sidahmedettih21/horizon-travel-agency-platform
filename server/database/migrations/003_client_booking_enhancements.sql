-- Add staff assignment to clients
ALTER TABLE clients ADD COLUMN assigned_staff_id INTEGER REFERENCES users(id);
ALTER TABLE clients ADD COLUMN family_group_id TEXT;
ALTER TABLE clients ADD COLUMN photo_url TEXT;

-- Add payment tracking to bookings
ALTER TABLE bookings ADD COLUMN amount_paid DECIMAL(12,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'partial', 'paid', 'overdue'));
ALTER TABLE bookings ADD COLUMN family_group_id TEXT;

-- Create index for family grouping
CREATE INDEX idx_clients_family ON clients(family_group_id);
CREATE INDEX idx_bookings_family ON bookings(family_group_id);
