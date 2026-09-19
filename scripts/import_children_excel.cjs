/**
 * Script de importación de niños desde ASISTENCIA ADORACION CHILDREN.xlsx hacia Supabase.
 * Ejecutar con: node scripts/import_children_excel.cjs
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// Credenciales de Supabase
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://blpvgrcfadgqxtajyiop.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6IKDyELARUZzGUFSNIcoDA_p0dqbL_Q';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const EXCEL_FILE = path.resolve(__dirname, '..', 'ASISTENCIA ADORACION CHILDREN.xlsx');

const months = {
  'enero': 1, 'ene': 1,
  'febrero': 2, 'feb': 2, 'frebrero': 2,
  'marzo': 3, 'mar': 3,
  'abril': 4, 'abr': 4,
  'mayo': 5, 'may': 5, 'may0': 5,
  'junio': 6, 'jun': 6,
  'julio': 7, 'jul': 7,
  'agosto': 8, 'ago': 8,
  'septiembre': 9, 'sep': 9, 'sept': 9, 'setiembre': 9,
  'octubre': 10, 'oct': 10,
  'noviembre': 11, 'nov': 11, 'enoviembre': 11,
  'diciembre': 12, 'dic': 12, 'dicienmbre': 12, 'diembre': 12
};

function titleCase(str) {
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

function cleanPhone(raw) {
  if (!raw) return [];
  const s = String(raw).trim();
  const parts = s.split(/[\/\,\;\s]+/).map(p => p.replace(/\D/g, '')).filter(p => p.length >= 7);
  return parts;
}

function parseDate(rawVal, age, sheetDefaultAge) {
  if (rawVal === undefined || rawVal === null || rawVal === '') return null;
  
  const effectiveAge = (age !== undefined && age !== null && !isNaN(Number(age)) && Number(age) > 0)
    ? Number(age)
    : sheetDefaultAge;

  if (typeof rawVal === 'number') {
    const str = String(rawVal);
    // Si tiene 10 dígitos y empieza por 3, suele ser un número telefónico colocado en la columna de fecha
    if (str.length === 10 && str.startsWith('3')) {
      return null;
    }
    const ddmmyyyy = str.match(/^(\d{1,2})(\d{2})(20\d{2})$/);
    if (ddmmyyyy) {
      const d = parseInt(ddmmyyyy[1], 10);
      const m = parseInt(ddmmyyyy[2], 10);
      const y = parseInt(ddmmyyyy[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    
    // Serial date de Excel
    if (rawVal > 30000 && rawVal < 60000) {
      const dateObj = XLSX.SSF.parse_date_code(rawVal);
      if (dateObj) {
        let y = dateObj.y;
        let m = dateObj.m;
        let d = dateObj.d;
        // Si el año es 2025/2026 y el niño tiene una edad registrada, corregir año restando la edad
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
    
    // Formato con barras o guiones
    const slashMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?[\/\-]?$/);
    if (slashMatch) {
      let d = parseInt(slashMatch[1], 10);
      let m = parseInt(slashMatch[2], 10);
      let y = slashMatch[3] ? parseInt(slashMatch[3], 10) : null;
      if (y && y < 100) y += 2000;
      if (y && y >= 2025 && effectiveAge && effectiveAge > 0) {
        y = 2026 - effectiveAge;
      }
      if (!y && effectiveAge && effectiveAge > 0) {
        y = 2026 - effectiveAge;
      }
      if (y && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
    
    s = s.replace(/\bd\s+e/g, 'de e');
    const textMatch = s.match(/(\d{1,2})\s*(?:de\s*)?([a-z0-9]+)(?:\s*(?:del?|de la)?\s*(\d{4}))?/);
    if (textMatch) {
      const d = parseInt(textMatch[1], 10);
      let mName = textMatch[2];
      let y = textMatch[3] ? parseInt(textMatch[3], 10) : null;
      const m = months[mName];
      if (m) {
        if (!y && effectiveAge && effectiveAge > 0) {
          y = 2026 - effectiveAge;
        }
        if (y && d >= 1 && d <= 31) {
          return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
      }
    }
  }
  return null;
}

function normalizeName(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function calculateAge(birthdate) {
  if (!birthdate) return null;
  const birth = new Date(birthdate + 'T12:00:00');
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : 0;
}

function findCategoryForAge(age, categories) {
  if (age === null || !categories || categories.length === 0) return undefined;
  const sorted = [...categories].sort((a, b) => a.min_age - b.min_age);
  const exact = sorted.find(c => age >= c.min_age && age <= c.max_age);
  if (exact) return exact;
  if (age < sorted[0].min_age) return sorted[0];
  if (age > sorted[sorted.length - 1].max_age) return sorted[sorted.length - 1];
  return undefined;
}

async function run() {
  console.log('🚀 Iniciando proceso de importación de niños a Supabase...');
  
  if (!fs.existsSync(EXCEL_FILE)) {
    console.error('❌ No se encontró el archivo:', EXCEL_FILE);
    process.exit(1);
  }

  // 1. Obtener categorías de la base de datos
  const { data: categories, error: catError } = await supabase.from('categories').select('*');
  if (catError || !categories || categories.length === 0) {
    console.error('❌ Error al obtener categorías de Supabase:', catError);
    process.exit(1);
  }
  console.log(`✅ Categorías cargadas desde Supabase: ${categories.length}`);
  const catA = categories.find(c => c.min_age === 3) || categories[0];
  const catB = categories.find(c => c.min_age === 7) || categories[1];
  const catC = categories.find(c => c.min_age === 11) || categories[2];

  const CATEGORY_MAP = {
    '3-6 AÑOS': { id: catA.id, name: catA.name, defaultAge: 4, order: 1 },
    '7-10 AÑOS': { id: catB.id, name: catB.name, defaultAge: 8, order: 2 },
    '11-13 AÑOS': { id: catC.id, name: catC.name, defaultAge: 12, order: 3 },
  };

  // 2. Obtener niños ya existentes en la BD
  const { data: existingChildren, error: exError } = await supabase.from('children').select('*');
  if (exError) {
    console.error('❌ Error al consultar niños existentes:', exError);
    process.exit(1);
  }
  console.log(`ℹ️ Niños actualmente en la BD: ${existingChildren ? existingChildren.length : 0}`);

  const existingMap = new Map();
  if (existingChildren) {
    for (const ec of existingChildren) {
      existingMap.set(normalizeName(ec.full_name), ec);
    }
  }

  // 3. Leer y parsear el Excel
  const wb = XLSX.readFile(EXCEL_FILE);
  const rawList = [];

  for (const sheetName of ['3-6 AÑOS', '7-10 AÑOS', '11-13 AÑOS']) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const catInfo = CATEGORY_MAP[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      if (row && row[0] && String(row[0]).trim()) {
        const originalName = String(row[0]).trim();
        const parentRaw = row[1] !== undefined ? String(row[1]).trim() : '';
        const phoneRaw = row[2] !== undefined ? String(row[2]).trim() : '';
        const birthRaw = row[3];
        const ageRaw = row[4];
        
        let phoneCandidates = cleanPhone(phoneRaw);
        if (typeof birthRaw === 'number' && String(birthRaw).length === 10 && String(birthRaw).startsWith('3')) {
          phoneCandidates = phoneCandidates.concat(cleanPhone(birthRaw));
        }
        
        const birthdate = parseDate(birthRaw, ageRaw, catInfo.defaultAge);

        let effectiveCat = catInfo;
        if (birthdate) {
          const calculated = calculateAge(birthdate);
          const ageCat = findCategoryForAge(calculated, categories);
          if (ageCat) {
            effectiveCat = {
              id: ageCat.id,
              name: ageCat.name,
              defaultAge: ageCat.min_age,
              order: ageCat.min_age
            };
          }
        }

        rawList.push({
          sheet: sheetName,
          catOrder: effectiveCat.order,
          category_id: effectiveCat.id,
          name: titleCase(originalName),
          normName: normalizeName(originalName),
          parent: titleCase(parentRaw),
          phones: phoneCandidates,
          birthdate: birthdate,
          age: ageRaw
        });
      }
    }
  }

  console.log(`📄 Filas procesadas del Excel: ${rawList.length}`);

  // 4. Agrupar y fusionar duplicados
  const grouped = new Map();
  for (const item of rawList) {
    if (!grouped.has(item.normName)) {
      grouped.set(item.normName, []);
    }
    grouped.get(item.normName).push(item);
  }

  const toInsert = [];
  const toUpdate = [];

  for (const [normName, items] of grouped.entries()) {
    items.sort((a, b) => b.catOrder - a.catOrder);
    const primary = items[0];
    
    let p1_name = primary.parent;
    let p1_phone = primary.phones[0] || '';
    let p2_name = '';
    let p2_phone = primary.phones[1] || '';
    let birthdate = primary.birthdate;
    
    for (let i = 1; i < items.length; i++) {
      const it = items[i];
      if (!birthdate && it.birthdate) {
        birthdate = it.birthdate;
      }
      if (it.parent && it.parent !== p1_name) {
        if (!p2_name) {
          p2_name = it.parent;
          if (!p2_phone && it.phones[0]) {
            p2_phone = it.phones[0];
          }
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

    // Verificar si ya existe en la base de datos
    const existing = existingMap.get(normName);
    if (existing) {
      toUpdate.push({
        id: existing.id,
        full_name: existing.full_name || primary.name,
        birthdate: existing.birthdate || birthdate,
        category_id: primary.category_id || existing.category_id,
        parent1_name: existing.parent1_name || p1_name,
        parent1_phone: existing.parent1_phone || p1_phone,
        parent2_name: existing.parent2_name || p2_name,
        parent2_phone: existing.parent2_phone || p2_phone,
        notes: existing.notes || notes,
      });
    } else {
      toInsert.push({
        full_name: primary.name,
        birthdate: birthdate,
        category_id: primary.category_id,
        parent1_name: p1_name,
        parent1_phone: p1_phone,
        parent2_name: p2_name,
        parent2_phone: p2_phone,
        notes: notes,
        photo_url: ''
      });
    }
  }

  console.log(`📊 Consolidación final:`);
  console.log(`   - Niños nuevos para insertar: ${toInsert.length}`);
  console.log(`   - Niños existentes para actualizar: ${toUpdate.length}`);

  // 5. Inserción en lotes (batch de 50)
  const BATCH_SIZE = 50;
  let insertedCount = 0;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('children').insert(batch).select('id');
    if (error) {
      console.error(`❌ Error al insertar lote ${i / BATCH_SIZE + 1}:`, error);
    } else {
      insertedCount += (data ? data.length : batch.length);
      process.stdout.write(`⏳ Progreso inserción: ${insertedCount}/${toInsert.length} niños...\r`);
    }
  }
  if (toInsert.length > 0) {
    console.log(`\n✅ Inserción completada: ${insertedCount} niños creados en Supabase.`);
  }

  // 6. Actualizar registros existentes en paralelo (chunks de 20)
  let updatedCount = 0;
  const CHUNK_SIZE = 20;
  for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
    await Promise.all(chunk.map(async upd => {
      const { id, ...fields } = upd;
      const { error } = await supabase.from('children').update(fields).eq('id', id);
      if (!error) updatedCount++;
    }));
    process.stdout.write(`⏳ Progreso actualización: ${updatedCount}/${toUpdate.length} niños...\r`);
  }
  if (updatedCount > 0) {
    console.log(`\n✅ Registros existentes actualizados: ${updatedCount}`);
  }

  // 7. Verificación final de conteo
  const { count: finalCount } = await supabase.from('children').select('*', { count: 'exact', head: true });
  console.log(`\n🎉 Total final de niños registrados en la base de datos: ${finalCount}`);
}

run().catch(err => {
  console.error('❌ Error inesperado:', err);
  process.exit(1);
});
