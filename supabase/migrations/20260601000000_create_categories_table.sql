-- Migration: Create categories table and link to children

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_age integer NOT NULL DEFAULT 0,
  max_age integer NOT NULL DEFAULT 99,
  color text DEFAULT 'sky',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Add category_id to children table
ALTER TABLE children 
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Categories policies
CREATE POLICY "Authenticated users can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can view categories"
  ON categories FOR SELECT
  TO anon
  USING (true);

-- Insert sample categories
INSERT INTO categories (name, min_age, max_age, color, description)
VALUES 
  ('Categoría A', 1, 3, 'sky', 'Cunas y primeros pasos (1 a 3 años)'),
  ('Categoría B', 4, 6, 'amber', 'Párvulos e inicial (4 a 6 años)'),
  ('Categoría C', 7, 10, 'emerald', 'Primarios (7 a 10 años)')
ON CONFLICT DO NOTHING;
