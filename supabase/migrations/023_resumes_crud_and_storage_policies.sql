-- Complete resumes CRUD policies and storage object access policies.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'resumes'
      AND policyname = 'Users can insert own resumes'
  ) THEN
    CREATE POLICY "Users can insert own resumes"
      ON public.resumes FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'resumes'
      AND policyname = 'Users can update own resumes'
  ) THEN
    CREATE POLICY "Users can update own resumes"
      ON public.resumes FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'resumes'
      AND policyname = 'Users can delete own resumes'
  ) THEN
    CREATE POLICY "Users can delete own resumes"
      ON public.resumes FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can read own resumes objects'
  ) THEN
    CREATE POLICY "Users can read own resumes objects"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'resumes'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can insert own resumes objects'
  ) THEN
    CREATE POLICY "Users can insert own resumes objects"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'resumes'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update own resumes objects'
  ) THEN
    CREATE POLICY "Users can update own resumes objects"
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'resumes'
        AND split_part(name, '/', 1) = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'resumes'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own resumes objects'
  ) THEN
    CREATE POLICY "Users can delete own resumes objects"
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'resumes'
        AND split_part(name, '/', 1) = auth.uid()::text
      );
  END IF;
END $$;
