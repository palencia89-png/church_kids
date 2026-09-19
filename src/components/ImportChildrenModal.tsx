import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase, type Child } from '../lib/supabase';
import { fetchCategories, getCategoryBadgeStyle, calculateAge, findCategoryForAge } from '../lib/categories';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, X, RefreshCw, Users, ShieldCheck } from 'lucide-react';

type Props = {
  onClose: () => void;
  onSuccess: () => void;
};

interface ParsedChildPreview {
  full_name: string;
  birthdate: string | null;
  category_id: string;
  category_name: string;
  category_color?: string;
  parent1_name: string;
  parent1_phone: string;
  parent2_name: string;
  parent2_phone: string;
  notes: string;
  isExisting?: boolean;
}

const MONTHS: Record<string, number> = {
  enero: 1, ene: 1,
  febrero: 2, feb: 2, frebrero: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4,
  mayo: 5, may: 5, may0: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8,
  septiembre: 9, sep: 9, sept: 9, setiembre: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11, enoviembre: 11,
  diciembre: 12, dic: 12, dicienmbre: 12, diembre: 12
};

function titleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(word => {
      const lower = ['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'en', 'san'];
      if (lower.includes(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .replace(/^([a-z])/, m => m.toUpperCase());
}

function cleanPhone(raw: unknown): string[] {
  if (!raw) return [];
  const s = String(raw).trim();
  return s.split(/[\/\,\;\s]+/).map(p => p.replace(/\D/g, '')).filter(p => p.length >= 7);
}

function parseDate(rawVal: unknown, age: unknown, defaultAge: number): string | null {
  if (rawVal === undefined || rawVal === null || rawVal === '') return null;

  const effectiveAge = (age !== undefined && age !== null && !isNaN(Number(age)) && Number(age) > 0)
    ? Number(age)
    : defaultAge;

  if (typeof rawVal === 'number') {
    const str = String(rawVal);
    if (str.length === 10 && str.startsWith('3')) return null; // Phone mistakenly in date column

    const ddmmyyyy = str.match(/^(\d{1,2})(\d{2})(20\d{2})$/);
    if (ddmmyyyy) {
      const d = parseInt(ddmmyyyy[1], 10);
      const m = parseInt(ddmmyyyy[2], 10);
      const y = parseInt(ddmmyyyy[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    if (rawVal > 30000 && rawVal < 60000) {
      const dateObj = XLSX.SSF.parse_date_code(rawVal);
      if (dateObj) {
        let y = dateObj.y;
        const m = dateObj.m;
        const d = dateObj.d;
        if (y >= 2025 && effectiveAge && effectiveAge > 0) {
          y = 2026 - effectiveAge;
        }
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    return null;
  }

  if (typeof rawVal === 'string') {
    let s = rawVal.trim().toLowerCase();
    s = s.replace(/[\?\"\'\=]/g, '').trim();
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?[\/\-]?$/);
    if (slashMatch) {
      const d = parseInt(slashMatch[1], 10);
      const m = parseInt(slashMatch[2], 10);
      let y = slashMatch[3] ? parseInt(slashMatch[3], 10) : null;
      if (y && y < 100) y += 2000;
      if (y && y >= 2025 && effectiveAge && effectiveAge > 0) y = 2026 - effectiveAge;
      if (!y && effectiveAge && effectiveAge > 0) y = 2026 - effectiveAge;
      if (y && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }

    s = s.replace(/\bd\s+e/g, 'de e');
    const textMatch = s.match(/(\d{1,2})\s*(?:de\s*)?([a-z0-9]+)(?:\s*(?:del?|de la)?\s*(\d{4}))?/);
    if (textMatch) {
      const d = parseInt(textMatch[1], 10);
      const mName = textMatch[2];
      let y = textMatch[3] ? parseInt(textMatch[3], 10) : null;
      const m = MONTHS[mName];
      if (m) {
        if (!y && effectiveAge && effectiveAge > 0) y = 2026 - effectiveAge;
        if (y && d >= 1 && d <= 31) {
          return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
      }
    }
  }

  return null;
}

function normalizeName(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export default function ImportChildrenModal({ onClose, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [previewList, setPreviewList] = useState<ParsedChildPreview[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ inserted: number; updated: number } | null>(null);

  const processWorkbook = async (selectedFile: File) => {
    setParsing(true);
    setErrorMsg(null);
    setFile(selectedFile);

    try {
      const [categories, { data: existingChildren }] = await Promise.all([
        fetchCategories(),
        supabase.from('children').select('id, full_name'),
      ]);

      const catA = categories.find(c => c.min_age === 3) || categories[0];
      const catB = categories.find(c => c.min_age === 7) || categories[1];
      const catC = categories.find(c => c.min_age === 11) || categories[2];

      const catMap: Record<string, { id: string; name: string; color?: string; defaultAge: number; order: number }> = {
        '3-6 AÑOS': { id: catA?.id || '', name: catA?.name || 'Categoría A', color: catA?.color, defaultAge: 4, order: 1 },
        '7-10 AÑOS': { id: catB?.id || '', name: catB?.name || 'Categoría B', color: catB?.color, defaultAge: 8, order: 2 },
        '11-13 AÑOS': { id: catC?.id || '', name: catC?.name || 'Categoría C', color: catC?.color, defaultAge: 12, order: 3 },
      };

      const buffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      setSheetNames(wb.SheetNames);

      const existingNames = new Set((existingChildren || []).map((c: { full_name: string }) => normalizeName(c.full_name)));

      const rawItems: Array<{
        sheet: string;
        order: number;
        catId: string;
        catName: string;
        catColor?: string;
        name: string;
        normName: string;
        parent: string;
        phones: string[];
        birthdate: string | null;
      }> = [];

      for (const sName of wb.SheetNames) {
        // Skip duplicate copies
        if (sName.toLowerCase().includes('copia')) continue;

        let matchedCat = catMap[sName];
        if (!matchedCat) {
          // If sheet name has age numbers e.g. "3-6" or "7-10" or "11-13"
          if (sName.includes('3') || sName.includes('4') || sName.includes('5') || sName.includes('6')) {
            matchedCat = catMap['3-6 AÑOS'];
          } else if (sName.includes('7') || sName.includes('8') || sName.includes('9') || sName.includes('10')) {
            matchedCat = catMap['7-10 AÑOS'];
          } else {
            matchedCat = catMap['11-13 AÑOS'] || catMap['3-6 AÑOS'];
          }
        }

        const ws = wb.Sheets[sName];
        if (!ws) continue;
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || !row[0] || !String(row[0]).trim()) continue;

          const rawName = String(row[0]).trim();
          const rawParent = row[1] !== undefined ? String(row[1]).trim() : '';
          const rawPhone = row[2] !== undefined ? String(row[2]).trim() : '';
          const rawBirth = row[3];
          const rawAge = row[4];

          let phones = cleanPhone(rawPhone);
          if (typeof rawBirth === 'number' && String(rawBirth).length === 10 && String(rawBirth).startsWith('3')) {
            phones = phones.concat(cleanPhone(rawBirth));
          }

          const birthdate = parseDate(rawBirth, rawAge, matchedCat.defaultAge);

          // If child has birthdate, categorize by actual age; otherwise use sheet category
          let effectiveCat = matchedCat;
          if (birthdate) {
            const calculated = calculateAge(birthdate);
            const ageCat = findCategoryForAge(calculated, categories);
            if (ageCat) {
              effectiveCat = {
                id: ageCat.id,
                name: ageCat.name,
                color: ageCat.color,
                defaultAge: ageCat.min_age,
                order: ageCat.min_age
              };
            }
          }

          rawItems.push({
            sheet: sName,
            order: effectiveCat.order,
            catId: effectiveCat.id,
            catName: effectiveCat.name,
            catColor: effectiveCat.color,
            name: titleCase(rawName),
            normName: normalizeName(rawName),
            parent: titleCase(rawParent),
            phones,
            birthdate
          });
        }
      }

      // Group and consolidate duplicates
      const grouped = new Map<string, typeof rawItems>();
      for (const item of rawItems) {
        if (!grouped.has(item.normName)) {
          grouped.set(item.normName, []);
        }
        grouped.get(item.normName)!.push(item);
      }

      const consolidated: ParsedChildPreview[] = [];
      for (const [normName, items] of grouped.entries()) {
        items.sort((a, b) => b.order - a.order);
        const primary = items[0];

        let p1_name = primary.parent;
        let p1_phone = primary.phones[0] || '';
        let p2_name = '';
        let p2_phone = primary.phones[1] || '';
        let birthdate = primary.birthdate;

        for (let i = 1; i < items.length; i++) {
          const it = items[i];
          if (!birthdate && it.birthdate) birthdate = it.birthdate;
          if (it.parent && it.parent !== p1_name) {
            if (!p2_name) {
              p2_name = it.parent;
              if (!p2_phone && it.phones[0]) p2_phone = it.phones[0];
            }
          }
          for (const ph of it.phones) {
            if (ph !== p1_phone && ph !== p2_phone) {
              if (!p1_phone) p1_phone = ph;
              else if (!p2_phone) p2_phone = ph;
            }
          }
        }

        let notes = '';
        if (p1_name.toLowerCase().includes('pastora') || p1_name.toLowerCase().includes('llamar')) {
          notes = p1_name;
          p1_name = '';
        }

        consolidated.push({
          full_name: primary.name,
          birthdate,
          category_id: primary.catId,
          category_name: primary.catName,
          category_color: primary.catColor,
          parent1_name: p1_name,
          parent1_phone: p1_phone,
          parent2_name: p2_name,
          parent2_phone: p2_phone,
          notes,
          isExisting: existingNames.has(normName)
        });
      }

      setPreviewList(consolidated);
    } catch (err: unknown) {
      console.error('Error al procesar archivo Excel:', err);
      setErrorMsg((err as Error).message || 'No se pudo leer el archivo Excel.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processWorkbook(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processWorkbook(e.target.files[0]);
    }
  };

  const handleStartImport = async () => {
    if (previewList.length === 0) return;
    setImporting(true);
    setProgress(0);
    setErrorMsg(null);

    try {
      // 1. Fetch latest children to match exact IDs for updating
      setStatusMessage('Consultando registros existentes...');
      const { data: dbChildren } = await supabase.from('children').select('*');
      const dbMap = new Map<string, Child>();
      if (dbChildren) {
        for (const c of dbChildren) {
          dbMap.set(normalizeName(c.full_name), c);
        }
      }

      const toInsert: Array<Omit<ParsedChildPreview, 'category_name' | 'category_color' | 'isExisting'>> = [];
      const toUpdate: Array<{ id: string; fields: Partial<Child> }> = [];

      for (const item of previewList) {
        const norm = normalizeName(item.full_name);
        const existing = dbMap.get(norm);
        if (existing) {
          toUpdate.push({
            id: existing.id,
            fields: {
              full_name: existing.full_name || item.full_name,
              birthdate: existing.birthdate || item.birthdate,
              category_id: item.category_id || existing.category_id,
              parent1_name: existing.parent1_name || item.parent1_name,
              parent1_phone: existing.parent1_phone || item.parent1_phone,
              parent2_name: existing.parent2_name || item.parent2_name,
              parent2_phone: existing.parent2_phone || item.parent2_phone,
              notes: existing.notes || item.notes,
            }
          });
        } else {
          toInsert.push({
            full_name: item.full_name,
            birthdate: item.birthdate,
            category_id: item.category_id,
            parent1_name: item.parent1_name,
            parent1_phone: item.parent1_phone,
            parent2_name: item.parent2_name,
            parent2_phone: item.parent2_phone,
            notes: item.notes,
          });
        }
      }

      let insertedTotal = 0;
      let updatedTotal = 0;
      const totalOps = toInsert.length + toUpdate.length;

      // Batch insert
      const BATCH_SIZE = 50;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        setStatusMessage(`Insertando niños nuevos (${Math.min(i + BATCH_SIZE, toInsert.length)}/${toInsert.length})...`);
        const { error } = await supabase.from('children').insert(batch);
        if (error) throw error;
        insertedTotal += batch.length;
        setProgress(Math.round((insertedTotal / totalOps) * 100));
      }

      // Batch update in chunks of 10 concurrent requests
      const CHUNK_SIZE = 10;
      for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
        const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
        setStatusMessage(`Actualizando datos existentes (${Math.min(i + CHUNK_SIZE, toUpdate.length)}/${toUpdate.length})...`);
        await Promise.all(chunk.map(upd => supabase.from('children').update(upd.fields).eq('id', upd.id)));
        updatedTotal += chunk.length;
        setProgress(Math.round(((insertedTotal + updatedTotal) / totalOps) * 100));
      }

      setSuccessResult({ inserted: insertedTotal, updated: updatedTotal });
      onSuccess();
    } catch (err: unknown) {
      console.error('Error durante la importación:', err);
      setErrorMsg((err as Error).message || 'Ocurrió un error al guardar en la base de datos.');
    } finally {
      setImporting(false);
    }
  };

  const newCount = previewList.filter(p => !p.isExisting).length;
  const existingCount = previewList.filter(p => p.isExisting).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-sky-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-sm">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Importar Niños desde Excel</h2>
              <p className="text-xs text-gray-500">Carga masiva, deduplicación y asignación de categorías</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 text-sm">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="font-semibold">Error al procesar</p>
                <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {successResult ? (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">¡Importación Exitosa!</h3>
              <p className="text-sm text-gray-600 max-w-md mx-auto">
                Se registraron <strong className="text-emerald-600">{successResult.inserted} nuevos niños</strong> y se actualizaron <strong className="text-sky-600">{successResult.updated} niños existentes</strong> en la base de datos.
              </p>
              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-sky-500 text-white font-medium rounded-xl hover:bg-sky-600 transition-all shadow-sm"
                >
                  Ver Lista de Niños
                </button>
              </div>
            </div>
          ) : previewList.length === 0 ? (
            /* File Dropzone */
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                parsing ? 'border-sky-400 bg-sky-50/50' : 'border-gray-200 hover:border-sky-400 hover:bg-sky-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-sm">
                {parsing ? <Loader2 size={32} className="animate-spin" /> : <UploadCloud size={32} />}
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 text-base">
                  {parsing ? 'Leyendo y analizando archivo...' : 'Arrastra tu archivo Excel aquí o haz clic para seleccionarlo'}
                </h4>
                <p className="text-xs text-gray-400 mt-1">Soporta formatos .xlsx y .xls (ej: ASISTENCIA ADORACION CHILDREN.xlsx)</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-sky-700 bg-sky-100/60 px-3 py-1.5 rounded-lg mt-2">
                <ShieldCheck size={14} />
                <span>Identifica automáticamente hojas por edades, acudientes y teléfonos</span>
              </div>
            </div>
          ) : (
            /* Preview & Confirmation */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="text-sky-600" size={24} />
                  <div>
                    <span className="font-semibold text-sm text-gray-800">{file?.name}</span>
                    <p className="text-xs text-gray-400">
                      Hojas: {sheetNames.join(', ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setPreviewList([]); setFile(null); }}
                  disabled={importing}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1 hover:underline"
                >
                  <RefreshCw size={13} />
                  Cambiar archivo
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl">
                  <div className="text-xl font-bold text-sky-700">{previewList.length}</div>
                  <div className="text-xs text-sky-600 font-medium">Niños Consolidados</div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="text-xl font-bold text-emerald-700">{newCount}</div>
                  <div className="text-xs text-emerald-600 font-medium">Nuevos para Registrar</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="text-xl font-bold text-amber-700">{existingCount}</div>
                  <div className="text-xs text-amber-600 font-medium">Ya en Base de Datos</div>
                </div>
              </div>

              {/* Progress bar during import */}
              {importing && (
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-sky-800">
                    <span>{statusMessage}</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-sky-200/60 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-sky-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Preview table snippet */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Muestra de Niños Identificados ({Math.min(10, previewList.length)} de {previewList.length})
                  </span>
                  <span className="text-xs text-gray-400">Verificando formatos y duplicados</span>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-gray-100 text-xs">
                  {previewList.slice(0, 15).map((child, idx) => {
                    const badge = getCategoryBadgeStyle(child.category_color);
                    return (
                      <div key={idx} className="p-2.5 hover:bg-gray-50 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="truncate">
                            <span className="font-semibold text-gray-900 block truncate">{child.full_name}</span>
                            <span className="text-[11px] text-gray-400 block truncate">
                              {child.parent1_name ? `Tutor: ${child.parent1_name}` : 'Sin tutor'}
                              {child.parent1_phone ? ` (${child.parent1_phone})` : ''}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`px-2 py-0.5 rounded-full font-medium text-[11px] border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {child.category_name}
                          </span>
                          {child.isExisting && (
                            <span className="px-2 py-0.5 rounded-full font-medium text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                              Existente
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!successResult && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {previewList.length > 0 && (
                <span>Se registrarán <strong>{previewList.length}</strong> niños con sus categorías y acudientes.</span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              {previewList.length > 0 && (
                <button
                  type="button"
                  onClick={handleStartImport}
                  disabled={importing}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600 active:bg-sky-700 rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Users size={16} />
                      Iniciar Importación ({previewList.length})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
