-- Migration: Ensure attendance records can be deleted by authenticated and anon users (kiosk mode)

-- 1. Ensure authenticated policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'attendance' AND policyname = 'Authenticated users can delete attendance'
  ) THEN
    CREATE POLICY "Authenticated users can delete attendance"
      ON attendance FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

-- 2. Allow anon role (kiosks / tablets) to delete attendance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'attendance' AND policyname = 'Anon can delete attendance'
  ) THEN
    CREATE POLICY "Anon can delete attendance"
      ON attendance FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;
