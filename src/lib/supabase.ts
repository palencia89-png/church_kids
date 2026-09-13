import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Category = {
  id: string;
  name: string;
  min_age: number;
  max_age: number;
  color: string;
  description?: string;
  created_at?: string;
};

export type Child = {
  id: string;
  full_name: string;
  birthdate: string | null;
  photo_url: string;
  parent1_name: string;
  parent1_phone: string;
  parent2_name: string;
  parent2_phone: string;
  notes: string;
  category_id?: string | null;
  category?: Category | null;
  created_at: string;
};

export type Attendance = {
  id: string;
  child_id: string;
  checked_in_at: string;
  event_date: string;
  physical_condition?: string;
  emotional_condition?: string;
  notes: string;
  created_at: string;
  children?: Child;
};
