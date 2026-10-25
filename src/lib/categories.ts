import { supabase, type Category, type Child } from './supabase';

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'default-cat-a',
    name: 'Categoría A',
    min_age: 0,
    max_age: 6,
    color: 'sky',
    description: 'Cunas, párvulos e inicial (0 a 6 años)',
  },
  {
    id: 'default-cat-b',
    name: 'Categoría B',
    min_age: 7,
    max_age: 10,
    color: 'amber',
    description: 'Primarios e intermedios (7 a 10 años)',
  },
  {
    id: 'default-cat-c',
    name: 'Categoría C',
    min_age: 11,
    max_age: 15,
    color: 'emerald',
    description: 'Pre-adolescentes y mayores (11 a 15 años)',
  },
];

export const CATEGORY_COLORS = [
  { id: 'sky', label: 'Celeste', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  { id: 'amber', label: 'Ámbar', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  { id: 'emerald', label: 'Verde', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { id: 'purple', label: 'Púrpura', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  { id: 'rose', label: 'Rosa', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  { id: 'indigo', label: 'Índigo', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  { id: 'teal', label: 'Turquesa', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
  { id: 'orange', label: 'Naranja', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
];

export function getCategoryBadgeStyle(colorName?: string) {
  const found = CATEGORY_COLORS.find(c => c.id === colorName);
  if (found) return found;
  return { id: 'sky', label: 'Celeste', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' };
}

export function calculateAge(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  const clean = String(birthdate).trim();
  if (!clean) return null;

  let y: number | null = null;
  let m: number | null = null;
  let d: number | null = null;

  // 1. Check YYYY-MM-DD
  const ymd = clean.split('T')[0].match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymd) {
    y = parseInt(ymd[1], 10);
    m = parseInt(ymd[2], 10) - 1;
    d = parseInt(ymd[3], 10);
  } else {
    // 2. Check DD/MM/YYYY or DD-MM-YYYY
    const dmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) {
      d = parseInt(dmy[1], 10);
      m = parseInt(dmy[2], 10) - 1;
      y = parseInt(dmy[3], 10);
    } else {
      const parsed = new Date(clean.includes('T') ? clean : `${clean}T12:00:00`);
      if (!isNaN(parsed.getTime())) {
        y = parsed.getFullYear();
        m = parsed.getMonth();
        d = parsed.getDate();
      }
    }
  }

  if (y === null || m === null || d === null || isNaN(y) || isNaN(m) || isNaN(d)) return null;

  const today = new Date();
  let age = today.getFullYear() - y;
  const monthDiff = today.getMonth() - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) {
    age--;
  }
  return age >= 0 ? age : 0;
}

export function formatAge(birthdate: string | null | undefined): string {
  const age = calculateAge(birthdate);
  if (age === null) return 'Edad no especificada';
  if (age === 0) return 'Menor de 1 año';
  return `${age} año${age !== 1 ? 's' : ''}`;
}

export function findCategoryForAge(age: number | null, categories: Category[]): Category | undefined {
  if (age === null || !categories || categories.length === 0) return undefined;
  
  // Sort categories by min_age ascending
  const sorted = [...categories].sort((a, b) => a.min_age - b.min_age);

  // Exact range match first
  const exact = sorted.find(c => age >= c.min_age && age <= c.max_age);
  if (exact) return exact;

  // If younger than the lowest min_age (e.g. toddlers 0-2), match lowest category
  if (age < sorted[0].min_age) {
    return sorted[0];
  }

  // If older than the highest max_age (e.g. teens 14+), match highest category
  if (age > sorted[sorted.length - 1].max_age) {
    return sorted[sorted.length - 1];
  }

  // If in a gap between categories, match closest lower category
  const lower = [...sorted].reverse().find(c => c.min_age <= age);
  if (lower) return lower;

  return sorted[0];
}

export function getChildCategory(child: Child | null | undefined, categories: Category[]): Category | undefined {
  if (!child || !categories || categories.length === 0) return undefined;

  // 1. If child has an assigned category_id that exists in categories, respect it
  if (child.category_id) {
    const matched = categories.find(c => c.id === child.category_id);
    if (matched) return matched;
  }

  // 2. If no valid category_id is assigned, deduce from birthdate
  const age = calculateAge(child.birthdate);
  if (age !== null) {
    const matchedByAge = findCategoryForAge(age, categories);
    if (matchedByAge) return matchedByAge;
  }

  return undefined;
}

export function isChildCategoryOutOfSync(child: Child, categories: Category[]): boolean {
  if (!child.birthdate || !categories || categories.length === 0) return false;
  const age = calculateAge(child.birthdate);
  if (age === null) return false;
  const expectedCat = findCategoryForAge(age, categories);
  if (!expectedCat) return false;
  return child.category_id !== expectedCat.id;
}

const LOCAL_STORAGE_KEY = 'church_kids_categories_cache';

export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('min_age', { ascending: true });

    if (!error && data && data.length > 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      return data as Category[];
    }
  } catch (err) {
    console.warn('Supabase categories fetch error, fallback to local storage:', err);
  }

  // Fallback to localStorage or default categories
  const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore JSON parse error
    }
  }

  // Initialize with default categories
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_CATEGORIES));
  return DEFAULT_CATEGORIES;
}

