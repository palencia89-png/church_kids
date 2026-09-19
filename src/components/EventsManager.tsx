import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchEvents,
  saveEvent,
  deleteEvent,
  EVENT_COLORS,
  SQL_MIGRATION_SCRIPT,
  type ChurchEventWithStats,
} from '../lib/events';
import { fetchCategories } from '../lib/categories';
import type { ChurchEvent, Category } from '../lib/supabase';
import EventModal from './EventModal';
import {
  Calendar,
  CalendarPlus,
  Clock,
  MapPin,
  Users,
  UserCheck,
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Database,
  Copy,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

type Props = {
  onSelectEventForAttendance: (event: ChurchEvent) => void;
};

function formatDateHuman(d: string) {
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d;
  }
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

export default function EventsManager({ onSelectEventForAttendance }: Props) {
  const [events, setEvents] = useState<ChurchEventWithStats[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<ChurchEvent | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, cats] = await Promise.all([
        fetchEvents(),
        fetchCategories(),
      ]);
      setEvents(eventsRes.events);
      setIsUsingFallback(eventsRes.isUsingFallback);
      setCategories(cats);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const todayStr = getTodayStr();

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      // Status filter
      if (statusFilter === 'today') {
        const isToday = ev.event_date === todayStr || ev.status === 'in_progress';
        if (!isToday) return false;
      } else if (statusFilter === 'upcoming') {
        const isUpcoming = ev.event_date > todayStr || ev.status === 'upcoming';
        if (!isUpcoming) return false;
      } else if (statusFilter === 'completed') {
        if (ev.status !== 'completed') return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesLoc = ev.location?.toLowerCase().includes(q);
        const matchesDesc = ev.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesLoc && !matchesDesc) return false;
      }
      return true;
    });
  }, [events, statusFilter, searchQuery, todayStr]);

  // Counts for KPIs
  const todayCount = useMemo(() => {
    return events.filter(e => e.event_date === todayStr || e.status === 'in_progress').length;
  }, [events, todayStr]);

  const upcomingCount = useMemo(() => {
    return events.filter(e => e.event_date > todayStr && e.status !== 'completed').length;
  }, [events, todayStr]);

  const totalAttendees = useMemo(() => {
    return events.reduce((sum, e) => sum + (e.attendee_count || 0), 0);
  }, [events]);

  const handleSaveEvent = async (data: Partial<ChurchEvent> & { title: string; event_date: string }) => {
    await saveEvent(data);
    await loadData();
  };

  const handleDeleteEvent = async (e: React.MouseEvent, eventId: string, eventTitle: string) => {
    e.stopPropagation();
    if (!confirm(`¿Estás seguro de eliminar el evento "${eventTitle}"? Se perderán las referencias de asistencia de este evento.`)) {
      return;
    }
    setDeletingId(eventId);
    try {
      await deleteEvent(eventId);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el evento.');
    } finally {
      setDeletingId(null);
    }
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Fallback Banner if Supabase table is not yet migrated */}
      {isUsingFallback && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0 mt-0.5">
              <Database size={16} />
            </div>
            <div>
              <p className="font-bold text-amber-900 text-xs sm:text-sm">
                Modo Local Activo (Base de datos en Supabase pendiente)
              </p>
              <p className="text-[11px] sm:text-xs text-amber-700 mt-0.5">
                Puedes crear eventos y tomar asistencia ahora mismo. Para sincronizarlos en la nube, ejecuta el script SQL en Supabase.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSqlModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all whitespace-nowrap self-start sm:self-auto"
          >
            <Database size={14} />
            <span>Ver Script SQL</span>
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-500 flex items-center justify-center text-white shadow-md shadow-sky-500/20 flex-shrink-0">
            <Calendar size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Eventos y Cultos</h2>
            <p className="text-xs text-gray-500">
              Programa actividades especiales y registra la asistencia de los niños en tiempo real
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setEventToEdit(null);
            setShowEventModal(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <CalendarPlus size={16} />
          <span>Crear Nuevo Evento</span>
        </button>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600 flex-shrink-0">
            <Calendar size={18} />
          </div>
          <div>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Total Eventos</p>
            <p className="text-xl font-black text-gray-800">{events.length}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Hoy / En Curso</p>
            <p className="text-xl font-black text-emerald-600">{todayCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Próximos</p>
            <p className="text-xl font-black text-indigo-600">{upcomingCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
            <Users size={18} />
          </div>
          <div>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Asistencias</p>
            <p className="text-xl font-black text-amber-600">{totalAttendees}</p>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, lugar o temática..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto justify-center text-xs font-bold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Todos ({events.length})
            </button>
            <button
              onClick={() => setStatusFilter('today')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'today'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Hoy / En Curso ({todayCount})
            </button>
            <button
              onClick={() => setStatusFilter('upcoming')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'upcoming'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Próximos ({upcomingCount})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'completed'
                  ? 'bg-white text-gray-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Finalizados
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-16 text-center">
          <Loader2 size={36} className="text-sky-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Cargando eventos...</p>
        </div>
      )}

      {/* Events List */}
      {!loading && (
        <>
          {filteredEvents.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-3">
                <Calendar size={28} />
              </div>
              <h3 className="font-bold text-gray-800 text-base">No se encontraron eventos</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                {searchQuery || statusFilter !== 'all'
                  ? 'Intenta cambiar los filtros o el término de búsqueda.'
                  : 'Aún no has creado ningún evento. Haz clic en "Crear Nuevo Evento" para comenzar.'}
              </p>
              <button
                onClick={() => {
                  setEventToEdit(null);
                  setShowEventModal(true);
                }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              >
                <Plus size={16} />
                <span>Crear Primer Evento</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEvents.map(ev => {
                const color = EVENT_COLORS[ev.color || 'sky'] || EVENT_COLORS.sky;
                const isToday = ev.event_date === todayStr;
                const isInProgress = ev.status === 'in_progress' || (isToday && ev.status !== 'completed');
                const isDeleting = deletingId === ev.id;

                return (
                  <div
                    key={ev.id}
                    className={`bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group`}
                  >
                    {/* Top colored accent border */}
                    <div className={`h-2.5 w-full ${color.dot}`} />

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      {/* Header tags & Actions */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Status badge */}
                            {isInProgress ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                En Curso / Hoy
                              </span>
                            ) : ev.status === 'completed' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                                ✅ Finalizado
                              </span>
                            ) : ev.status === 'cancelled' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                ❌ Cancelado
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
                                🗓️ Próximo
                              </span>
                            )}

                            {/* Category badge if targeted */}
                            {ev.category ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
                                {ev.category.name}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-gray-400">
                                Todas las edades
                              </span>
                            )}
                          </div>

                          {/* Action edit/delete */}
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEventToEdit(ev);
                                setShowEventModal(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                              title="Editar evento"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              disabled={isDeleting}
                              onClick={e => handleDeleteEvent(e, ev.id, ev.title)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar evento"
                            >
                              {isDeleting ? (
                                <Loader2 size={15} className="animate-spin text-red-500" />
                              ) : (
                                <Trash2 size={15} />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-sky-600 transition-colors">
                          {ev.title}
                        </h3>

                        {ev.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                            {ev.description}
                          </p>
                        )}
                      </div>

                      {/* Event Meta: Date, Time, Location */}
                      <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                        <div className="flex items-center gap-2 font-medium">
                          <Calendar size={14} className="text-sky-500 flex-shrink-0" />
                          <span className="capitalize font-semibold text-gray-800">
                            {formatDateHuman(ev.event_date)}
                          </span>
                        </div>

                        {ev.start_time && (
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-indigo-500 flex-shrink-0" />
                            <span>{ev.start_time} {ev.end_time ? `a ${ev.end_time}` : ''}</span>
                          </div>
                        )}

                        {ev.location && (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-rose-500 flex-shrink-0" />
                            <span className="truncate">{ev.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer: Attendees counter + "Tomar Asistencia" button */}
                      <div className="pt-2 flex items-center justify-between gap-3 border-t border-gray-50">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                          <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <Users size={14} />
                          </span>
                          <span>{ev.attendee_count} asistentes</span>
                        </div>

                        <button
                          onClick={() => onSelectEventForAttendance(ev)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all hover:shadow hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <UserCheck size={16} />
                          <span>Tomar Asistencia</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal: Create / Edit Event */}
      <EventModal
        isOpen={showEventModal}
        eventToEdit={eventToEdit}
        categories={categories}
        onClose={() => {
          setShowEventModal(false);
          setEventToEdit(null);
        }}
        onSave={handleSaveEvent}
      />

      {/* Modal: SQL Migration Instructions */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-amber-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                  <Database size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">Migración SQL para Supabase</h3>
                  <p className="text-[11px] text-gray-500">Copia este código y pégalo en Supabase SQL Editor</p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 space-y-1">
                <p className="font-bold">Pasos para sincronizar la base de datos:</p>
                <ol className="list-decimal pl-4 space-y-0.5 text-[11px]">
                  <li>Ve a tu consola de Supabase (<a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-bold">dashboard</a>).</li>
                  <li>Selecciona tu proyecto y abre el menú lateral <strong>SQL Editor</strong>.</li>
                  <li>Haz clic en <strong>New query</strong>, pega el código de abajo y haz clic en <strong>Run</strong>.</li>
                </ol>
              </div>

              <div className="relative">
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-64 leading-relaxed">
                  {SQL_MIGRATION_SCRIPT}
                </pre>
                <button
                  onClick={copySqlToClipboard}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-bold shadow transition-all"
                >
                  {copiedSql ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedSql ? '¡Copiado!' : 'Copiar SQL'}</span>
                </button>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowSqlModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
