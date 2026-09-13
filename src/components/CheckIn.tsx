import { useState, useEffect, useCallback } from 'react';
import { supabase, type Child, type Attendance, type Category } from '../lib/supabase';
import { fetchCategories, getChildCategory, getCategoryBadgeStyle, formatAge } from '../lib/categories';
import { Search, CheckCircle2, Loader2, UserCheck, Baby, X, FolderKanban } from 'lucide-react';

type Props = {
  onCheckedIn?: () => void;
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function TodayList({ ids, categories }: { ids: string[]; categories: Category[] }) {
  const [children, setChildren] = useState<Child[]>([]);

  useEffect(() => {
    if (ids.length === 0) { setChildren([]); return; }
    supabase
      .from('children')
      .select('*')
      .in('id', ids)
      .order('full_name')
      .then(({ data }) => setChildren((data as Child[]) ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {children.map(c => {
        const cat = getChildCategory(c, categories);
        const style = cat ? getCategoryBadgeStyle(cat.color) : null;
        return (
          <div key={c.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-gray-50 border border-gray-100">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
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
              {cat && style ? (
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${style.bg} ${style.text} inline-block`}>
                  {cat.name}
                </span>
              ) : (
                <span className="text-[10px] text-gray-400">{formatAge(c.birthdate)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CheckIn({ onCheckedIn }: Props) {
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
  const [children, setChildren] = useState<Child[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [justChecked, setJustChecked] = useState<string | null>(null);

  // Modal states
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [physCondition, setPhysCondition] = useState('Sano');
  const [emotCondition, setEmotCondition] = useState('Feliz');
  const [obs, setObs] = useState('');

  const loadTodayAttendance = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('event_date', todayStr());
    setTodayAttendance((data as Attendance[]) ?? []);
  }, []);

  useEffect(() => {
    loadTodayAttendance();
    fetchCategories().then(setCategories);
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

  const checkedInIds = new Set(todayAttendance.map(a => a.child_id));

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
      await supabase.from('attendance').insert({
        child_id: selectedChild.id,
        event_date: todayStr(),
        checked_in_at: new Date().toISOString(),
        physical_condition: physCondition,
        emotional_condition: emotCondition,
        notes: obs,
      });
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

  const selectedChildCat = selectedChild ? getChildCategory(selectedChild, categories) : null;
  const selectedChildCatStyle = selectedChildCat ? getCategoryBadgeStyle(selectedChildCat.color) : null;

  return (
    <div className="space-y-6">
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
                  <button
                    onClick={() => {
                      setPhysCondition('Sano');
                      setEmotCondition('Feliz');
                      setObs('');
                      setSelectedChild(child);
                    }}
                    disabled={alreadyIn || isCheckingIn}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                      alreadyIn
                        ? 'bg-emerald-100 text-emerald-700 cursor-default'
                        : isCheckingIn
                        ? 'bg-gray-100 text-gray-400 cursor-wait'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                    }`}
                  >
                    {isCheckingIn ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    {alreadyIn ? 'Ya ingresó' : isCheckingIn ? 'Registrando...' : 'Registrar'}
                  </button>
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
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Asistencia de hoy</h3>
          <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded-full">
            {todayAttendance.length} niño{todayAttendance.length !== 1 ? 's' : ''}
          </span>
        </div>
        {todayAttendance.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Aún no hay registros hoy</p>
        ) : (
          <TodayList ids={Array.from(checkedInIds)} categories={categories} />
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
