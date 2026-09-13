import { useState, useEffect } from 'react';
import { supabase, type Attendance, type Child, type Category } from '../lib/supabase';
import { fetchCategories, getChildCategory, getCategoryBadgeStyle, formatAge } from '../lib/categories';
import { exportAttendanceToExcel } from '../lib/excelExport';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Baby,
  Loader2,
  ClipboardList,
  MessageSquare,
  FileSpreadsheet,
  Download,
  X,
  Sparkles,
} from 'lucide-react';

type AttendanceWithChild = Attendance & { child: Child };

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function getPhysBadge(cond?: string) {
  switch (cond) {
    case 'Sano': return { label: 'Sano', emoji: '👍', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    case 'Lesión': return { label: 'Golpes/Rasguños', emoji: '🤕', bg: 'bg-amber-50 text-amber-700 border-amber-100' };
    case 'Enfermo': return { label: 'Enfermo', emoji: '🤒', bg: 'bg-red-50 text-red-700 border-red-100' };
    case 'Cansado': return { label: 'Cansado', emoji: '😴', bg: 'bg-blue-50 text-blue-700 border-blue-100' };
    case 'Otro': return { label: 'Otro', emoji: '✏️', bg: 'bg-gray-50 text-gray-600 border-gray-200' };
    default: return null;
  }
}

function getEmotBadge(cond?: string) {
  switch (cond) {
    case 'Feliz': return { label: 'Feliz', emoji: '😊', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    case 'Calmado': return { label: 'Calmado', emoji: '😌', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    case 'Triste': return { label: 'Triste', emoji: '😢', bg: 'bg-amber-50 text-amber-700 border-amber-100' };
    case 'Llorando': return { label: 'Llorando/Asustado', emoji: '😭', bg: 'bg-red-50 text-red-700 border-red-100' };
    case 'Enojado': return { label: 'Enojado', emoji: '😠', bg: 'bg-red-50 text-red-700 border-red-100' };
    default: return null;
  }
}

export default function AttendanceHistory() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [records, setRecords] = useState<AttendanceWithChild[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState<string[]>([]);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchCategories().then(setCategories);
    supabase
      .from('attendance')
      .select('event_date')
      .order('event_date', { ascending: false })
      .then(({ data }) => {
        const unique = [...new Set((data ?? []).map((r: { event_date: string }) => r.event_date))];
        setDates(unique);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('attendance')
      .select('*, child:children(*)')
      .eq('event_date', date)
      .order('checked_in_at')
      .then(({ data }) => {
        setRecords((data as unknown as AttendanceWithChild[]) ?? []);
        setLoading(false);
      });
  }, [date]);

  const shift = (days: number) => {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const filteredRecords = records.filter(r => {
    if (categoryFilter === 'all') return true;
    const cat = getChildCategory(r.child, categories);
    return cat?.id === categoryFilter;
  });

  const handleExportToday = () => {
    if (records.length === 0) {
      alert('No hay registros de asistencia para esta fecha.');
      return;
    }
    setExporting(true);
    try {
      exportAttendanceToExcel(records, categories, {
        dateLabel: date,
        filenamePrefix: `Asistencia_${date}`,
      });
      setExportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error al generar el archivo Excel.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportRange = async (range: '7days' | 'month' | 'all') => {
    setExporting(true);
    try {
      let query = supabase.from('attendance').select('*, child:children(*)');
      const now = new Date();
      let label = 'Historico_Completo';

      if (range === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const since = d.toISOString().split('T')[0];
        query = query.gte('event_date', since);
        label = `Ultimos_7_Dias_${today}`;
      } else if (range === 'month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        query = query.gte('event_date', firstDay);
        label = `Mes_${now.getFullYear()}_${now.getMonth() + 1}`;
      }

      const { data, error } = await query.order('event_date', { ascending: false }).order('checked_in_at', { ascending: true });
      if (error) throw error;

      const fetchedRecords = (data as unknown as AttendanceWithChild[]) ?? [];
      if (fetchedRecords.length === 0) {
        alert('No se encontraron registros de asistencia para el período seleccionado.');
        return;
      }

      exportAttendanceToExcel(fetchedRecords, categories, {
        dateLabel: label,
        filenamePrefix: `Reporte_Asistencia_${label}`,
      });
      setExportModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error al exportar los datos a Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Date selector and Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <ClipboardList size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-base">Historial de Asistencia</h2>
              <p className="text-xs text-gray-500">Consulta y descarga los reportes diarios y por período</p>
            </div>
          </div>

          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all whitespace-nowrap self-start sm:self-auto"
          >
            <FileSpreadsheet size={16} />
            <span>Exportar a Excel</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => shift(-1)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500"
            title="Día anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 relative">
            <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="date"
              value={date}
              max={today}
              onChange={e => setDate(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => shift(1)}
            disabled={date >= today}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500 disabled:opacity-30"
            title="Día siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {dates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {dates.slice(0, 8).map(d => (
              <button
                key={d}
                onClick={() => setDate(d)}
                className={`text-xs px-2.5 py-1 rounded-xl font-medium transition-colors ${
                  d === date
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Attendance List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-gray-800 capitalize text-sm">{formatDate(date)}</h3>
            {!loading && (
              <p className="text-xs text-gray-400 mt-0.5">
                {records.length} niño{records.length !== 1 ? 's' : ''} en total
              </p>
            )}
          </div>

          {/* Category Filter */}
          {categories.length > 0 && records.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  categoryFilter === 'all'
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Todas ({records.length})
              </button>
              {categories.map(cat => {
                const style = getCategoryBadgeStyle(cat.color);
                const count = records.filter(r => getChildCategory(r.child, categories)?.id === cat.id).length;
                if (count === 0) return null;
                const isSelected = categoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all border ${
                      isSelected
                        ? `${style.bg} ${style.text} ${style.border} font-bold ring-1 ring-amber-400`
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className="text-[10px] opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="text-gray-300 animate-spin" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-10">
            <Baby size={44} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {records.length === 0 ? 'Sin registros para este día' : 'No hay niños en esta categoría para la fecha seleccionada'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((r, i) => {
              const phys = getPhysBadge(r.physical_condition);
              const emot = getEmotBadge(r.emotional_condition);
              const cat = getChildCategory(r.child, categories);
              const catStyle = cat ? getCategoryBadgeStyle(cat.color) : null;

              return (
                <div
                  key={r.id}
                  className="p-4 rounded-2xl border border-gray-100 bg-white hover:border-amber-200 hover:bg-amber-50/10 transition-all space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-300 font-mono w-5 text-right flex-shrink-0">{i + 1}</span>
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-inner">
                      {r.child?.photo_url ? (
                        <img src={r.child.photo_url} alt={r.child.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Baby size={18} className="text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800 text-sm truncate">{r.child?.full_name ?? 'Desconocido'}</p>
                        {cat && catStyle && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                            <span>{cat.name}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {formatAge(r.child?.birthdate)} · Tutor: {r.child?.parent1_name} {r.child?.parent1_phone && `(${r.child.parent1_phone})`}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 font-mono">
                      {formatTime(r.checked_in_at)}
                    </span>
                  </div>

                  {/* Conditions & Notes Row */}
                  <div className="pl-8 flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {phys && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${phys.bg}`}>
                          <span>{phys.emoji}</span>
                          <span>{phys.label}</span>
                        </span>
                      )}
                      {emot && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${emot.bg}`}>
                          <span>{emot.emoji}</span>
                          <span>{emot.label}</span>
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 p-2.5 rounded-xl flex items-start gap-2 max-w-full">
                        <MessageSquare size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="break-words">{r.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Exportación a Excel */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-emerald-50/60">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <FileSpreadsheet size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">Exportar Reporte a Excel</h3>
                  <p className="text-[11px] text-gray-500">Descarga un archivo .xlsx estructurado y completo</p>
                </div>
              </div>
              <button
                onClick={() => setExportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-emerald-50/40 border border-emerald-100 p-3 rounded-xl flex items-start gap-2 text-xs text-emerald-900">
                <Sparkles size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>
                  El archivo incluirá 2 hojas: <strong>Asistencia Detallada</strong> (con categoría, edad, datos de tutores, condición física/emocional y observaciones) y <strong>Resumen Estadístico</strong>.
                </span>
              </div>

              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Selecciona el período:</p>

                <button
                  onClick={handleExportToday}
                  disabled={exporting || records.length === 0}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/20 text-left transition-all group disabled:opacity-50"
                >
                  <div>
                    <p className="font-bold text-gray-800 text-xs group-hover:text-emerald-700">
                      Asistencia del día ({date})
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {records.length} niño{records.length !== 1 ? 's' : ''} registrado{records.length !== 1 ? 's' : ''} hoy
                    </p>
                  </div>
                  <Download size={16} className="text-gray-400 group-hover:text-emerald-600" />
                </button>

                <button
                  onClick={() => handleExportRange('7days')}
                  disabled={exporting}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/20 text-left transition-all group"
                >
                  <div>
                    <p className="font-bold text-gray-800 text-xs group-hover:text-emerald-700">
                      Últimos 7 días
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Historial de la última semana completa</p>
                  </div>
                  <Download size={16} className="text-gray-400 group-hover:text-emerald-600" />
                </button>

                <button
                  onClick={() => handleExportRange('month')}
                  disabled={exporting}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/20 text-left transition-all group"
                >
                  <div>
                    <p className="font-bold text-gray-800 text-xs group-hover:text-emerald-700">
                      Mes en curso
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Todos los registros del mes actual</p>
                  </div>
                  <Download size={16} className="text-gray-400 group-hover:text-emerald-600" />
                </button>

                <button
                  onClick={() => handleExportRange('all')}
                  disabled={exporting}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl border border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/20 text-left transition-all group"
                >
                  <div>
                    <p className="font-bold text-gray-800 text-xs group-hover:text-emerald-700">
                      Todo el historial registrado
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Exportación completa desde el primer registro</p>
                  </div>
                  <Download size={16} className="text-gray-400 group-hover:text-emerald-600" />
                </button>
              </div>

              {exporting && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-emerald-700 font-medium">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Generando archivo Excel...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
