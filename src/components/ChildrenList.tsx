import { useState, useEffect } from 'react';
import { supabase, type Child, type Category } from '../lib/supabase';
import { fetchCategories, getChildCategory, getCategoryBadgeStyle, formatAge, autoAssignCategories } from '../lib/categories';
import { Search, UserPlus, Pencil, Trash2, Baby, Phone, Users, Loader2, FolderKanban, FileSpreadsheet, Sparkles, RefreshCw, CheckCircle2 } from 'lucide-react';
import ImportChildrenModal from './ImportChildrenModal';

type Props = {
  onRegister: () => void;
  onEdit: (child: Child) => void;
  refreshKey: number;
};

export default function ChildrenList({ onRegister, onEdit, refreshKey }: Props) {
  const [children, setChildren] = useState<Child[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase.from('children').select('*').order('full_name'),
      fetchCategories(),
    ]).then(([{ data: kids }, cats]) => {
      setChildren((kids as Child[]) ?? []);
      setCategories(cats);
      setLoading(false);
    });
  }, [refreshKey]);

  const filtered = children.filter(c => {
    const matchesQuery = !query.trim() || c.full_name.toLowerCase().includes(query.toLowerCase());
    if (!matchesQuery) return false;

    if (categoryFilter === 'all') return true;
    const cat = getChildCategory(c, categories);
    if (categoryFilter === 'none') return !cat;
    return cat?.id === categoryFilter;
  });

  const handleDelete = async (child: Child) => {
    if (!confirm(`¿Eliminar a ${child.full_name}? Esta acción no se puede deshacer.`)) return;
    setDeleting(child.id);
    await supabase.from('children').delete().eq('id', child.id);
    setChildren(prev => prev.filter(c => c.id !== child.id));
    setDeleting(null);
  };

  const outOfSyncChildren = children.filter(c => {
    const computed = getChildCategory(c, categories);
    return computed && c.category_id !== computed.id;
  });

  const handleSyncCategories = async () => {
    setSyncing(true);
    try {
      const updated = await autoAssignCategories(children, categories);
      const [{ data: kids }] = await Promise.all([
        supabase.from('children').select('*').order('full_name'),
      ]);
      setChildren((kids as Child[]) ?? []);
      setSyncNotice(`¡Se actualizaron ${updated} niños en la base de datos de acuerdo a su edad real!`);
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (e) {
      console.error('Error al sincronizar categorías:', e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top search and filter bar */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar niño por nombre..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
            title="Importar niños desde Excel"
          >
            <FileSpreadsheet size={16} />
            Importar Excel
          </button>
          <button
            onClick={onRegister}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 text-white rounded-xl text-sm font-medium hover:bg-sky-600 transition-colors shadow-sm whitespace-nowrap"
          >
            <UserPlus size={16} />
            Nuevo niño
          </button>
        </div>

        {/* Sync notice toast / banner */}
        {syncNotice && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs font-semibold animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{syncNotice}</span>
          </div>
        )}

        {/* Out-of-sync alert banner */}
        {outOfSyncChildren.length > 0 && !syncNotice && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Sparkles className="text-amber-600 flex-shrink-0" size={18} />
              <div>
                <p className="text-xs font-bold text-amber-900">
                  {outOfSyncChildren.length} niño{outOfSyncChildren.length !== 1 ? 's' : ''} con categoría desactualizada en la base de datos
                </p>
                <p className="text-[11px] text-amber-700">
                  En pantalla ya se muestran clasificados según su edad real. Puedes guardar la corrección directamente en la base de datos:
                </p>
              </div>
            </div>
            <button
              onClick={handleSyncCategories}
              disabled={syncing}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap self-end sm:self-center disabled:opacity-50"
            >
              {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {syncing ? 'Guardando...' : 'Ajustar en Base de Datos'}
            </button>
          </div>
        )}

        {/* Category Pills Filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                categoryFilter === 'all'
                  ? 'bg-gray-800 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Todas ({children.length})
            </button>
            {categories.map(cat => {
              const style = getCategoryBadgeStyle(cat.color);
              const count = children.filter(c => getChildCategory(c, categories)?.id === cat.id).length;
              const isSelected = categoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap border ${
                    isSelected
                      ? `${style.bg} ${style.text} ${style.border} ring-2 ring-sky-400 font-bold`
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
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
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 p-8">
          <Baby size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium text-sm">
            {query.trim() || categoryFilter !== 'all'
              ? 'No se encontraron niños con los filtros seleccionados'
              : 'No hay niños registrados aún'}
          </p>
          {!query.trim() && categoryFilter === 'all' && (
            <button
              onClick={onRegister}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-white rounded-xl text-xs font-semibold hover:bg-sky-600 transition-colors"
            >
              <UserPlus size={14} />
              Registrar el primer niño
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(child => {
            const cat = getChildCategory(child, categories);
            const style = cat ? getCategoryBadgeStyle(cat.color) : null;

            return (
              <div
                key={child.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start gap-3.5">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-inner">
                      {child.photo_url ? (
                        <img src={child.photo_url} alt={child.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Baby size={24} className="text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm truncate">{child.full_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{formatAge(child.birthdate)}</p>

                      {/* Category Badge */}
                      <div className="mt-1.5">
                        {cat && style ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.bg} ${style.text} ${style.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            <span>{cat.name}</span>
                            <span className="opacity-70">({cat.min_age}-{cat.max_age}a)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                            <FolderKanban size={10} /> Sin categoría
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Parents Info */}
                  <div className="mt-3 space-y-1 text-xs border-t border-gray-50 pt-2.5">
                    {child.parent1_name && (
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Users size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate">{child.parent1_name}</span>
                        {child.parent1_phone && (
                          <>
                            <Phone size={11} className="text-gray-400 flex-shrink-0 ml-1" />
                            <a href={`tel:${child.parent1_phone}`} className="text-sky-600 hover:underline">
                              {child.parent1_phone}
                            </a>
                          </>
                        )}
                      </div>
                    )}
                    {child.parent2_name && (
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Users size={12} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate">{child.parent2_name}</span>
                        {child.parent2_phone && (
                          <>
                            <Phone size={11} className="text-gray-400 flex-shrink-0 ml-1" />
                            <a href={`tel:${child.parent2_phone}`} className="text-sky-600 hover:underline">
                              {child.parent2_phone}
                            </a>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {child.notes && (
                    <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg truncate">
                      {child.notes}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                  <button
                    onClick={() => onEdit(child)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(child)}
                    disabled={deleting === child.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-500 font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deleting === child.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <p className="text-center text-xs text-gray-400">
          {filtered.length} niño{filtered.length !== 1 ? 's' : ''} mostrado{filtered.length !== 1 ? 's' : ''} de {children.length}
        </p>
      )}

      {showImportModal && (
        <ImportChildrenModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            setLoading(true);
            Promise.all([
              supabase.from('children').select('*').order('full_name'),
              fetchCategories(),
            ]).then(([{ data: kids }, cats]) => {
              setChildren((kids as Child[]) ?? []);
              setCategories(cats);
              setLoading(false);
            });
          }}
        />
      )}
    </div>
  );
}
