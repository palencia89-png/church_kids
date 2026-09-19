import { supabase, type Category, type Child } from './supabase';

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'default-cat-a',
    name: 'Categoría A',
    min_age: 1,
    max_age: 3,
    color: 'sky',
    description: 'Cunas y primeros pasos (1 a 3 años)',
  },
  {
    id: 'default-cat-b',
    name: 'Categoría B',
    min_age: 4,
    max_age: 6,
    color: 'amber',
    description: 'Párvulos e inicial (4 a 6 años)',
  },
  {
    id: 'default-cat-c',
    name: 'Categoría C',
    min_age: 7,
    max_age: 10,
    color: 'emerald',
    description: 'Primarios (7 a 10 años)',
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

export function calculateAge(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const birth = new Date(birthdate + 'T12:00:00');
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
}

export function formatAge(birthdate: string | null): string {
  const age = calculateAge(birthdate);
  if (age === null) return 'Edad no especificada';
  return `${age} año${age !== 1 ? 's' : ''}`;
}

export function findCategoryForAge(age: number | null, categories: Category[]): Category | undefined {
  if (age === null || !categories || categories.length === 0) return undefined;
  
  // Sort categories by min_age ascending
  const sorted = [...categories].sort((a, b) => a.min_age - b.min_age);

  // Exact range match first
  const exact = sorted.find(c => age >= c.min_age && age <= c.max_age);
  if (exact) return exact;

  // If younger than the lowest min_age (e.g. toddlers/babies ages 0, 1, 2), match lowest category
  if (age < sorted[0].min_age) {
    return sorted[0];
  }

  // If older than the highest max_age (e.g. teens 14+), match highest category
  if (age > sorted[sorted.length - 1].max_age) {
    return sorted[sorted.length - 1];
  }

  return undefined;
}

export function getChildCategory(child: Child | null | undefined, categories: Category[]): Category | undefined {
  if (!child || !categories || categories.length === 0) return undefined;

  // 1. If child has a birthdate, prioritize their actual age for categorization
  const age = calculateAge(child.birthdate);
  if (age !== null) {
    const matchedByAge = findCategoryForAge(age, categories);
    if (matchedByAge) return matchedByAge;
  }

  // 2. If no birthdate is recorded, use explicitly assigned category_id
  if (child.category_id) {
    const matched = categories.find(c => c.id === child.category_id);
    if (matched) return matched;
  }

  return undefined;
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
