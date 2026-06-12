-- Create the receipts storage bucket for topup receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  8388608, -- 8MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to receipts bucket
CREATE POLICY "Allow authenticated uploads to receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Allow public read access to receipts
CREATE POLICY "Allow public read access to receipts"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'receipts');

-- Allow service role full access
CREATE POLICY "Allow service role full access to receipts"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'receipts');
