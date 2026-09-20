import { useState, useEffect, useCallback } from 'react';
import { supabase, type Child, type Attendance, type Category, type ChurchEvent, SERVICE_HOURS, getCurrentServiceTime, type ServiceTimeId } from '../lib/supabase';
import { fetchCategories, getChildCategory, getCategoryBadgeStyle, formatAge } from '../lib/categories';
import { fetchEvents } from '../lib/events';
import { Search, CheckCircle2, Loader2, UserCheck, Baby, X, FolderKanban, Calendar, Clock, Trash2 } from 'lucide-react';

type Props = {
  onCheckedIn?: () => void;
  onGoToEventAttendance?: (event: ChurchEvent) => void;
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

type AttendanceWithChild = Attendance & { child?: Child };

function TodayList({
  records,
  categories,
  onDeleteAttendance,
  deletingId,
}: {
  records: AttendanceWithChild[];
  categories: Category[];
  onDeleteAttendance: (attendanceId: string, childName: string) => Promise<void>;
  deletingId: string | null;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {records.map(rec => {
        const c = rec.child;
        if (!c) return null;
        const cat = getChildCategory(c, categories);
        const style = cat ? getCategoryBadgeStyle(cat.color) : null;
        const isDeleting = deletingId === rec.id;

        return (
          <div key={rec.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 shadow-inner">
                {c.photo_url ? (
                  <img src={c.photo_url} alt={c.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Baby size={14} className="text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-gray-800 truncate block">{c.full_name}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {cat && style ? (
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${style.bg} ${style.text} inline-block`}>
                      {cat.name}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">{formatAge(c.birthdate)}</span>
                  )}
                  <span className="text-[10px] text-gray-400 font-mono">
                    {new Date(rec.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDeleteAttendance(rec.id, c.full_name)}
              disabled={isDeleting}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex-shrink-0"
              title="Desmarcar la asistencia de este niño"
            >
              {isDeleting ? <Loader2 size={12} className="animate-spin text-red-500" /> : <Trash2 size={12} />}
              <span>Desmarcar</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function CheckIn({ onCheckedIn, onGoToEventAttendance }: Props) {
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
  const [children, setChildren] = useState<Child[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceWithChild[]>([]);
  const [todayEvents, setTodayEvents] = useState<ChurchEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [justChecked, setJustChecked] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedServiceTime, setSelectedServiceTime] = useState<ServiceTimeId>(getCurrentServiceTime());

  // Modal states
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [physCondition, setPhysCondition] = useState('Sano');
  const [emotCondition, setEmotCondition] = useState('Feliz');
  const [obs, setObs] = useState('');

  const loadTodayAttendance = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('*, child:children(*)')
      .eq('event_date', todayStr());
    setTodayAttendance((data as unknown as AttendanceWithChild[]) ?? []);
  }, []);

  useEffect(() => {
    loadTodayAttendance();
    fetchCategories().then(setCategories);
    fetchEvents().then(res => {
      const today = todayStr();
      const current = res.events.filter(e => e.event_date === today || e.status === 'in_progress');
      setTodayEvents(current);
    });
  }, [loadTodayAttendance]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true);
      let q = supabase
        .from('children')
        .select('*')
        .order('full_name')
        .limit(30);

      if (query.trim()) {
        q = q.ilike('full_name', `%${query.trim()}%`);
      }

      const { data } = await q;
      setChildren((data as Child[]) ?? []);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const currentServiceAttendance = todayAttendance.filter(a => (a.service_time || '8:00 AM') === selectedServiceTime);
  const checkedInIds = new Set(currentServiceAttendance.map(a => a.child_id));

  // Filter children list by category if category filter is selected
  const displayedChildren = children.filter(c => {
    if (selectedCatFilter === 'all') return true;
    const cat = getChildCategory(c, categories);
    return cat?.id === selectedCatFilter;
  });

  const confirmCheckIn = async () => {
    if (!selectedChild) return;
    if (checkedInIds.has(selectedChild.id)) return;
    setCheckingIn(selectedChild.id);
    try {
      const activeEv = todayEvents.length > 0 ? todayEvents[0] : null;
      const insertData: Record<string, unknown> = {
        child_id: selectedChild.id,
        event_date: todayStr(),
        checked_in_at: new Date().toISOString(),
        service_time: selectedServiceTime,
        physical_condition: physCondition,
        emotional_condition: emotCondition,
        notes: obs,
      };
      if (activeEv) {
        insertData.event_id = activeEv.id;
      }
      await supabase.from('attendance').insert(insertData);
      setJustChecked(selectedChild.id);
      setTimeout(() => setJustChecked(null), 3000);
      await loadTodayAttendance();
      onCheckedIn?.();
      setSelectedChild(null);
    } catch (err) {
      console.error(err);
      alert('Error al registrar asistencia.');
    } finally {
      setCheckingIn(null);
    }
  };

  const handleDeleteAttendance = async (attendanceId: string, childName: string) => {
    if (!confirm(`¿Deseas desmarcar la asistencia de "${childName}"?\nSe quitará su asistencia en este culto y el niño volverá a estar disponible para registrar.`)) {
      return;
    }
    setDeletingId(attendanceId);
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', attendanceId);
      if (error) throw error;
      await loadTodayAttendance();
      onCheckedIn?.();
    } catch (err) {
      console.error(err);
      alert('Error al desmarcar la asistencia.');
    } finally {
      setDeletingId(null);
    }
  };

  const selectedChildCat = selectedChild ? getChildCategory(selectedChild, categories) : null;
  const selectedChildCatStyle = selectedChildCat ? getCategoryBadgeStyle(selectedChildCat.color) : null;

  return (
    <div className="space-y-6">
      {/* Banner de Evento Activo Hoy */}
      {todayEvents.length > 0 && onGoToEventAttendance && (
        <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-sky-500/20">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-sky-950">
                Evento activo hoy: <span className="text-sky-700 font-extrabold">{todayEvents[0].title}</span>
              </p>
              <p className="text-[11px] text-sky-600">
                ¿Deseas tomar la asistencia directamente en este evento con métricas y reportes?
              </p>
            </div>
          </div>
          <button
            onClick={() => onGoToEventAttendance(todayEvents[0])}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all whitespace-nowrap self-start sm:self-auto"
          >
            <UserCheck size={15} />
            <span>Ir a Asistencia del Evento</span>
          </button>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
            <UserCheck size={18} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Registrar Asistencia</h2>
            <p className="text-xs text-gray-500">Busca al niño por nombre y registra su ingreso con su categoría</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700 flex-shrink-0">
              <Clock size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800">Horario de Culto Activo</p>
              <p className="text-[11px] text-gray-500">Asistencia para este turno</p>
            </div>
          </div>
          <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm gap-1">
            {SERVICE_HOURS.map(h => {
              const isSelected = selectedServiceTime === h.id;
              const count = todayAttendance.filter(a => (a.service_time || '8:00 AM') === h.id).length;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelectedServiceTime(h.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span>{h.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre del niño..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            autoFocus
          />
          {loading && (
            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
          )}
        </div>

        {/* Category Pills Filter for Quick Group Selection */}
        {categories.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setSelectedCatFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                selectedCatFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              Todas las categorías
            </button>
            {categories.map(cat => {
              const style = getCategoryBadgeStyle(cat.color);
              const isSelected = selectedCatFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCatFilter(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap border ${
                    isSelected
                      ? `${style.bg} ${style.text} ${style.border} ring-2 ring-emerald-500 font-bold`
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <span>{cat.name}</span>
                  <span className="text-[10px] opacity-75">({cat.min_age}-{cat.max_age}a)</span>
                </button>
              );
            })}
          </div>
        )}

        {displayedChildren.length === 0 && !loading && (
          <p className="text-sm text-gray-500 text-center mt-6 py-4">
            No se encontraron niños {query ? `para "${query}"` : 'en esta categoría'}.
          </p>
        )}

        {displayedChildren.length > 0 && (
          <div className="mt-4 space-y-2">
            {displayedChildren.map(child => {
              const alreadyIn = checkedInIds.has(child.id);
              const isCheckingIn = checkingIn === child.id;
              const cat = getChildCategory(child, categories);
              const style = cat ? getCategoryBadgeStyle(cat.color) : null;

              return (
                <div
                  key={child.id}
                  className={`flex items-center gap-3.5 p-3 rounded-xl border transition-all ${
                    alreadyIn
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : 'bg-white border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/20'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 shadow-inner">
                    {child.photo_url ? (
                      <img src={child.photo_url} alt={child.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Baby size={20} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{child.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500 truncate">
                        {formatAge(child.birthdate)}{child.birthdate && child.parent1_name ? ' · ' : ''}{child.parent1_name}
                      </span>
                      {cat && style && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${style.bg} ${style.text} ${style.border}`}>
                          <span>{cat.name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {alreadyIn ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-100/80 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 shadow-sm">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span>Presente</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const att = currentServiceAttendance.find(a => a.child_id === child.id);
                          if (att) handleDeleteAttendance(att.id, child.full_name);
                        }}
                        disabled={deletingId !== null}
                        className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all shadow-sm"
                        title="Desmarcar asistencia de este niño"
                      >
                        {deletingId && currentServiceAttendance.some(a => a.child_id === child.id && a.id === deletingId) ? (
                          <Loader2 size={13} className="animate-spin text-red-500" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                        <span>Desmarcar</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setPhysCondition('Sano');
                        setEmotCondition('Feliz');
                        setObs('');
                        setSelectedChild(child);
                      }}
                      disabled={isCheckingIn}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isCheckingIn
                          ? 'bg-gray-100 text-gray-400 cursor-wait'
                          : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                      }`}
                    >
                      {isCheckingIn ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      {isCheckingIn ? 'Registrando...' : 'Registrar'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {justChecked && (
          <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium animate-fadeIn">
            <CheckCircle2 size={18} />
            Asistencia registrada exitosamente
          </div>
        )}
      </div>

      {/* Today's Attendance List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">
              Asistencia de hoy · {selectedServiceTime === '8:00 AM' ? 'Culto 8:00 AM - 10:00 AM' : 'Culto 11:00 AM - 1:00 PM'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              <strong className="text-emerald-600 font-bold">{currentServiceAttendance.length}</strong> niño{currentServiceAttendance.length !== 1 ? 's' : ''} en este culto · <span className="text-gray-500">{todayAttendance.length} en total hoy</span>
            </p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
            {SERVICE_HOURS.map(h => {
              const count = todayAttendance.filter(a => (a.service_time || '8:00 AM') === h.id).length;
              return (
                <button
                  key={h.id}
                  onClick={() => setSelectedServiceTime(h.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedServiceTime === h.id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {h.shortLabel} ({count})
                </button>
              );
            })}
          </div>
        </div>
        {currentServiceAttendance.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aún no hay registros en este horario hoy</p>
        ) : (
          <TodayList
            records={currentServiceAttendance}
            categories={categories}
            onDeleteAttendance={handleDeleteAttendance}
            deletingId={deletingId}
          />
        )}
      </div>

      {/* Modal de Condiciones */}
      {selectedChild && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-emerald-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <UserCheck className="text-emerald-600" size={16} />
                </div>
                <h3 className="font-bold text-gray-800 text-sm">Condiciones de Ingreso</h3>
              </div>
              <button
                onClick={() => setSelectedChild(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Resumen del niño con Categoría */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                  {selectedChild.photo_url ? (
                    <img src={selectedChild.photo_url} alt={selectedChild.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Baby size={18} className="text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-800 text-sm">{selectedChild.full_name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[11px] text-gray-500">
                      {formatAge(selectedChild.birthdate)} · Tutor: {selectedChild.parent1_name}
                    </p>
                  </div>
                  {selectedChildCat && selectedChildCatStyle && (
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${selectedChildCatStyle.bg} ${selectedChildCatStyle.text} ${selectedChildCatStyle.border}`}>
                        <FolderKanban size={10} />
                        <span>{selectedChildCat.name}</span>
                        <span className="opacity-75">({selectedChildCat.min_age}-{selectedChildCat.max_age}a)</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Condición Física */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  ¿Cómo llega físicamente?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Sano', label: 'Sano / Excelente', icon: '👍' },
                    { id: 'Lesión', label: 'Golpes / Rasguños', icon: '🤕' },
                    { id: 'Enfermo', label: 'Enfermo / Fiebre', icon: '🤒' },
                    { id: 'Cansado', label: 'Cansado / Sueño', icon: '😴' },
                    { id: 'Otro', label: 'Otro / Detallar', icon: '✏️' },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPhysCondition(item.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                        physCondition === item.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm ring-1 ring-emerald-500'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-sm">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Condición Emocional */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  ¿Cómo llega emocionalmente?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'Feliz', label: 'Feliz / Alegre', icon: '😊' },
                    { id: 'Calmado', label: 'Calmado / Tranquilo', icon: '😌' },
                    { id: 'Triste', label: 'Triste', icon: '😢' },
                    { id: 'Llorando', label: 'Llorando / Asustado', icon: '😭' },
                    { id: 'Enojado', label: 'Enojado', icon: '😠' },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setEmotCondition(item.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                        emotCondition === item.id
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm ring-1 ring-emerald-500'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-sm">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Observaciones / Recomendaciones
                </label>
                <textarea
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  placeholder="Ej. Rasguño en el brazo izquierdo, alergias, requiere medicamentos..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent resize-none"
                />
              </div>

              {/* Acciones */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedChild(null)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmCheckIn}
                  disabled={checkingIn === selectedChild.id}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors text-xs disabled:opacity-60 shadow-sm shadow-emerald-100"
                >
                  {checkingIn === selectedChild.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
