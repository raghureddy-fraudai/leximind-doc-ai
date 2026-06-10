CREATE POLICY "users update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER EXTENSION vector SET SCHEMA extensions';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not move vector extension: %', SQLERRM;
  END;
END $$;