export async function saveCategory(category: Partial<Category> & { name: string; min_age: number; max_age: number }): Promise<Category> {
  const isUpdate = !!category.id && !category.id.startsWith('default-');
  const payload = {
    name: category.name.trim(),
    min_age: Number(category.min_age),
    max_age: Number(category.max_age),
    color: category.color || 'sky',
    description: category.description?.trim() || '',
  };

  try {
    if (isUpdate) {
      const { data, error } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', category.id)
        .select()
        .single();
      if (!error && data) {
        await refreshLocalCache();
        return data as Category;
      }
    } else {
      const { data, error } = await supabase
        .from('categories')
        .insert(payload)
        .select()
        .single();
      if (!error && data) {
        await refreshLocalCache();
        return data as Category;
      }
    }
  } catch (err) {
    console.warn('Supabase error saving category, persisting locally:', err);
  }

  // Local storage fallback
  const current = await fetchCategories();
  const id = category.id || `local-${Date.now()}`;
  const saved: Category = {
    id,
    ...payload,
  };

  let updatedList: Category[];
  if (current.some(c => c.id === id)) {
    updatedList = current.map(c => (c.id === id ? saved : c));
  } else {
    updatedList = [...current, saved];
  }
  updatedList.sort((a, b) => a.min_age - b.min_age);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedList));
  return saved;
}

export async function deleteCategory(id: string): Promise<boolean> {
  try {
    if (!id.startsWith('default-') && !id.startsWith('local-')) {
      await supabase.from('categories').delete().eq('id', id);
    }
  } catch (err) {
    console.warn('Supabase error deleting category:', err);
  }

  const current = await fetchCategories();
  const filtered = current.filter(c => c.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  return true;
}

async function refreshLocalCache() {
  try {
    const { data } = await supabase.from('categories').select('*').order('min_age');
    if (data) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore
  }
}

export async function autoAssignCategories(children: Child[], categories: Category[]): Promise<number> {
  const toUpdate: Array<{ id: string; category_id: string }> = [];

  for (const child of children) {
    const age = calculateAge(child.birthdate);
    if (age !== null) {
      const cat = findCategoryForAge(age, categories);
      if (cat && cat.id !== child.category_id) {
        toUpdate.push({ id: child.id, category_id: cat.id });
      }
    }
  }

  let updatedCount = 0;
  const CHUNK_SIZE = 15;
  for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
    const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async item => {
        try {
          const { error } = await supabase
            .from('children')
            .update({ category_id: item.category_id })
            .eq('id', item.id);
          if (!error) updatedCount++;
        } catch (err) {
          console.error(`Error auto-assigning category to child ${item.id}:`, err);
        }
      })
    );
  }

  return updatedCount;
}

export const WRONGLY_ASSIGNED_OLDER_KIDS = new Set([
  'abraham hernandez', 'adrian torres eljach', 'andrea ospino', 'andres felipe',
  'ciel dorian', 'dafne tapias', 'dalet tapias', 'eimy lara', 'eliandris gonzales',
  'helen esquea', 'isabella carmona', 'isabella correa', 'josue', 'juan escorcia',
  'lucas torres', 'mauricio hoyos', 'mia alvarez', 'nicolle valencia', 'rafael hoyos',
  'ricardo cortez', 'santiago tarazona', 'sara vega quintero', 'shaira garcia',
  'thiago ortiz', 'virginia zabalas', 'keylor catalan', 'jordan cervantes',
  'gabriel prieto', 'zoe castano', 'daniela ospino'
]);

function normalizeChildName(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

let hasHealed = false;
export async function healCategoryDataOnce(categories: Category[]) {
  if (hasHealed || !categories || categories.length === 0) return;
  hasHealed = true;

  try {
    const catA = categories.find(c => c.name === 'Categoría A');
    const catC = categories.find(c => c.name === 'Categoría C');

    // 1. Expand category ranges if they were restrictive
    if (catA && catA.min_age > 0) {
      await supabase.from('categories').update({ min_age: 0, description: 'Cunas, párvulos e inicial (0 a 6 años)' }).eq('id', catA.id);
      catA.min_age = 0;
    }
    if (catC && catC.max_age < 15) {
      await supabase.from('categories').update({ max_age: 15, description: 'Pre-adolescentes y mayores (11 a 15 años)' }).eq('id', catC.id);
      catC.max_age = 15;
    }

    // 2. Fix the 30 older children that were imported into Cat A instead of Cat C
    if (catA && catC) {
      const { data: kids } = await supabase.from('children').select('id, full_name, category_id, birthdate').eq('category_id', catA.id);
      if (kids && kids.length > 0) {
        for (const kid of kids) {
          const norm = normalizeChildName(kid.full_name);
          if (WRONGLY_ASSIGNED_OLDER_KIDS.has(norm)) {
            await supabase.from('children').update({ category_id: catC.id }).eq('id', kid.id);
          }
          if (norm === 'litzy niebles' && kid.birthdate === '2003-12-28') {
            await supabase.from('children').update({ birthdate: '2023-12-28', category_id: catA.id }).eq('id', kid.id);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Silent heal error:', e);
  }
}
