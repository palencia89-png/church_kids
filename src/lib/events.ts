import { supabase, type ChurchEvent, type Attendance, type Child, type Category, getCurrentServiceTime } from './supabase';
import { getChildCategory } from './categories';

export const EVENT_COLORS: Record<
  string,
  { label: string; bg: string; text: string; border: string; badge: string; ring: string; dot: string }
> = {
  sky: {
    label: 'Cielo',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    badge: 'bg-sky-100 text-sky-800',
    ring: 'focus:ring-sky-400',
    dot: 'bg-sky-500',
  },
  emerald: {
    label: 'Esmeralda',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
    ring: 'focus:ring-emerald-400',
    dot: 'bg-emerald-500',
  },
  indigo: {
    label: 'Índigo',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    badge: 'bg-indigo-100 text-indigo-800',
    ring: 'focus:ring-indigo-400',
    dot: 'bg-indigo-500',
  },
  amber: {
    label: 'Ámbar',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    ring: 'focus:ring-amber-400',
    dot: 'bg-amber-500',
  },
  rose: {
    label: 'Rosa',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-800',
    ring: 'focus:ring-rose-400',
    dot: 'bg-rose-500',
  },
  purple: {
    label: 'Púrpura',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    badge: 'bg-purple-100 text-purple-800',
    ring: 'focus:ring-purple-400',
    dot: 'bg-purple-500',
  },
};

export type ChurchEventWithStats = ChurchEvent & {
  attendee_count: number;
};

export type EventAttendanceRecord = Attendance & {
  child: Child;
};

export const SQL_MIGRATION_SCRIPT = `-- Copia y pega esto en Supabase -> SQL Editor -> Run

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time text DEFAULT '09:00',
  end_time text DEFAULT '',
  location text DEFAULT 'Salón Principal',
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'upcoming',
  color text DEFAULT 'sky',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE attendance 
ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS events_event_date_idx ON events(event_date);
CREATE INDEX IF NOT EXISTS events_status_idx ON events(status);
CREATE INDEX IF NOT EXISTS events_category_id_idx ON events(category_id);
CREATE INDEX IF NOT EXISTS attendance_event_id_idx ON attendance(event_id);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage events"
  ON events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon users can view events"
  ON events FOR SELECT TO anon USING (true);

CREATE POLICY "Anon users can update events"
  ON events FOR UPDATE TO anon USING (true) WITH CHECK (true);
`;

// LocalStorage fallback keys
const LS_EVENTS_KEY = 'church_kids_events_cache';
const LS_ATTENDANCE_KEY = 'church_kids_event_attendance_cache';

