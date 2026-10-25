-- Migration: Fix category age ranges and correct historical child category assignments
-- 1. Ensure Categoría A covers infants/toddlers (0-6), and Categoría C covers up to 15 years
UPDATE categories
SET min_age = 0, max_age = 6, description = 'Cunas, párvulos e inicial (0 a 6 años)'
WHERE name = 'Categoría A';

UPDATE categories
SET min_age = 7, max_age = 10, description = 'Primarios e intermedios (7 a 10 años)'
WHERE name = 'Categoría B';

UPDATE categories
SET min_age = 11, max_age = 15, description = 'Pre-adolescentes y mayores (11 a 15 años)'
WHERE name = 'Categoría C';

-- 2. Correct children from the 11-13 sheet who were mistakenly assigned to Categoría A due to import matching
DO $$
DECLARE
  cat_c_id uuid;
  cat_a_id uuid;
BEGIN
  SELECT id INTO cat_c_id FROM categories WHERE name = 'Categoría C' LIMIT 1;
  SELECT id INTO cat_a_id FROM categories WHERE name = 'Categoría A' LIMIT 1;

  IF cat_c_id IS NOT NULL AND cat_a_id IS NOT NULL THEN
    UPDATE children
    SET category_id = cat_c_id
    WHERE category_id = cat_a_id
      AND LOWER(TRIM(full_name)) IN (
        'abraham hernandez',
        'adrian torres eljach',
        'andrea ospino',
        'andres felipe',
        'ciel dorian',
        'dafne tapias',
        'dalet tapias',
        'eimy lara',
        'eliandris gonzales',
        'helen esquea',
        'isabella carmona',
        'isabella correa',
        'josue',
        'juan escorcia',
        'lucas torres',
        'mauricio hoyos',
        'mia alvarez',
        'nicolle valencia',
        'rafael hoyos',
        'ricardo cortez',
        'santiago tarazona',
        'sara vega quintero',
        'shaira garcia',
        'thiago ortiz',
        'virginia zabalas',
        'keylor catalán',
        'keylor catalan',
        'jordan cervantes',
        'gabriel prieto',
        'zoé castaño',
        'zoe castano',
        'daniela ospino'
      );

    -- Fix Litzy Niebles birthdate typo (was 2003 instead of 2023)
    UPDATE children
    SET birthdate = '2023-12-28', category_id = cat_a_id
    WHERE LOWER(TRIM(full_name)) = 'litzy niebles' AND birthdate = '2003-12-28';
  END IF;
END $$;
