import { useState, useEffect } from 'react';
import { supabase, type Child, type Category } from '../lib/supabase';
import { fetchCategories, calculateAge, findCategoryForAge, getCategoryBadgeStyle } from '../lib/categories';
import PhotoCapture from './PhotoCapture';
import { UserPlus, X, Save, Loader2, FolderKanban, Sparkles } from 'lucide-react';

type Props = {
  onClose: () => void;
  onSaved: (child: Child) => void;
  editChild?: Child | null;
};

export default function RegisterChild({ onClose, onSaved, editChild }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoDetected, setAutoDetected] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: editChild?.full_name ?? '',
    birthdate: editChild?.birthdate ?? '',
    category_id: editChild?.category_id ?? '',
    parent1_name: editChild?.parent1_name ?? '',
    parent1_phone: editChild?.parent1_phone ?? '',
    parent2_name: editChild?.parent2_name ?? '',
    parent2_phone: editChild?.parent2_phone ?? '',
    notes: editChild?.notes ?? '',
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetchCategories().then(cats => {
      setCategories(cats);
      // If creating new child or editing child without category, try detecting by birthdate
      if (!editChild?.category_id && form.birthdate) {
        const age = calculateAge(form.birthdate);
        const match = findCategoryForAge(age, cats);
        if (match) {
          setForm(f => ({ ...f, category_id: match.id }));
          setAutoDetected(match.name);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBirthdateChange = (newBirthdate: string) => {
    set('birthdate', newBirthdate);
    if (!newBirthdate) {
      setAutoDetected(null);
      return;
    }
    const age = calculateAge(newBirthdate);
    const match = findCategoryForAge(age, categories);
    if (match) {
      setForm(f => ({ ...f, category_id: match.id }));
      setAutoDetected(`${match.name} (${age} año${age !== 1 ? 's' : ''})`);
    } else {
      setAutoDetected(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.parent1_name.trim()) return;
    setSaving(true);

    try {
      let photo_url = editChild?.photo_url ?? '';

      if (photoFile) {
        const ext = photoFile.name.split('.').pop();
        const path = `${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('children-photos')
          .upload(path, photoFile, { upsert: true });
        if (!uploadError) {
          const { data } = supabase.storage.from('children-photos').getPublicUrl(path);
          photo_url = data.publicUrl;
        }
      }

      const payload = {
        ...form,
        category_id: form.category_id || null,
        photo_url,
      };

      if (editChild) {
        const { data, error } = await supabase
          .from('children')
          .update(payload)
          .eq('id', editChild.id)
          .select()
          .single();
        if (error) {
          // In case category_id column doesn't exist yet on remote Supabase children table
          const fallbackPayload = { ...form, photo_url };
          delete (fallbackPayload as { category_id?: string | null }).category_id;
          const { data: retryData, error: retryError } = await supabase
            .from('children')
            .update(fallbackPayload)
            .eq('id', editChild.id)
            .select()
            .single();
          if (retryError) throw retryError;
          onSaved({ ...(retryData as Child), category_id: form.category_id });
          return;
        }
        onSaved(data as Child);
      } else {
        const { data, error } = await supabase
          .from('children')
          .insert(payload)
          .select()
          .single();
        if (error) {
          // Fallback if category_id column is not in remote children table yet
          const fallbackPayload = { ...form, photo_url };
          delete (fallbackPayload as { category_id?: string | null }).category_id;
          const { data: retryData, error: retryError } = await supabase
            .from('children')
            .insert(fallbackPayload)
            .select()
            .single();
          if (retryError) throw retryError;
          onSaved({ ...(retryData as Child), category_id: form.category_id });
          return;
        }
        onSaved(data as Child);
      }
    } catch (err) {
      console.error(err);
      alert('Error al guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCategory = categories.find(c => c.id === form.category_id);
  const badgeStyle = selectedCategory ? getCategoryBadgeStyle(selectedCategory.color) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center">
              <UserPlus size={18} className="text-sky-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">
              {editChild ? 'Editar niño' : 'Registrar niño'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex justify-center">
            <PhotoCapture
              onPhoto={setPhotoFile}
              currentPhotoUrl={editChild?.photo_url || undefined}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo del niño <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              placeholder="Juan Pablo Ramírez"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de nacimiento</label>
              <input
                type="date"
                value={form.birthdate}
                onChange={e => handleBirthdateChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Categoría</label>
                {autoDetected && (
                  <span className="text-[10px] text-sky-600 flex items-center gap-0.5 font-medium">
                    <Sparkles size={11} /> Auto-sugerida
                  </span>
                )}
              </div>
              <div className="relative">
                <select
                  value={form.category_id}
                  onChange={e => {
                    set('category_id', e.target.value);
                    setAutoDetected(null);
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent bg-white"
                >
                  <option value="">Seleccionar categoría...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.min_age} - {c.max_age} años)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Category Preview Tag */}
          {selectedCategory && badgeStyle && (
            <div className={`px-3 py-2 rounded-xl border flex items-center justify-between text-xs ${badgeStyle.bg} ${badgeStyle.border}`}>
              <div className="flex items-center gap-2">
                <FolderKanban size={14} className={badgeStyle.text} />
                <span className={`font-semibold ${badgeStyle.text}`}>{selectedCategory.name}</span>
                <span className="text-gray-500">({selectedCategory.min_age} a {selectedCategory.max_age} años)</span>
              </div>
              {selectedCategory.description && (
                <span className="text-[11px] text-gray-500 truncate max-w-[180px]">{selectedCategory.description}</span>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Padre / Madre / Tutor 1</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.parent1_name}
                  onChange={e => set('parent1_name', e.target.value)}
                  placeholder="María Ramírez"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={form.parent1_phone}
                  onChange={e => set('parent1_phone', e.target.value)}
                  placeholder="+1 555 0001"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Padre / Madre / Tutor 2 (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.parent2_name}
                  onChange={e => set('parent2_name', e.target.value)}
                  placeholder="Carlos Ramírez"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={form.parent2_phone}
                  onChange={e => set('parent2_phone', e.target.value)}
                  placeholder="+1 555 0002"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (alergias, necesidades especiales...)</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Sin restricciones conocidas..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 text-white rounded-lg font-medium hover:bg-sky-600 transition-colors text-sm disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
