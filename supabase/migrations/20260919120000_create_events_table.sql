-- Migration: Create events table and link to attendance

-- 1. Create events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time text DEFAULT '09:00',
  end_time text DEFAULT '',
  location text DEFAULT 'Salón Principal',
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'upcoming', -- 'upcoming', 'in_progress', 'completed', 'cancelled'
  color text DEFAULT 'sky', -- 'sky', 'indigo', 'emerald', 'amber', 'rose', 'purple'
  created_at timestamptz DEFAULT now()
);

-- 2. Link attendance to events
ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE SET NULL;

-- 3. Indexes for fast queries
CREATE INDEX IF NOT EXISTS events_event_date_idx ON events(event_date);
CREATE INDEX IF NOT EXISTS events_status_idx ON events(status);
CREATE INDEX IF NOT EXISTS events_category_id_idx ON events(category_id);
CREATE INDEX IF NOT EXISTS attendance_event_id_idx ON attendance(event_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 5. Policies for events table
-- Authenticated users (church leaders, staff, teachers) have full management access
CREATE POLICY "Authenticated users can manage events"
  ON events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anonymous users (check-in kiosks / tablets) can view events
CREATE POLICY "Anon users can view events"
  ON events FOR SELECT
  TO anon
  USING (true);

-- Anonymous users can update event status if needed during kiosk check-in
CREATE POLICY "Anon users can update events"
  ON events FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
