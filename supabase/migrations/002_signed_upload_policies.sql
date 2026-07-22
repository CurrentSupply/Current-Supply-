-- Allow anon/authenticated signed uploads to deal-photos (client PUT via signed URL).
-- Safe for this single-user app; service role still used for signing + DB writes.

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
