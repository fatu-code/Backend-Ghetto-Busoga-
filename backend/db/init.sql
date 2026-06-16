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
  sub_county        VARCHAR(255),
  parish            VARCHAR(255),
  depot             VARCHAR(255) NOT NULL,
  depot_role        VARCHAR(50),
  village           VARCHAR(255),
  gender            VARCHAR(20),
  nin               VARCHAR(20),
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

-- Migration: add NIN to existing deployments (safe to re-run)
ALTER TABLE members ADD COLUMN IF NOT EXISTS nin VARCHAR(20);

-- Migration: add loan-agreement location fields (safe to re-run)
ALTER TABLE members ADD COLUMN IF NOT EXISTS sub_county VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS parish     VARCHAR(255);

-- Migration: depot leadership role (Depot Commander, Deputy Commander, Secretary, Publicity)
ALTER TABLE members ADD COLUMN IF NOT EXISTS depot_role VARCHAR(50);

-- Migration: district leadership role (held in addition to a depot role; a person
-- leads a depot before a district, so this is only set for a Depot Commander)
ALTER TABLE members ADD COLUMN IF NOT EXISTS district_role VARCHAR(50);

-- ── REPAYMENTS (loan repayments recorded against a disbursed member) ──
CREATE TABLE IF NOT EXISTS repayments (
  id          SERIAL PRIMARY KEY,
  member_id   VARCHAR(20) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount      INTEGER     NOT NULL,
  paid_on     DATE        NOT NULL,
  recorded_by INTEGER     REFERENCES users(id),
  created_at  TIMESTAMP   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_repayments_member ON repayments(member_id);

-- ── AUDIT LOG (who did what, when) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER,
  user_name  VARCHAR(255),
  action     VARCHAR(50),
  entity     VARCHAR(20),
  entity_id  VARCHAR(50),
  detail     TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- Indexes for fast search on large datasets
CREATE INDEX IF NOT EXISTS idx_members_district ON members(district);
CREATE INDEX IF NOT EXISTS idx_members_depot    ON members(depot);
CREATE INDEX IF NOT EXISTS idx_members_status   ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_name     ON members(name);
CREATE INDEX IF NOT EXISTS idx_members_created  ON members(created_at DESC);

-- One NIN can only be registered once (prevents duplicate / ghost beneficiaries).
-- Partial index so legacy rows with a NULL nin don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_nin ON members(nin) WHERE nin IS NOT NULL;

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

-- Function: generate next member ID.
-- Reuses freed numbers: it returns the LOWEST positive serial not currently held
-- by a member in this district. So deleting members frees their numbers, and a
-- district with no members starts again at 0001. (The member_sequences table above
-- is kept for history but is no longer read by this function.)
CREATE OR REPLACE FUNCTION next_member_id(p_district VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  SELECT MIN(g) INTO v_seq
    FROM generate_series(
           1,
           COALESCE((SELECT MAX(CAST(split_part(id, '-', 3) AS INTEGER))
                       FROM members WHERE district = p_district), 0) + 1
         ) AS g
   WHERE g NOT IN (
           SELECT CAST(split_part(id, '-', 3) AS INTEGER)
             FROM members WHERE district = p_district
         );
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
  'Al-Hajj Faruk Kirunda',
  'faruk',
  '$2b$12$/uVuSMrK9XcQeVyBEwMeIe7rrYce0eq5noGMl1LrEk5YJsFzfS7fO',
  'admin'
) ON CONFLICT (username) DO NOTHING;
