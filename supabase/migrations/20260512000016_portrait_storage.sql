-- Migration: Portrait storage bucket + RLS policies
-- Note: Supabase Storage buckets can be created via SQL using storage.buckets table.
-- The portraits bucket is public so portrait images are accessible without auth.

INSERT INTO storage.buckets (id, name, public)
VALUES ('portraits', 'portraits', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload portraits (ownership enforced at app layer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'portraits_insert_authenticated'
  ) THEN
    CREATE POLICY "portraits_insert_authenticated"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'portraits');
  END IF;
END $$;

-- Allow public read of portrait images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'portraits_select_public'
  ) THEN
    CREATE POLICY "portraits_select_public"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'portraits');
  END IF;
END $$;

-- Allow authenticated users to update/replace portrait files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'portraits_update_authenticated'
  ) THEN
    CREATE POLICY "portraits_update_authenticated"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'portraits');
  END IF;
END $$;
