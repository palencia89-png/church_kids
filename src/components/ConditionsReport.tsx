import { useState, useEffect } from 'react';
import { supabase, type Attendance, type Child, type Category, SERVICE_HOURS } from '../lib/supabase';
import { fetchCategories, getChildCategory, getCategoryBadgeStyle, formatAge } from '../lib/categories';
import { exportAttendanceToExcel } from '../lib/excelExport';
import {
  Calendar,
  Search,
  Baby,
  Loader2,
  BarChart3,
  AlertTriangle,
  Heart,
  ShieldAlert,
  Phone,
  Clock,
  FileSpreadsheet,
  FolderKanban,
  Trash2,
} from 'lucide-react';

type AttendanceWithChild = Attendance & { child: Child };
type DateFilter = 'today' | 'week' | 'month' | 'all';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function dateDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function startOfMonthStr() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function getPhysBadge(cond?: string) {
  switch (cond) {
    case 'Sano': return { label: 'Sano', emoji: '👍', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    case 'Lesión': return { label: 'Golpes/Rasguños', emoji: '🤕', bg: 'bg-amber-50 text-amber-700 border-amber-100' };
    case 'Enfermo': return { label: 'Enfermo', emoji: '🤒', bg: 'bg-red-50 text-red-700 border-red-100' };
    case 'Cansado': return { label: 'Cansado', emoji: '😴', bg: 'bg-blue-50 text-blue-700 border-blue-100' };
    case 'Otro': return { label: 'Otro', emoji: '✏️', bg: 'bg-gray-50 text-gray-600 border-gray-200' };
    default: return { label: 'Sano', emoji: '👍', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  }
}

function getEmotBadge(cond?: string) {
  switch (cond) {
    case 'Feliz': return { label: 'Feliz', emoji: '😊', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    case 'Calmado': return { label: 'Calmado', emoji: '😌', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    case 'Triste': return { label: 'Triste', emoji: '😢', bg: 'bg-amber-50 text-amber-700 border-amber-100' };
    case 'Llorando': return { label: 'Llorando', emoji: '😭', bg: 'bg-red-50 text-red-700 border-red-100' };
    case 'Enojado': return { label: 'Enojado', emoji: '😠', bg: 'bg-red-50 text-red-700 border-red-100' };
    default: return { label: 'Feliz', emoji: '😊', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  }
}

export default function ConditionsReport() {
  const [filter, setFilter] = useState<DateFilter>('today');
  const [serviceTimeFilter, setServiceTimeFilter] = useState<'all' | '8:00 AM' | '11:00 AM'>('all');
  const [records, setRecords] = useState<AttendanceWithChild[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('attendance')
        .select('*, child:children(*)');

      if (filter === 'today') {
        query = query.eq('event_date', todayStr());
      } else if (filter === 'week') {
        query = query.gte('event_date', dateDaysAgo(7));
      } else if (filter === 'month') {
        query = query.gte('event_date', startOfMonthStr());
      }

      const { data, error } = await query.order('checked_in_at', { ascending: false });
      if (error) throw error;
      setRecords((data as unknown as AttendanceWithChild[]) ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleDeleteAlertRecord = async (attendanceId: string, childName: string) => {
    if (!confirm(`¿Deseas eliminar el registro de asistencia de "${childName}"?\nSe borrará de la base de datos y se actualizarán las estadísticas.`)) {
      return;
    }
    setDeletingId(attendanceId);
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', attendanceId);
      if (error) throw error;
      setRecords(prev => prev.filter(r => r.id !== attendanceId));
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el registro de asistencia.');
    } finally {
      setDeletingId(null);
    }
  };

  // Filter records by service time if selected
  const displayedRecords = records.filter(r => {
    if (serviceTimeFilter === 'all') return true;
    return (r.service_time || '8:00 AM') === serviceTimeFilter;
  });

  // Compute stats based on displayed records
  const totalCheckIns = displayedRecords.length;

  // Alerts: sick, crying, injured, or has manual notes
  const alertRecords = displayedRecords.filter(r => {
    const isSick = r.physical_condition === 'Enfermo';
    const isInjured = r.physical_condition === 'Lesión';
    const isCrying = r.emotional_condition === 'Llorando';
    const isAngry = r.emotional_condition === 'Enojado';
    const hasNotes = !!r.notes.trim();
    return isSick || isInjured || isCrying || isAngry || hasNotes;
  });

  const filteredAlerts = alertRecords.filter(r => 
    r.child?.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Distribution counters
  const physStats = { Sano: 0, Lesión: 0, Enfermo: 0, Cansado: 0, Otro: 0 };
  const emotStats = { Feliz: 0, Calmado: 0, Triste: 0, Llorando: 0, Enojado: 0 };
  const catStats: Record<string, number> = {};

  categories.forEach(c => {
    catStats[c.id] = 0;
  });
  let unassignedCatCount = 0;

  displayedRecords.forEach(r => {
    const pc = (r.physical_condition || 'Sano') as keyof typeof physStats;
    if (physStats[pc] !== undefined) physStats[pc]++;
    else physStats.Sano++;

    const ec = (r.emotional_condition || 'Feliz') as keyof typeof emotStats;
    if (emotStats[ec] !== undefined) emotStats[ec]++;
    else emotStats.Feliz++;

    const c = getChildCategory(r.child, categories);
    if (c && catStats[c.id] !== undefined) {
      catStats[c.id]++;
    } else {
      unassignedCatCount++;
    }
  });

  const handleExportExcel = () => {
    if (displayedRecords.length === 0) {
      alert('No hay registros para exportar en este período u horario.');
      return;
    }
    setExporting(true);
    try {
      const dateLabel = filter === 'today' ? `Hoy_${todayStr()}` : filter === 'week' ? 'Ultimos_7_Dias' : filter === 'month' ? 'Mes_Actual' : 'Historico_Completo';
      const serviceLabel = serviceTimeFilter === 'all' ? '' : serviceTimeFilter === '8:00 AM' ? '_8a10' : '_11a1';
      const fullLabel = `${dateLabel}${serviceLabel}`;
      exportAttendanceToExcel(displayedRecords, categories, {
        dateLabel: fullLabel,
        filenamePrefix: `Reporte_Condiciones_${fullLabel}`,
      });
    } catch (err) {
      console.error(err);
      alert('Error al exportar el archivo Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shadow-sm">
            <BarChart3 size={20} className="text-violet-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-base">Informe de Condiciones</h2>
            <p className="text-xs text-gray-500">Salud, emociones, categorías y alertas de ingreso</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Service hour filter */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl gap-1">
            <span className="text-[11px] font-semibold text-gray-500 pl-2 pr-0.5 flex items-center gap-1">
              <Clock size={12} /> Horario:
            </span>
            <button
              onClick={() => setServiceTimeFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                serviceTimeFilter === 'all'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Todos ({records.length})
            </button>
            {SERVICE_HOURS.map(h => {
              const count = records.filter(r => (r.service_time || '8:00 AM') === h.id).length;
              return (
                <button
                  key={h.id}
                  onClick={() => setServiceTimeFilter(h.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    serviceTimeFilter === h.id
                      ? 'bg-white text-sky-700 shadow-sm font-bold'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {h.shortLabel} ({count})
                </button>
              );
            })}
          </div>

          {/* Date range filter */}
          <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
            {[
              { id: 'today', label: 'Hoy' },
              { id: 'week', label: '7 días' },
              { id: 'month', label: 'Mes' },
              { id: 'all', label: 'Todos' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilter(opt.id as DateFilter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === opt.id
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportExcel}
            disabled={exporting || displayedRecords.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            title="Exportar registros filtrados a Excel"
          >
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 size={36} className="text-violet-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Metrics & Condition Breakdown */}
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-violet-600 mb-2">
                  <Baby size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ingresos</span>
                </div>
                <p className="text-3xl font-black text-gray-800 leading-none">{totalCheckIns}</p>
                <p className="text-[10px] text-gray-400 mt-2">Niños registrados en total</p>
              </div>

              <div className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${alertRecords.length > 0 ? 'border-amber-100 bg-amber-50/10' : 'border-gray-100'}`}>
                <div className="flex items-center gap-2 text-amber-600 mb-2">
                  <ShieldAlert size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Casos Especiales</span>
                </div>
                <p className="text-3xl font-black text-gray-800 leading-none">{alertRecords.length}</p>
                <p className="text-[10px] text-gray-400 mt-2">
                  {alertRecords.length > 0 ? 'Requieren seguimiento' : 'Sin alertas registradas'}
                </p>
              </div>
            </div>

            {/* Categories distribution card */}
            {categories.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
                  <FolderKanban size={16} className="text-sky-500" />
                  <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Asistencia por Categorías</h3>
                </div>
                <div className="space-y-3.5">
                  {categories.map(cat => {
                    const style = getCategoryBadgeStyle(cat.color);
                    const count = catStats[cat.id] || 0;
                    const percent = totalCheckIns > 0 ? Math.round((count / totalCheckIns) * 100) : 0;

                    return (
                      <div key={cat.id} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-gray-700">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
                            <span>{cat.name} ({cat.min_age}-{cat.max_age} años)</span>
                          </span>
                          <span className="text-gray-500">{count} ({percent}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${style.dot}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {unassignedCatCount > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-xs font-medium text-gray-500">
                        <span>Sin categoría asignada</span>
                        <span>{unassignedCatCount} ({totalCheckIns > 0 ? Math.round((unassignedCatCount / totalCheckIns) * 100) : 0}%)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Physical Conditions distribution card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
                <Heart size={16} className="text-red-500" />
                <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Estado Físico</h3>
              </div>
              <div className="space-y-3.5">
                {[
                  { id: 'Sano', label: 'Sano / Excelente', icon: '👍', count: physStats.Sano, color: 'bg-emerald-500' },
                  { id: 'Lesión', label: 'Golpes / Rasguños', icon: '🤕', count: physStats.Lesión, color: 'bg-amber-500' },
                  { id: 'Enfermo', label: 'Enfermo / Fiebre', icon: '🤒', count: physStats.Enfermo, color: 'bg-red-500' },
                  { id: 'Cansado', label: 'Cansado / Sueño', icon: '😴', count: physStats.Cansado, color: 'bg-blue-500' },
                  { id: 'Otro', label: 'Otros casos', icon: '✏️', count: physStats.Otro, color: 'bg-gray-400' },
                ].map(item => {
                  const percent = totalCheckIns > 0 ? Math.round((item.count / totalCheckIns) * 100) : 0;
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-gray-700">
                        <span className="flex items-center gap-1.5">
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                        <span className="text-gray-500">{item.count} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Emotional Conditions distribution card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-50 pb-3">
                <Heart size={16} className="text-indigo-500" />
                <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Estado Emocional</h3>
              </div>
              <div className="space-y-3.5">
                {[
                  { id: 'Feliz', label: 'Feliz / Alegre', icon: '😊', count: emotStats.Feliz, color: 'bg-emerald-500' },
                  { id: 'Calmado', label: 'Calmado / Tranquilo', icon: '😌', count: emotStats.Calmado, color: 'bg-teal-500' },
                  { id: 'Triste', label: 'Triste', icon: '😢', count: emotStats.Triste, color: 'bg-amber-500' },
                  { id: 'Llorando', label: 'Llorando / Asustado', icon: '😭', count: emotStats.Llorando, color: 'bg-red-500' },
                  { id: 'Enojado', label: 'Enojado', icon: '😠', count: emotStats.Enojado, color: 'bg-red-600' },
                ].map(item => {
                  const percent = totalCheckIns > 0 ? Math.round((item.count / totalCheckIns) * 100) : 0;
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-gray-700">
                        <span className="flex items-center gap-1.5">
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </span>
                        <span className="text-gray-500">{item.count} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Alerts & Observations Feed */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col h-[calc(100%-0px)] min-h-[500px]">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-500" />
                  <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Bitácora de Casos Especiales</h3>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                  {alertRecords.length}
                </span>
              </div>

              {/* Alert Search */}
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar niño alertado..."
                  className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                />
              </div>

              {/* Feed List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[600px] scrollbar-thin">
                {alertRecords.length === 0 ? (
                  <div className="text-center py-20">
                    <Heart size={36} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Todos los niños ingresaron en condiciones saludables y felices.</p>
                  </div>
                ) : filteredAlerts.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-xs text-gray-400">No se encontraron alertas para "{searchQuery}"</p>
                  </div>
                ) : (
                  filteredAlerts.map(rec => {
                    const phys = getPhysBadge(rec.physical_condition);
                    const emot = getEmotBadge(rec.emotional_condition);
                    const cat = getChildCategory(rec.child, categories);
                    const catStyle = cat ? getCategoryBadgeStyle(cat.color) : null;

                    return (
                      <div
                        key={rec.id}
                        className="p-4 rounded-xl border border-amber-100 bg-amber-50/10 hover:bg-amber-50/30 transition-colors space-y-3"
                      >
                        {/* Kid Info Header */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                              {rec.child?.photo_url ? (
                                <img src={rec.child.photo_url} alt={rec.child?.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Baby size={16} className="text-gray-300" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-gray-800 text-xs truncate">{rec.child?.full_name ?? 'Desconocido'}</h4>
                                {cat && catStyle && (
                                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                                    {cat.name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mt-0.5">
                                {rec.child?.birthdate && <span>{formatAge(rec.child.birthdate)} ·</span>}
                                <Calendar size={10} />
                                <span>{formatDate(rec.event_date)}</span>
                                <Clock size={10} className="ml-1" />
                                <span>{new Date(rec.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="ml-1 px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 font-bold text-[9px] border border-sky-100">
                                  {rec.service_time === '11:00 AM' ? '11 a 1' : '8 a 10'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAlertRecord(rec.id, rec.child?.full_name || 'este niño')}
                            disabled={deletingId === rec.id}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                            title="Eliminar este registro de asistencia"
                          >
                            {deletingId === rec.id ? (
                              <Loader2 size={13} className="animate-spin text-red-500" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5">
                          {phys && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border ${phys.bg}`}>
                              <span>{phys.emoji}</span>
                              <span>{phys.label}</span>
                            </span>
                          )}
                          {emot && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold border ${emot.bg}`}>
                              <span>{emot.emoji}</span>
                              <span>{emot.label}</span>
                            </span>
                          )}
                        </div>

                        {/* Note/Observation */}
                        {rec.notes.trim() ? (
                          <div className="bg-white border border-gray-100 p-2.5 rounded-lg text-xs text-gray-600 break-words font-medium">
                            <span className="text-[10px] text-gray-400 block font-semibold mb-1 uppercase tracking-wider">Observación</span>
                            {rec.notes}
                          </div>
                        ) : (
                          <div className="text-[11px] text-gray-400 italic">Sin observaciones escritas.</div>
                        )}

                        {/* Parents Call Info */}
                        {rec.child && (rec.child.parent1_name || rec.child.parent2_name) && (
                          <div className="pt-2 border-t border-gray-100/50 flex flex-col gap-1 text-[10px]">
                            <span className="font-semibold text-gray-400 uppercase tracking-wider">Contactar Tutores</span>
                            {rec.child.parent1_name && (
                              <div className="flex items-center justify-between text-gray-700 bg-white border border-gray-100 px-2.5 py-1.5 rounded-lg">
                                <span className="truncate font-semibold">{rec.child.parent1_name} (Principal)</span>
                                {rec.child.parent1_phone && (
                                  <a
                                    href={`tel:${rec.child.parent1_phone}`}
                                    className="flex items-center gap-1 text-violet-600 hover:text-violet-800 font-bold ml-2"
                                  >
                                    <Phone size={10} />
                                    <span>{rec.child.parent1_phone}</span>
                                  </a>
                                )}
                              </div>
                            )}
                            {rec.child.parent2_name && (
                              <div className="flex items-center justify-between text-gray-700 bg-white border border-gray-100 px-2.5 py-1.5 rounded-lg">
                                <span className="truncate font-semibold">{rec.child.parent2_name}</span>
                                {rec.child.parent2_phone && (
                                  <a
                                    href={`tel:${rec.child.parent2_phone}`}
                                    className="flex items-center gap-1 text-violet-600 hover:text-violet-800 font-bold ml-2"
                                  >
                                    <Phone size={10} />
                                    <span>{rec.child.parent2_phone}</span>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
