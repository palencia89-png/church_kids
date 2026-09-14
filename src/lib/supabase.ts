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

export type ServiceTime = '8:00 AM' | '11:00 AM';

export type Attendance = {
  id: string;
  child_id: string;
  checked_in_at: string;
  event_date: string;
  service_time?: string;
  physical_condition?: string;
  emotional_condition?: string;
  notes: string;
  created_at: string;
  children?: Child;
};

export const SERVICE_TIMES: { id: ServiceTime; label: string; time: string; badgeBg: string; badgeText: string; badgeBorder: string }[] = [
  { id: '8:00 AM', label: 'Servicio 8:00 AM', time: '8:00 AM', badgeBg: 'bg-indigo-50', badgeText: 'text-indigo-700', badgeBorder: 'border-indigo-200' },
  { id: '11:00 AM', label: 'Servicio 11:00 AM', time: '11:00 AM', badgeBg: 'bg-purple-50', badgeText: 'text-purple-700', badgeBorder: 'border-purple-200' },
];

export function getServiceFromRecord(rec: Partial<Attendance>): ServiceTime {
  if (rec.service_time === '11:00 AM' || rec.service_time === '11:00' || rec.service_time === '11:00am') {
    return '11:00 AM';
  }
  if (rec.service_time === '8:00 AM' || rec.service_time === '8:00' || rec.service_time === '8:00am') {
    return '8:00 AM';
  }
  if (rec.checked_in_at) {
    const d = new Date(rec.checked_in_at);
    if (!isNaN(d.getTime())) {
      const totalMinutes = d.getHours() * 60 + d.getMinutes();
      if (totalMinutes >= 615) return '11:00 AM';
    }
  }
  return '8:00 AM';
}

export function getCurrentDefaultService(): ServiceTime {
  const now = new Date();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();
  return totalMinutes >= 615 ? '11:00 AM' : '8:00 AM';
}
