import { useState, useEffect } from 'react';
import { supabase, type Category, type Child } from '../lib/supabase';
import {
  fetchCategories,
  saveCategory,
  deleteCategory,
  autoAssignCategories,
  getCategoryBadgeStyle,
  CATEGORY_COLORS,
  getChildCategory,
} from '../lib/categories';
import {
  FolderKanban,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
  Users,
  Sparkles,
  Info,
  Calendar,
} from 'lucide-react';

export default function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [minAge, setMinAge] = useState<number>(1);
  const [maxAge, setMaxAge] = useState<number>(3);
  const [color, setColor] = useState('sky');
  const [description, setDescription] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, { data: kids }] = await Promise.all([
        fetchCategories(),
        supabase.from('children').select('*'),
      ]);
      setCategories(cats);
      setChildren((kids as Child[]) ?? []);
    } catch (err) {
      console.error('Error loading categories data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName('');
    setMinAge(1);
    setMaxAge(3);
    setColor('sky');
    setDescription('');
    setModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setMinAge(cat.min_age);
    setMaxAge(cat.max_age);
    setColor(cat.color || 'sky');
    setDescription(cat.description || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (minAge > maxAge) {
      alert('La edad mínima no puede ser mayor que la edad máxima.');
      return;
    }

    setSaving(true);
    try {
      await saveCategory({
        id: editingCategory?.id,
        name,
        min_age: Number(minAge),
        max_age: Number(maxAge),
        color,
        description,
      });

      setModalOpen(false);
      await loadData();
      setActionNotice(editingCategory ? 'Categoría actualizada exitosamente' : 'Categoría creada exitosamente');
      setTimeout(() => setActionNotice(null), 3500);
    } catch (err) {
      console.error(err);
      alert('Error al guardar la categoría.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"? Los niños asociados conservarán su información.`)) return;
    setDeletingId(cat.id);
    try {
      await deleteCategory(cat.id);
      await loadData();
      setActionNotice(`Categoría "${cat.name}" eliminada`);
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Error al eliminar categoría.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAutoAssign = async () => {
    if (children.length === 0) {
      alert('No hay niños registrados para clasificar.');
      return;
    }
    setAutoAssigning(true);
    try {
      const updated = await autoAssignCategories(children, categories);
      await loadData();
      setActionNotice(`¡Listo! Se actualizaron ${updated} niños según sus edades.`);
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error al clasificar a los niños.');
    } finally {
      setAutoAssigning(false);
    }
  };

  // Count kids per category
  const getKidsCountForCategory = (cat: Category) => {
    return children.filter(child => getChildCategory(child, categories)?.id === cat.id).length;
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0 text-sky-600 shadow-sm">
              <FolderKanban size={22} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Categorías de Niños</h2>
              <p className="text-xs text-gray-500">Configura los grupos y rangos de edad según tus necesidades</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoAssign}
              disabled={autoAssigning || loading}
              className="flex items-center gap-1.5 px-3 py-2 border border-sky-200 text-sky-700 bg-sky-50/70 hover:bg-sky-100 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
              title="Asigna automáticamente la categoría a cada niño según su fecha de nacimiento"
            >
              {autoAssigning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>Auto-clasificar Niños</span>
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              <Plus size={16} />
              <span>Nueva Categoría</span>
            </button>
          </div>
        </div>

        {actionNotice && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2 animate-fadeIn">
            <Sparkles size={15} className="text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}
      </div>

      {/* Info notice */}
      <div className="bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100 p-4 rounded-2xl flex items-start gap-3">
        <Info size={18} className="text-sky-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-sky-900 space-y-1">
          <p className="font-semibold">¿Cómo funciona la categorización?</p>
          <p className="text-sky-800 leading-relaxed">
            Puedes registrar tantas categorías como utilices en tu iglesia (por ejemplo: Categoría A de 1 a 3 años, Categoría B de 4 a 6 años, o salas de Cunas, Párvulos, etc.). Al ingresar o editar la fecha de nacimiento de cada niño, el sistema le asignará su categoría de forma automática o podrás elegirla manualmente.
          </p>
        </div>
      </div>

      {/* Categories grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={36} className="text-sky-400 animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <FolderKanban size={48} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">No hay categorías configuradas</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Crea una para comenzar a clasificar a los estudiantes</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 text-white text-xs font-semibold rounded-xl hover:bg-sky-600 transition-colors"
          >
            <Plus size={15} />
            Crear primera categoría
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(cat => {
            const style = getCategoryBadgeStyle(cat.color);
            const count = getKidsCountForCategory(cat);
            return (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${style.dot}`} />
                      <h3 className="font-bold text-gray-900 text-sm">{cat.name}</h3>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${style.bg} ${style.text} ${style.border}`}>
                      {cat.min_age} a {cat.max_age} años
                    </span>
                  </div>

                  {cat.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">{cat.description}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-gray-600 font-medium">
                    <Users size={14} className="text-gray-400" />
                    <span>{count} niño{count !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(cat)}
                      className="p-1.5 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                      title="Editar categoría"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      disabled={deletingId === cat.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Eliminar categoría"
                    >
                      {deletingId === cat.id ? (
                        <Loader2 size={15} className="animate-spin text-red-500" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-sky-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
                  <FolderKanban size={16} />
                </div>
                <h3 className="font-bold text-gray-800 text-sm">
                  {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Nombre de la Categoría <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. Categoría A, Cunas, Párvulos..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Edad Mínima (años) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      required
                      min={0}
                      max={99}
                      value={minAge}
                      onChange={e => setMinAge(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Edad Máxima (años) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="number"
                      required
                      min={0}
                      max={99}
                      value={maxAge}
                      onChange={e => setMaxAge(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Color distintivo
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-all ${
                        color === c.id
                          ? `${c.bg} ${c.text} ${c.border} ring-2 ring-sky-400 shadow-sm font-bold`
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Descripción o Salón (opcional)
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Ej. Salón 102 - Niños de 1 a 3 años"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-sky-500 text-white rounded-xl font-semibold hover:bg-sky-600 transition-colors text-xs disabled:opacity-60 shadow-sm"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{editingCategory ? 'Actualizar' : 'Guardar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
