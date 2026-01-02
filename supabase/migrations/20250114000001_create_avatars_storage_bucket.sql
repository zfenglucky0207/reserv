-- Storage bucket for avatars
-- NOTE: This migration only sets up policies. The bucket itself must be created manually in Supabase Dashboard:
-- 1. Go to Storage > New bucket
-- 2. Name: "avatars"
-- 3. Public bucket: YES (for easier access on invite pages)
-- 4. File size limit: 3MB
-- 5. Allowed MIME types: image/jpeg, image/png, image/webp

-- Storage policies for avatars bucket

-- Allow authenticated users to upload their own avatar
CREATE POLICY "avatars_upload_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update their own avatar
CREATE POLICY "avatars_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own avatar
CREATE POLICY "avatars_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public to read avatars (if bucket is public, this enables direct access)
CREATE POLICY "avatars_select_public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');


