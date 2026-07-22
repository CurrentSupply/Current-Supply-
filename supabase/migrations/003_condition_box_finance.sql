-- Condition grades, box/insoles flags, and finance ledger
-- For fresh installs, 001_init.sql already includes has_box, has_insoles, and
-- finance_entries — run this only on older databases that predate those changes.
-- Run in: Supabase Dashboard → SQL Editor → New query → Run

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS has_box BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS has_insoles BOOLEAN NOT NULL DEFAULT false;

-- Normalize free-text condition into the dropdown grades where possible.
UPDATE deals
SET condition = CASE
  WHEN lower(condition) LIKE '%ds%' OR lower(condition) LIKE '%deadstock%' OR lower(condition) = 'new'
    THEN 'DS'
  WHEN lower(condition) LIKE '%vnds%'
    THEN 'VNDS'
  WHEN lower(condition) LIKE '%beat%'
    THEN 'Beat'
  WHEN condition IN ('DS', 'VNDS', 'Used', 'Beat')
    THEN condition
  WHEN trim(condition) = '' OR condition IS NULL
    THEN 'Used'
  ELSE 'Used'
END;

CREATE TABLE IF NOT EXISTS finance_entries (
  id SERIAL PRIMARY KEY,
  entry_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('in', 'out')),
  amount DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
  category TEXT NOT NULL DEFAULT 'Other',
  note TEXT NOT NULL DEFAULT '',
  deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_entries_date_idx ON finance_entries (entry_date DESC);
CREATE INDEX IF NOT EXISTS finance_entries_kind_idx ON finance_entries (kind);
