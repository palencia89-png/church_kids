import { useState, useEffect } from 'react';
import type { ChurchEvent, Category } from '../lib/supabase';
import { EVENT_COLORS } from '../lib/events';
import { X, Calendar, Clock, MapPin, Loader2, Save, Users } from 'lucide-react';

type Props = {
  isOpen: boolean;
  eventToEdit: ChurchEvent | null;
  categories: Category[];
  onClose: () => void;
  onSave: (data: Partial<ChurchEvent> & { title: string; event_date: string }) => Promise<void>;
};

function getNextSunday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (7 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

const EVENT_TEMPLATES = [
  'Culto de Alabanza Infantil',
  'Escuela Bíblica de Vacaciones (EBV)',
  'Tarde de Talentos y Juegos',
  'Vigilia Infantil',
  'Campamento de Niños',
  'Día del Niño Especial',
];

const COMMON_LOCATIONS = [
  'Salón Principal',
  'Salón Cunas (1-3 años)',
  'Salón Párvulos (4-6 años)',
  'Salón Primarios (7-10 años)',
  'Área de Juegos / Canchas',
];

export default function EventModal({ isOpen, eventToEdit, categories, onClose, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(getToday());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:30');
  const [location, setLocation] = useState('Salón Principal');
  const [categoryId, setCategoryId] = useState<string>('');
  const [status, setStatus] = useState<ChurchEvent['status']>('upcoming');
  const [color, setColor] = useState('sky');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventToEdit) {
      setTitle(eventToEdit.title);
      setDescription(eventToEdit.description || '');
      setEventDate(eventToEdit.event_date);
      setStartTime(eventToEdit.start_time || '09:00');
      setEndTime(eventToEdit.end_time || '');
      setLocation(eventToEdit.location || 'Salón Principal');
      setCategoryId(eventToEdit.category_id || '');
      setStatus(eventToEdit.status || 'upcoming');
      setColor(eventToEdit.color || 'sky');
    } else {
      setTitle('');
      setDescription('');
      setEventDate(getToday());
      setStartTime('09:00');
      setEndTime('11:30');
      setLocation('Salón Principal');
      setCategoryId('');
      setStatus('upcoming');
      setColor('sky');
    }
    setError(null);
  }, [eventToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Por favor escribe un título para el evento.');
      return;
    }
    if (!eventDate) {
      setError('Por favor selecciona la fecha del evento.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: eventToEdit?.id,
        title: title.trim(),
        description: description.trim(),
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        location: location.trim(),
        category_id: categoryId ? categoryId : null,
        status,
        color,
      });
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido al guardar';
      setError(message || 'Error al guardar el evento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-sky-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">
                {eventToEdit ? 'Editar Evento' : 'Crear Nuevo Evento'}
              </h3>
              <p className="text-[11px] text-gray-500">
                Programa un culto, actividad o reunión especial para los niños
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Título del Evento *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej. Culto Infantil Dominical"
              required
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent font-medium"
            />
            {/* Template shortcuts */}
            <div className="mt-2 flex flex-wrap gap-1">
              {EVENT_TEMPLATES.map(tmpl => (
                <button
                  key={tmpl}
                  type="button"
                  onClick={() => setTitle(tmpl)}
                  className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-sky-50 hover:text-sky-700 text-gray-600 transition-colors"
                >
                  + {tmpl}
                </button>
              ))}
            </div>
          </div>

          {/* Date with quick shortcuts */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Fecha del Evento *
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setEventDate(getToday())}
                  className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all ${
                    eventDate === getToday()
                      ? 'bg-sky-500 text-white border-sky-500 font-bold'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => setEventDate(getTomorrow())}
                  className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all ${
                    eventDate === getTomorrow()
                      ? 'bg-sky-500 text-white border-sky-500 font-bold'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Mañana
                </button>
                <button
                  type="button"
                  onClick={() => setEventDate(getNextSunday())}
                  className={`text-[11px] px-2 py-0.5 rounded-lg border transition-all ${
                    eventDate === getNextSunday()
                      ? 'bg-sky-500 text-white border-sky-500 font-bold'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Domingo
                </button>
              </div>
            </div>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                required
                className="w-full pl-9 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* Time: Start and End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Hora de Inicio
              </label>
              <div className="relative">
                <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Hora de Fin (Opcional)
              </label>
              <div className="relative">
                <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Lugar / Salón
            </label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Ej. Salón Principal"
                className="w-full pl-9 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
              />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {COMMON_LOCATIONS.map(loc => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Category & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Audiencia / Categoría
              </label>
              <div className="relative">
                <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent bg-white"
                >
                  <option value="">Todas las edades (General)</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.min_age}-{c.max_age} años)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Estado del Evento
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as ChurchEvent['status'])}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent bg-white font-medium"
              >
                <option value="upcoming">🗓️ Próximo</option>
                <option value="in_progress">🟢 En Curso / Hoy</option>
                <option value="completed">✅ Finalizado</option>
                <option value="cancelled">❌ Cancelado</option>
              </select>
            </div>
          </div>

          {/* Color selection */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Color Distintivo
            </label>
            <div className="flex items-center gap-2">
              {Object.entries(EVENT_COLORS).map(([cKey, cVal]) => (
                <button
                  key={cKey}
                  type="button"
                  onClick={() => setColor(cKey)}
                  className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${cVal.dot} ${
                    color === cKey ? 'scale-125 ring-2 ring-offset-2 ring-gray-400 shadow-sm' : 'opacity-70 hover:opacity-100'
                  }`}
                  title={cVal.label}
                />
              ))}
            </div>
          </div>

          {/* Description / Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Descripción u Observaciones (Opcional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Tema del día, versículo bíblico, materiales requeridos, etc."
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{eventToEdit ? 'Guardar Cambios' : 'Crear Evento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
