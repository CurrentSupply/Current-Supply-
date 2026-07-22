-- Current Supply / Reselling — Supabase schema + storage
-- Project: onjguvlozsqxkurgqgbl
-- Run in: Supabase Dashboard → SQL Editor → New query → Run

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deals (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  size TEXT NOT NULL,
  cost DOUBLE PRECISION NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  condition TEXT NOT NULL DEFAULT 'Used',
  has_box BOOLEAN NOT NULL DEFAULT false,
  has_insoles BOOLEAN NOT NULL DEFAULT false,
  category_id INTEGER REFERENCES categories(id),
  status TEXT NOT NULL DEFAULT 'in_stock',
  owner TEXT NOT NULL DEFAULT 'other',
  purchased_at TEXT NOT NULL,
  sold_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photos (
  id SERIAL PRIMARY KEY,
  deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  is_cover BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

INSERT INTO categories (name)
SELECT v.name
FROM (VALUES
  ('Sneakers'),
  ('Apparel'),
  ('Electronics'),
  ('Accessories'),
  ('Other')
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM categories LIMIT 1);

-- Public bucket for deal photos (app uses service role for uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deal-photos',
  'deal-photos',
  true,
  8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for cover images in the UI
DROP POLICY IF EXISTS "Public read deal-photos" ON storage.objects;
CREATE POLICY "Public read deal-photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'deal-photos');

-- Signed uploads use a short-lived token from the service role; these policies
-- cover anon/authenticated clients that PUT via createSignedUploadUrl.
DROP POLICY IF EXISTS "Authenticated upload deal-photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon upload deal-photos" ON storage.objects;
CREATE POLICY "Anon upload deal-photos"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'deal-photos');

DROP POLICY IF EXISTS "Authenticated update deal-photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon update deal-photos" ON storage.objects;
CREATE POLICY "Anon update deal-photos"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'deal-photos')
WITH CHECK (bucket_id = 'deal-photos');

DROP POLICY IF EXISTS "Authenticated delete deal-photos" ON storage.objects;
DROP POLICY IF EXISTS "Anon delete deal-photos" ON storage.objects;
CREATE POLICY "Anon delete deal-photos"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'deal-photos');
