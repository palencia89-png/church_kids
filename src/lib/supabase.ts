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

export type ChurchEvent = {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  category_id?: string | null;
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  color?: string;
  created_at?: string;
  category?: Category | null;
};

export type Attendance = {
  id: string;
  child_id: string;
  checked_in_at: string;
  event_date: string;
  event_id?: string | null;
  service_time?: string;
  physical_condition?: string;
  emotional_condition?: string;
  notes: string;
  created_at: string;
  children?: Child;
  event?: ChurchEvent | null;
};

export const SERVICE_HOURS = [
  { id: '8:00 AM', label: '8:00 AM - 10:00 AM', shortLabel: '8 a 10', badgeColor: 'sky' },
  { id: '11:00 AM', label: '11:00 AM - 1:00 PM', shortLabel: '11 a 1', badgeColor: 'amber' },
] as const;

export type ServiceTimeId = typeof SERVICE_HOURS[number]['id'];

export function getCurrentServiceTime(): ServiceTimeId {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  // If before 10:30 AM (630 min), default to 8:00 AM service. Otherwise 11:00 AM service.
  return totalMinutes < 630 ? '8:00 AM' : '11:00 AM';
}

export function formatServiceTimeLabel(serviceTime?: string | null): string {
  if (!serviceTime) return '8:00 AM - 10:00 AM';
  const found = SERVICE_HOURS.find(h => h.id === serviceTime);
  return found ? found.label : serviceTime;
}
