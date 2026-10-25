import { useState, useEffect } from 'react';
import { supabase, type Child, type Category, SERVICE_HOURS, getCurrentServiceTime, type ServiceTimeId } from '../lib/supabase';
import { fetchCategories, calculateAge, findCategoryForAge, getCategoryBadgeStyle } from '../lib/categories';
import { fetchEvents } from '../lib/events';
import PhotoCapture from './PhotoCapture';
import { UserPlus, X, Save, Loader2, FolderKanban, Sparkles, UserCheck, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

type Props = {
  onClose: () => void;
  onSaved: (child: Child, checkedIn?: boolean) => void;
  editChild?: Child | null;
  defaultAutoCheckIn?: boolean;
};

export default function RegisterChild({ onClose, onSaved, editChild, defaultAutoCheckIn = true }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoDetected, setAutoDetected] = useState<string | null>(null);

  // Auto check-in state (only for new child)
  const [autoCheckIn, setAutoCheckIn] = useState<boolean>(!editChild ? defaultAutoCheckIn : false);
  const [serviceTime, setServiceTime] = useState<ServiceTimeId>(getCurrentServiceTime());
  const [physicalCondition, setPhysicalCondition] = useState('Sano');
  const [emotionalCondition, setEmotionalCondition] = useState('Feliz');
  const [showCheckInDetails, setShowCheckInDetails] = useState(false);

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

  const performAutoCheckIn = async (childId: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      let activeEventId: string | null = null;
      try {
        const res = await fetchEvents();
        const active = res.events.find(e => e.event_date === today || e.status === 'in_progress');
        if (active) activeEventId = active.id;
      } catch {
        // ignore event error
      }

      const attendanceData: Record<string, unknown> = {
        child_id: childId,
        event_date: today,
        checked_in_at: new Date().toISOString(),
        service_time: serviceTime,
        physical_condition: physicalCondition,
        emotional_condition: emotionalCondition,
        notes: '',
      };
      if (activeEventId) {
        attendanceData.event_id = activeEventId;
      }

      const { error: attError } = await supabase.from('attendance').insert(attendanceData);
      return !attError;
    } catch (err) {
      console.error('Error registrando ingreso automático:', err);
      return false;
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

      const birthdateValue = form.birthdate && form.birthdate.trim() ? form.birthdate.trim() : null;

      const payload = {
        ...form,
        birthdate: birthdateValue,
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
          const fallbackPayload = { ...form, birthdate: birthdateValue, photo_url };
          delete (fallbackPayload as { category_id?: string | null }).category_id;
          const { data: retryData, error: retryError } = await supabase
            .from('children')
            .update(fallbackPayload)
            .eq('id', editChild.id)
            .select()
            .single();
          if (retryError) throw retryError;
          onSaved({ ...(retryData as Child), category_id: form.category_id }, false);
          return;
        }
        onSaved(data as Child, false);
      } else {
        const { data, error } = await supabase
          .from('children')
          .insert(payload)
          .select()
          .single();
        if (error) {
          // Fallback if category_id column is not in remote children table yet
          const fallbackPayload = { ...form, birthdate: birthdateValue, photo_url };
          delete (fallbackPayload as { category_id?: string | null }).category_id;
          const { data: retryData, error: retryError } = await supabase
            .from('children')
            .insert(fallbackPayload)
            .select()
            .single();
          if (retryError) throw retryError;
          const savedKid = { ...(retryData as Child), category_id: form.category_id };
          let wasChecked = false;
          if (autoCheckIn) {
            wasChecked = await performAutoCheckIn(savedKid.id);
          }
          onSaved(savedKid, wasChecked);
          return;
        }
        const savedKid = data as Child;
        let wasChecked = false;
        if (autoCheckIn) {
          wasChecked = await performAutoCheckIn(savedKid.id);
        }
        onSaved(savedKid, wasChecked);
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Fecha de nacimiento</label>
                <span className="text-[11px] text-gray-400 font-normal">Opcional</span>
              </div>
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

          {/* Ingreso / Check-in Automático (Solo para registro de niño nuevo) */}
          {!editChild && (
            <div className="p-3.5 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50/80 via-blue-50/50 to-indigo-50/40 space-y-2.5 transition-all shadow-sm">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none flex-1">
                  <input
                    type="checkbox"
                    checked={autoCheckIn}
                    onChange={e => setAutoCheckIn(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-gray-300"
                  />
                  <div>
                    <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <UserCheck size={14} className="text-sky-600" />
                      Hacer ingreso automático
                    </span>
                    <p className="text-[11px] text-gray-500">
                      Registra la asistencia del niño inmediatamente al guardar
                    </p>
                  </div>
                </label>
                {autoCheckIn && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-xs flex items-center gap-1">
                    <CheckCircle2 size={10} /> Ingreso activo
                  </span>
                )}
              </div>

              {autoCheckIn && (
                <div className="pt-2 border-t border-sky-200/60 space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-gray-700">Turno de culto:</span>
                      <select
                        value={serviceTime}
                        onChange={e => setServiceTime(e.target.value as ServiceTimeId)}
                        className="px-2 py-1 rounded-lg border border-sky-200 text-xs bg-white font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-sky-400"
                      >
                        {SERVICE_HOURS.map(h => (
                          <option key={h.id} value={h.id}>{h.label}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCheckInDetails(v => !v)}
                      className="text-[11px] text-sky-600 hover:text-sky-700 font-semibold flex items-center gap-0.5"
                    >
                      <span>{showCheckInDetails ? 'Menos detalles' : 'Más opciones (estado)'}</span>
                      {showCheckInDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>

                  {showCheckInDetails && (
                    <div className="grid grid-cols-2 gap-2 pt-1.5 text-xs animate-in fade-in duration-200">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-700 mb-0.5">Estado Físico</label>
                        <select
                          value={physicalCondition}
                          onChange={e => setPhysicalCondition(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                        >
                          <option value="Sano">Sano</option>
                          <option value="Fiebre">Fiebre</option>
                          <option value="Tos/Gripa">Tos / Gripa</option>
                          <option value="Alergia">Alergia</option>
                          <option value="Dolor de estómago">Dolor de estómago</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-700 mb-0.5">Estado Emocional</label>
                        <select
                          value={emotionalCondition}
                          onChange={e => setEmotionalCondition(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"
                        >
                          <option value="Feliz">Feliz</option>
                          <option value="Tranquilo">Tranquilo</option>
                          <option value="Llorando">Llorando</option>
                          <option value="Tímido">Tímido</option>
                          <option value="Inquieto">Inquieto</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-500 text-white rounded-lg font-medium hover:bg-sky-600 transition-colors text-sm disabled:opacity-60 shadow-sm"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving
                ? 'Guardando...'
                : (!editChild && autoCheckIn ? 'Guardar e Ingresar' : 'Guardar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
