import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, type ChurchEvent, type Child, type Category } from '../lib/supabase';
import {
  fetchEventAttendance,
  checkInChildToEvent,
  removeEventAttendance,
  saveEvent,
  EVENT_COLORS,
  type EventAttendanceRecord,
} from '../lib/events';
import { fetchCategories, getChildCategory, getCategoryBadgeStyle, formatAge } from '../lib/categories';
import { exportSingleEventAttendanceToExcel } from '../lib/excelExport';
import {
  ArrowLeft,
  Search,
  UserCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  AlertTriangle,
  Baby,
  FileSpreadsheet,
  Trash2,
  Loader2,
  Sparkles,
  Smile,
  Activity,
  X,
  Phone,
  Check,
  SlidersHorizontal,
} from 'lucide-react';

type Props = {
  event: ChurchEvent;
  onBack: () => void;
  onEventUpdated: (event: ChurchEvent) => void;
};

function getPhysBadge(cond?: string) {
  switch (cond) {
    case 'Sano':
      return { label: 'Sano', emoji: '👍', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'Lesión':
      return { label: 'Golpes/Rasguños', emoji: '🤕', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'Enfermo':
      return { label: 'Enfermo', emoji: '🤒', bg: 'bg-red-50 text-red-700 border-red-200' };
    case 'Cansado':
      return { label: 'Cansado', emoji: '😴', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'Otro':
      return { label: 'Otro', emoji: '✏️', bg: 'bg-gray-50 text-gray-700 border-gray-200' };
    default:
      return { label: 'Sano', emoji: '👍', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
}

function getEmotBadge(cond?: string) {
  switch (cond) {
    case 'Feliz':
      return { label: 'Feliz', emoji: '😊', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'Calmado':
      return { label: 'Calmado', emoji: '😌', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'Triste':
      return { label: 'Triste', emoji: '😢', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'Llorando':
      return { label: 'Llorando', emoji: '😭', bg: 'bg-red-50 text-red-700 border-red-200' };
    case 'Enojado':
      return { label: 'Enojado', emoji: '😠', bg: 'bg-red-50 text-red-700 border-red-200' };
    default:
      return { label: 'Feliz', emoji: '😊', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
}

export default function EventAttendance({ event, onBack, onEventUpdated }: Props) {
  const [attendees, setAttendees] = useState<EventAttendanceRecord[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>(event.category_id || 'all');
  const [viewTab, setViewTab] = useState<'pending' | 'checked_in' | 'all'>('pending');

  // Fast action states
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [justCheckedId, setJustCheckedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Condition modal
  const [modalChild, setModalChild] = useState<Child | null>(null);
  const [physCondition, setPhysCondition] = useState('Sano');
  const [emotCondition, setEmotCondition] = useState('Feliz');
  const [notes, setNotes] = useState('');

  const colorTheme = EVENT_COLORS[event.color || 'sky'] || EVENT_COLORS.sky;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, attList, { data: kidsData }] = await Promise.all([
        fetchCategories(),
        fetchEventAttendance(event.id, event.event_date),
        supabase.from('children').select('*').order('full_name'),
      ]);

      setCategories(cats);
      setAttendees(attList);
      setChildren((kidsData as Child[]) || []);
    } catch (err) {
      console.error('Error loading event attendance data:', err);
    } finally {
      setLoading(false);
    }
  }, [event.id, event.event_date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set of child IDs who have already checked in
  const checkedInChildIds = useMemo(() => {
    return new Set(attendees.map(a => a.child_id));
  }, [attendees]);

  // Filter children based on search and category
  const relevantChildren = useMemo(() => {
    return children.filter(c => {
      // Category filter
      if (catFilter !== 'all') {
        const cat = getChildCategory(c, categories);
        if (cat?.id !== catFilter) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = c.full_name.toLowerCase().includes(query);
        const matchesParent =
          c.parent1_name?.toLowerCase().includes(query) ||
          c.parent2_name?.toLowerCase().includes(query);
        if (!matchesName && !matchesParent) return false;
      }
      return true;
    });
  }, [children, categories, catFilter, searchQuery]);

  const pendingChildren = useMemo(() => {
    return relevantChildren.filter(c => !checkedInChildIds.has(c.id));
  }, [relevantChildren, checkedInChildIds]);

  const checkedInList = useMemo(() => {
    return attendees.filter(a => {
      if (catFilter !== 'all') {
        const cat = getChildCategory(a.child, categories);
        if (cat?.id !== catFilter) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = a.child?.full_name?.toLowerCase().includes(query);
        if (!matchesName) return false;
      }
      return true;
    });
  }, [attendees, categories, catFilter, searchQuery]);

  // Alert count (kids with special physical or emotional conditions)
  const alertAttendees = useMemo(() => {
    return attendees.filter(
      a =>
        (a.physical_condition && a.physical_condition !== 'Sano') ||
        (a.emotional_condition && !['Feliz', 'Calmado'].includes(a.emotional_condition)) ||
        (a.notes && a.notes.trim().length > 0)
    );
  }, [attendees]);

  // Quick 1-click check-in
  const handleQuickCheckIn = async (child: Child) => {
    if (checkedInChildIds.has(child.id)) return;
    setCheckingInId(child.id);
    try {
      await checkInChildToEvent({
        eventId: event.id,
        childId: child.id,
        eventDate: event.event_date,
        physicalCondition: 'Sano',
        emotionalCondition: 'Feliz',
        notes: '',
      });
      setJustCheckedId(child.id);
      setTimeout(() => setJustCheckedId(null), 2500);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al registrar asistencia.');
    } finally {
      setCheckingInId(null);
    }
  };

  // Detailed check-in via modal
  const handleDetailedCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalChild) return;
    setCheckingInId(modalChild.id);
    try {
      await checkInChildToEvent({
        eventId: event.id,
        childId: modalChild.id,
        eventDate: event.event_date,
        physicalCondition: physCondition,
        emotionalCondition: emotCondition,
        notes: notes.trim(),
      });
      setModalChild(null);
      setJustCheckedId(modalChild.id);
      setTimeout(() => setJustCheckedId(null), 2500);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al registrar asistencia detallada.');
    } finally {
      setCheckingInId(null);
    }
  };

  // Undo/remove check-in
  const handleRemoveCheckIn = async (attendanceId: string, childName: string) => {
    if (!confirm(`¿Anular la asistencia de ${childName} para este evento?`)) return;
    setRemovingId(attendanceId);
    try {
      await removeEventAttendance(attendanceId);
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al anular asistencia.');
    } finally {
      setRemovingId(null);
    }
  };

  // Toggle event status
  const handleStatusChange = async (newStatus: ChurchEvent['status']) => {
    setStatusUpdating(true);
    try {
      const updated = await saveEvent({
        id: event.id,
        title: event.title,
        event_date: event.event_date,
        status: newStatus,
      });
      onEventUpdated(updated);
    } catch (err) {
      console.error(err);
      alert('Error al actualizar el estado del evento.');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Export event attendance
  const handleExportExcel = () => {
    exportSingleEventAttendanceToExcel(event, attendees, categories);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
        >
          <ArrowLeft size={16} />
          <span>Volver a Eventos</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Status selector */}
          <div className="flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5">
            <span className="text-gray-500 font-medium">Estado:</span>
            <select
              value={event.status}
              disabled={statusUpdating}
              onChange={e => handleStatusChange(e.target.value as ChurchEvent['status'])}
              className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
            >
              <option value="upcoming">🗓️ Próximo</option>
              <option value="in_progress">🟢 En Curso / Hoy</option>
              <option value="completed">✅ Finalizado</option>
              <option value="cancelled">❌ Cancelado</option>
            </select>
            {statusUpdating && <Loader2 size={12} className="animate-spin text-sky-500" />}
          </div>

          {/* Export to Excel */}
          <button
            onClick={handleExportExcel}
            disabled={attendees.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-40"
          >
            <FileSpreadsheet size={16} />
            <span className="hidden sm:inline">Exportar a Excel</span>
          </button>
        </div>
      </div>

      {/* Event Header Banner */}
      <div className={`p-6 rounded-2xl border ${colorTheme.border} ${colorTheme.bg} shadow-sm relative overflow-hidden`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${colorTheme.badge}`}>
                Toma de Asistencia
              </span>
              {event.status === 'in_progress' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Evento en Curso
                </span>
              )}
              {event.category && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/80 border border-gray-200 text-gray-700">
                  {event.category.name} ({event.category.min_age}-{event.category.max_age} años)
                </span>
              )}
            </div>

            <h1 className="text-2xl font-black text-gray-900 leading-tight tracking-tight">
              {event.title}
            </h1>

            {event.description && (
              <p className="text-xs text-gray-600 max-w-2xl leading-relaxed">{event.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-600 pt-1">
              <div className="flex items-center gap-1.5">
                <Calendar size={15} className="text-gray-400" />
                <span>{new Date(event.event_date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              {event.start_time && (
                <div className="flex items-center gap-1.5">
                  <Clock size={15} className="text-gray-400" />
                  <span>{event.start_time} {event.end_time ? `hasta ${event.end_time}` : ''}</span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={15} className="text-gray-400" />
                  <span>{event.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Attendance Counter Badge */}
          <div className="flex items-center gap-4 bg-white/90 backdrop-blur-sm p-4 rounded-2xl border border-gray-200 shadow-sm self-start md:self-auto min-w-[200px] justify-around">
            <div className="text-center">
              <p className="text-3xl font-black text-emerald-600">{attendees.length}</p>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Presentes</p>
            </div>
            <div className="h-10 w-px bg-gray-200" />
            <div className="text-center">
              <p className="text-3xl font-black text-gray-700">{children.length}</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Registrados</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Asistencia</p>
            <p className="text-lg font-bold text-gray-800">
              {children.length > 0 ? `${((attendees.length / children.length) * 100).toFixed(0)}%` : '0%'}
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-sky-600 flex-shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Por Ingresar</p>
            <p className="text-lg font-bold text-gray-800">{Math.max(0, children.length - attendees.length)}</p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Condición Especial</p>
            <p className="text-lg font-bold text-amber-700">{alertAttendees.length}</p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Categorías</p>
            <p className="text-lg font-bold text-purple-700">{categories.length}</p>
          </div>
        </div>
      </div>

      {/* Main Search & Control Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search input */}
          <div className="relative w-full sm:flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre del niño o tutor..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* View Tab Buttons */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto justify-center text-xs font-bold">
            <button
              onClick={() => setViewTab('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewTab === 'pending'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Por Registrar ({pendingChildren.length})
            </button>
            <button
              onClick={() => setViewTab('checked_in')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewTab === 'checked_in'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Presentes ({checkedInList.length})
            </button>
            <button
              onClick={() => setViewTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                viewTab === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Todos ({relevantChildren.length})
            </button>
          </div>
        </div>

        {/* Categories Filter Pills */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
            <span className="text-gray-400 text-[11px] font-medium mr-1 flex items-center gap-1">
              <SlidersHorizontal size={13} /> Categoría:
            </span>
            <button
              onClick={() => setCatFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                catFilter === 'all'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
            {categories.map(cat => {
              const style = getCategoryBadgeStyle(cat.color);
              const isSelected = catFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCatFilter(cat.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? `${style.bg} ${style.text} font-bold ring-2 ring-offset-1 ring-sky-300 shadow-sm`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-16 text-center">
          <Loader2 size={36} className="text-sky-500 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">Cargando niños y asistencias del evento...</p>
        </div>
      )}

      {/* Content depending on selected tab */}
      {!loading && (
        <>
          {/* TAB 1: PENDING (POR REGISTRAR) */}
          {viewTab === 'pending' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">
                  Niños pendientes por ingresar ({pendingChildren.length})
                </h3>
                <span className="text-xs text-gray-400">
                  Haz clic en ⚡ Rápido para ingreso directo o en 📝 Detalle para condición especial
                </span>
              </div>

              {pendingChildren.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={28} />
                  </div>
                  <h4 className="font-bold text-gray-800 text-base">¡Todos los niños están registrados!</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    No hay niños pendientes con los filtros actuales.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingChildren.map(child => {
                    const cat = getChildCategory(child, categories);
                    const catStyle = cat ? getCategoryBadgeStyle(cat.color) : null;
                    const isCheckingIn = checkingInId === child.id;
                    const isJustChecked = justCheckedId === child.id;

                    return (
                      <div
                        key={child.id}
                        className={`bg-white rounded-2xl border transition-all p-3.5 flex flex-col justify-between gap-3 hover:shadow-md ${
                          isJustChecked
                            ? 'border-emerald-400 bg-emerald-50/30'
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Photo / Avatar */}
                          <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                            {child.photo_url ? (
                              <img
                                src={child.photo_url}
                                alt={child.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <Baby size={20} />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 text-sm truncate">{child.full_name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {cat && catStyle ? (
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${catStyle.bg} ${catStyle.text}`}>
                                  {cat.name}
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-400">
                                  {child.birthdate ? formatAge(child.birthdate) : 'Sin edad'}
                                </span>
                              )}
                              {child.birthdate && cat && (
                                <span className="text-[10px] text-gray-400">• {formatAge(child.birthdate)}</span>
                              )}
                            </div>
                            {child.notes && (
                              <p className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 mt-1 truncate">
                                ⚠️ {child.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Check-in buttons */}
                        <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
                          {/* Quick Check-in (1-Click) */}
                          <button
                            type="button"
                            disabled={isCheckingIn}
                            onClick={() => handleQuickCheckIn(child)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                            title="Ingreso rápido (Sano y Feliz)"
                          >
                            {isCheckingIn ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : isJustChecked ? (
                              <>
                                <Check size={14} />
                                <span>¡Listo!</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={14} />
                                <span>⚡ Ingresar</span>
                              </>
                            )}
                          </button>

                          {/* Detailed Check-in */}
                          <button
                            type="button"
                            disabled={isCheckingIn}
                            onClick={() => {
                              setModalChild(child);
                              setPhysCondition('Sano');
                              setEmotCondition('Feliz');
                              setNotes(child.notes || '');
                            }}
                            className="px-2.5 py-2 bg-gray-100 hover:bg-sky-50 hover:text-sky-700 text-gray-600 rounded-xl text-xs font-semibold transition-colors"
                            title="Registrar con condición física o emocional"
                          >
                            📝 Detalle
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CHECKED IN (PRESENTES) */}
          {viewTab === 'checked_in' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">
                  Niños presentes en este evento ({checkedInList.length})
                </h3>
                <span className="text-xs text-gray-400">
                  Ordenados por hora de ingreso reciente
                </span>
              </div>

              {checkedInList.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                    <UserCheck size={28} />
                  </div>
                  <h4 className="font-bold text-gray-800 text-base">Aún no hay asistencias registradas</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    Cambia a la pestaña &ldquo;Por Registrar&rdquo; para comenzar el ingreso de los niños.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {checkedInList.map((att, idx) => {
                    const child = att.child;
                    const cat = child ? getChildCategory(child, categories) : null;
                    const catStyle = cat ? getCategoryBadgeStyle(cat.color) : null;
                    const phys = getPhysBadge(att.physical_condition);
                    const emot = getEmotBadge(att.emotional_condition);
                    const timeStr = att.checked_in_at
                      ? new Date(att.checked_in_at).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';
                    const isRemoving = removingId === att.id;

                    return (
                      <div
                        key={att.id}
                        className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3.5">
                          {/* Number badge */}
                          <span className="text-xs font-bold text-gray-400 w-5 text-center">
                            {idx + 1}
                          </span>

                          {/* Avatar */}
                          <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                            {child?.photo_url ? (
                              <img
                                src={child.photo_url}
                                alt={child.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <Baby size={20} />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-gray-900 text-sm truncate">
                                {child?.full_name || 'Niño no encontrado'}
                              </h4>
                              {cat && catStyle && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${catStyle.bg} ${catStyle.text}`}>
                                  {cat.name}
                                </span>
                              )}
                              {child?.birthdate && (
                                <span className="text-[11px] text-gray-400">
                                  ({formatAge(child.birthdate)})
                                </span>
                              )}
                            </div>

                            {/* Conditions badges */}
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${phys.bg}`}
                              >
                                <span>{phys.emoji}</span>
                                <span>{phys.label}</span>
                              </span>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 ${emot.bg}`}
                              >
                                <span>{emot.emoji}</span>
                                <span>{emot.label}</span>
                              </span>
                              {child?.parent1_phone && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                  <Phone size={10} /> {child.parent1_phone}
                                </span>
                              )}
                            </div>

                            {att.notes && (
                              <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1 mt-1.5">
                                💬 {att.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Time & Undo action */}
                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                              <Clock size={12} className="text-gray-400" />
                              <span>{timeStr}</span>
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={isRemoving}
                            onClick={() => handleRemoveCheckIn(att.id, child?.full_name || 'este niño')}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Anular asistencia"
                          >
                            {isRemoving ? (
                              <Loader2 size={16} className="animate-spin text-red-500" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ALL (TODOS LOS NIÑOS CON ESTADO) */}
          {viewTab === 'all' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">
                  Directorio del Evento ({relevantChildren.length} niños)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {relevantChildren.map(child => {
                  const isChecked = checkedInChildIds.has(child.id);
                  const cat = getChildCategory(child, categories);
                  const catStyle = cat ? getCategoryBadgeStyle(cat.color) : null;
                  const isCheckingIn = checkingInId === child.id;

                  return (
                    <div
                      key={child.id}
                      className={`bg-white rounded-2xl border p-3.5 flex items-center justify-between gap-3 ${
                        isChecked ? 'border-emerald-200 bg-emerald-50/20' : 'border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                          {child.photo_url ? (
                            <img
                              src={child.photo_url}
                              alt={child.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Baby size={18} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900 text-xs truncate">{child.full_name}</h4>
                          <div className="flex items-center gap-1 mt-0.5">
                            {cat && catStyle && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${catStyle.bg} ${catStyle.text}`}>
                                {cat.name}
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400">
                              {child.birthdate ? formatAge(child.birthdate) : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isChecked ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-lg">
                          <Check size={13} /> Presente
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isCheckingIn}
                          onClick={() => handleQuickCheckIn(child)}
                          className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                        >
                          {isCheckingIn ? <Loader2 size={13} className="animate-spin" /> : 'Ingresar'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Detailed Check-in Modal */}
      {modalChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-emerald-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">Registro con Detalle</h3>
                  <p className="text-[11px] text-gray-500">{modalChild.full_name}</p>
                </div>
              </div>
              <button
                onClick={() => setModalChild(null)}
                className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDetailedCheckInSubmit} className="p-6 space-y-4">
              {/* Physical condition */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Activity size={14} className="text-sky-500" /> Condición Física al Ingreso
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                  {['Sano', 'Lesión', 'Enfermo', 'Cansado', 'Otro'].map(cond => {
                    const badge = getPhysBadge(cond);
                    const isSelected = physCondition === cond;
                    return (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setPhysCondition(cond)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                          isSelected
                            ? `${badge.bg} ring-2 ring-sky-400 font-bold shadow-sm`
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-base">{badge.emoji}</span>
                        <span>{cond}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Emotional condition */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Smile size={14} className="text-amber-500" /> Condición Emocional al Ingreso
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                  {['Feliz', 'Calmado', 'Triste', 'Llorando', 'Enojado'].map(cond => {
                    const badge = getEmotBadge(cond);
                    const isSelected = emotCondition === cond;
                    return (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setEmotCondition(cond)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                          isSelected
                            ? `${badge.bg} ring-2 ring-amber-400 font-bold shadow-sm`
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-base">{badge.emoji}</span>
                        <span>{cond}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Observaciones / Alergias / Indicaciones
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ej. Trae medicamento, no comer maní, golpe leve en la rodilla..."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalChild(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={checkingInId === modalChild.id}
                  className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  {checkingInId === modalChild.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <UserCheck size={16} />
                  )}
                  <span>Confirmar Ingreso</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