function getLocalEvents(): ChurchEvent[] {
  try {
    const raw = localStorage.getItem(LS_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalEvents(events: ChurchEvent[]) {
  try {
    localStorage.setItem(LS_EVENTS_KEY, JSON.stringify(events));
  } catch (e) {
    console.warn('Could not save local events', e);
  }
}

function getLocalAttendance(): Attendance[] {
  try {
    const raw = localStorage.getItem(LS_ATTENDANCE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAttendance(records: Attendance[]) {
  try {
    localStorage.setItem(LS_ATTENDANCE_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn('Could not save local event attendance', e);
  }
}

let tableMissingCache: boolean | null = null;

/**
 * Check if the `events` table exists in Supabase.
 */
export async function checkEventsTableAvailable(): Promise<boolean> {
  if (tableMissingCache !== null) {
    return !tableMissingCache;
  }
  try {
    const { error } = await supabase.from('events').select('id').limit(1);
    if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.code === '42P01')) {
      tableMissingCache = true;
      return false;
    }
    tableMissingCache = false;
    return true;
  } catch {
    tableMissingCache = true;
    return false;
  }
}

/**
 * Fetch all church events with attendee counts.
 */
export async function fetchEvents(): Promise<{ events: ChurchEventWithStats[]; isUsingFallback: boolean }> {
  const isAvailable = await checkEventsTableAvailable();

  if (!isAvailable) {
    const local = getLocalEvents();
    const localAtt = getLocalAttendance();
    const withStats: ChurchEventWithStats[] = local.map(ev => ({
      ...ev,
      attendee_count: localAtt.filter(a => a.event_id === ev.id).length,
    }));
    // Sort descending by event_date
    withStats.sort((a, b) => b.event_date.localeCompare(a.event_date));
    return { events: withStats, isUsingFallback: true };
  }

  try {
    const { data: eventsData, error } = await supabase
      .from('events')
      .select('*, category:categories(*)')
      .order('event_date', { ascending: false });

    if (error) throw error;

    // Fetch counts from attendance
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('event_id');

    const counts: Record<string, number> = {};
    if (attendanceData) {
      attendanceData.forEach((row: { event_id?: string | null }) => {
        if (row.event_id) {
          counts[row.event_id] = (counts[row.event_id] || 0) + 1;
        }
      });
    }

    const events = ((eventsData as unknown as ChurchEvent[]) || []).map(ev => ({
      ...ev,
      attendee_count: counts[ev.id] || 0,
    }));

    return { events, isUsingFallback: false };
  } catch (err) {
    console.error('Error in fetchEvents, falling back to local storage', err);
    const local = getLocalEvents();
    const localAtt = getLocalAttendance();
    const withStats: ChurchEventWithStats[] = local.map(ev => ({
      ...ev,
      attendee_count: localAtt.filter(a => a.event_id === ev.id).length,
    }));
    return { events: withStats, isUsingFallback: true };
  }
}

/**
 * Fetch single event with details.
 */
export async function fetchEventById(id: string): Promise<ChurchEvent | null> {
  const isAvailable = await checkEventsTableAvailable();
  if (!isAvailable) {
    const local = getLocalEvents();
    return local.find(e => e.id === id) || null;
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .select('*, category:categories(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as unknown as ChurchEvent;
  } catch {
    const local = getLocalEvents();
    return local.find(e => e.id === id) || null;
  }
}

/**
 * Save an event (insert or update).
 */
export async function saveEvent(
  eventData: Partial<ChurchEvent> & { title: string; event_date: string }
): Promise<ChurchEvent> {
  const isAvailable = await checkEventsTableAvailable();

  if (!isAvailable) {
    const local = getLocalEvents();
    if (eventData.id) {
      const idx = local.findIndex(e => e.id === eventData.id);
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...eventData } as ChurchEvent;
        saveLocalEvents(local);
        return local[idx];
      }
    }
    const newEvent: ChurchEvent = {
      id: eventData.id || crypto.randomUUID(),
      title: eventData.title,
      description: eventData.description || '',
      event_date: eventData.event_date,
      start_time: eventData.start_time || '09:00',
      end_time: eventData.end_time || '',
      location: eventData.location || 'Salón Principal',
      category_id: eventData.category_id || null,
      status: eventData.status || 'upcoming',
      color: eventData.color || 'sky',
      created_at: new Date().toISOString(),
    };
    local.unshift(newEvent);
    saveLocalEvents(local);
    return newEvent;
  }

  const payload: Partial<ChurchEvent> = {
    title: eventData.title,
    description: eventData.description || '',
    event_date: eventData.event_date,
    start_time: eventData.start_time || '09:00',
    end_time: eventData.end_time || '',
    location: eventData.location || 'Salón Principal',
    category_id: eventData.category_id || null,
    status: eventData.status || 'upcoming',
    color: eventData.color || 'sky',
  };

  if (eventData.id) {
    const { data, error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', eventData.id)
      .select('*, category:categories(*)')
      .single();

    if (error) throw error;
    return data as unknown as ChurchEvent;
  } else {
    const { data, error } = await supabase
      .from('events')
      .insert(payload)
      .select('*, category:categories(*)')
      .single();

    if (error) throw error;
    return data as unknown as ChurchEvent;
  }
}

/**
 * Delete an event.
 */
export async function deleteEvent(id: string): Promise<void> {
  const isAvailable = await checkEventsTableAvailable();
  if (!isAvailable) {
    const local = getLocalEvents().filter(e => e.id !== id);
    saveLocalEvents(local);
    const localAtt = getLocalAttendance().filter(a => a.event_id !== id);
    saveLocalAttendance(localAtt);
    return;
  }

  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Fetch attendance for a specific event.
 */
export async function fetchEventAttendance(
  eventId: string,
  eventDate?: string
): Promise<EventAttendanceRecord[]> {
  const isAvailable = await checkEventsTableAvailable();

  if (!isAvailable) {
    const localAtt = getLocalAttendance().filter(a => a.event_id === eventId);
    if (localAtt.length === 0) return [];
    const childIds = localAtt.map(a => a.child_id);
    const { data: kids } = await supabase.from('children').select('*').in('id', childIds);
    const kidsMap = new Map((kids || []).map((k: Child) => [k.id, k]));

    return localAtt
      .map(a => ({
        ...a,
        child: kidsMap.get(a.child_id) as Child,
      }))
      .filter(r => Boolean(r.child)) as EventAttendanceRecord[];
  }

  try {
    // We search primarily by event_id, or also include event_date match if event_id is null in older records
    let query = supabase
      .from('attendance')
      .select('*, child:children(*)')
      .eq('event_id', eventId)
      .order('checked_in_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return (data as unknown as EventAttendanceRecord[]) || [];
  } catch (err) {
    console.error('Error fetching event attendance', err);
    // Fallback if event_id column does not exist yet on remote table
    if (eventDate) {
      const { data } = await supabase
        .from('attendance')
        .select('*, child:children(*)')
        .eq('event_date', eventDate)
        .order('checked_in_at', { ascending: false });
      return (data as unknown as EventAttendanceRecord[]) || [];
    }
    return [];
  }
}

/**
 * Check in a child to a specific event.
 */
export async function checkInChildToEvent(params: {
  eventId: string;
  childId: string;
  eventDate: string;
  physicalCondition?: string;
  emotionalCondition?: string;
  notes?: string;
}): Promise<Attendance> {
  const { eventId, childId, eventDate, physicalCondition = 'Sano', emotionalCondition = 'Feliz', notes = '' } = params;
  const isAvailable = await checkEventsTableAvailable();

  const now = new Date().toISOString();
  const serviceTime = getCurrentServiceTime();
  const record: Attendance = {
    id: crypto.randomUUID(),
    child_id: childId,
    event_id: eventId,
    event_date: eventDate,
    checked_in_at: now,
    service_time: serviceTime,
    physical_condition: physicalCondition,
    emotional_condition: emotionalCondition,
    notes,
    created_at: now,
  };

  if (!isAvailable) {
    const localAtt = getLocalAttendance();
    // avoid duplicates
    const exists = localAtt.some(a => a.event_id === eventId && a.child_id === childId);
    if (!exists) {
      localAtt.unshift(record);
      saveLocalAttendance(localAtt);
    }
    return record;
  }

  // Try inserting with event_id
  try {
    const { data, error } = await supabase
      .from('attendance')
      .insert({
        child_id: childId,
        event_id: eventId,
        event_date: eventDate,
        checked_in_at: now,
        service_time: serviceTime,
        physical_condition: physicalCondition,
        emotional_condition: emotionalCondition,
        notes,
      })
      .select('*')
      .single();

    if (error) {
      // If error is about event_id column missing in attendance table
      if (error.message?.includes('event_id') || error.code === '42703') {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('attendance')
          .insert({
            child_id: childId,
            event_date: eventDate,
            checked_in_at: now,
            service_time: serviceTime,
            physical_condition: physicalCondition,
            emotional_condition: emotionalCondition,
            notes,
          })
          .select('*')
          .single();

        if (fallbackError) throw fallbackError;
        return { ...(fallbackData as Attendance), event_id: eventId };
      }
      throw error;
    }
    return data as Attendance;
  } catch (err) {
    console.error('Error inserting attendance to Supabase, saving locally', err);
    const localAtt = getLocalAttendance();
    localAtt.unshift(record);
    saveLocalAttendance(localAtt);
    return record;
  }
}

/**
 * Remove/undo check-in for an attendance record.
 */
export async function removeEventAttendance(attendanceId: string): Promise<void> {
  const isAvailable = await checkEventsTableAvailable();

  if (!isAvailable) {
    const localAtt = getLocalAttendance().filter(a => a.id !== attendanceId);
    saveLocalAttendance(localAtt);
    return;
  }

  try {
    const { error } = await supabase.from('attendance').delete().eq('id', attendanceId);
    if (error) throw error;
  } catch {
    const localAtt = getLocalAttendance().filter(a => a.id !== attendanceId);
    saveLocalAttendance(localAtt);
  }
}
