-- ── BGS DATABASE SCHEMA ─────────────────────────────────────────
-- Run this in your Supabase SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  username      VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'staff',
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Beneficiaries table
CREATE TABLE IF NOT EXISTS members (
  id                VARCHAR(20)  PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  phone             VARCHAR(50),
  district          VARCHAR(10)  NOT NULL,
  district_name     VARCHAR(100) NOT NULL,
  depot             VARCHAR(255) NOT NULL,
  village           VARCHAR(255),
  gender            VARCHAR(20),
  photo_url         TEXT,
  photo_public_id   TEXT,
  amount            INTEGER      NOT NULL DEFAULT 0,
  disbursement_date DATE,
  status            VARCHAR(50)  NOT NULL DEFAULT 'Active',
  notes             TEXT,
  qr_data_url       TEXT,
  registered_by     INTEGER REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast search on large datasets
CREATE INDEX IF NOT EXISTS idx_members_district ON members(district);
CREATE INDEX IF NOT EXISTS idx_members_depot    ON members(depot);
CREATE INDEX IF NOT EXISTS idx_members_status   ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_name     ON members(name);
CREATE INDEX IF NOT EXISTS idx_members_created  ON members(created_at DESC);

-- ID sequence per district
CREATE TABLE IF NOT EXISTS member_sequences (
  district VARCHAR(10) PRIMARY KEY,
  next_seq INTEGER     NOT NULL DEFAULT 1
);

INSERT INTO member_sequences (district) VALUES
  ('JJA'),('JJD'),('KML'),('KLR'),('BYD'),
  ('IGA'),('LUK'),('NMT'),('BGR'),('MYG'),
  ('BSA'),('NMY'),('BGW')
ON CONFLICT (district) DO NOTHING;

-- Function: generate next member ID
CREATE OR REPLACE FUNCTION next_member_id(p_district VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  UPDATE member_sequences
     SET next_seq = next_seq + 1
   WHERE district = p_district
  RETURNING next_seq - 1 INTO v_seq;
  RETURN 'BGS-' || p_district || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ── DEFAULT ADMIN USER ───────────────────────────────────────────
-- Username: faruk
-- Password: faruk123
INSERT INTO users (name, username, password_hash, role)
VALUES (
  'Haji Faruk Kirunda',
  'faruk',
  '$2b$12$/uVuSMrK9XcQeVyBEwMeIe7rrYce0eq5noGMl1LrEk5YJsFzfS7fO',
  'admin'
) ON CONFLICT (username) DO NOTHING;
