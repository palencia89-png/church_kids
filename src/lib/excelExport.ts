import * as XLSX from 'xlsx';
import type { Attendance, Child, Category } from './supabase';
import { formatAge, getChildCategory } from './categories';

export type AttendanceRecordForExport = Attendance & {
  child?: Child;
  category?: Category;
};

export function exportAttendanceToExcel(
  records: AttendanceRecordForExport[],
  categories: Category[],
  options?: {
    dateLabel?: string;
    filenamePrefix?: string;
  }
) {
  const dateLabel = options?.dateLabel || new Date().toISOString().split('T')[0];
  const filenamePrefix = options?.filenamePrefix || 'Reporte_Asistencia';

  // 1. Prepare Sheet 1: Asistencia Detallada
  const rows = records.map((rec, index) => {
    const child = rec.child || (rec as unknown as { children?: Child }).children;
    const cat = rec.category || getChildCategory(child, categories);
    const checkInTime = rec.checked_in_at
      ? new Date(rec.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : '';
    const serviceLabel = rec.service_time === '11:00 AM' ? '11:00 AM - 1:00 PM' : '8:00 AM - 10:00 AM';

    return {
      'N°': index + 1,
      'Fecha': rec.event_date || '',
      'Culto / Horario': serviceLabel,
      'Hora Ingreso': checkInTime,
      'Nombre del Niño': child?.full_name || 'Desconocido',
      'Categoría': cat ? `${cat.name} (${cat.min_age}-${cat.max_age} años)` : 'Sin categoría',
      'Edad': child?.birthdate ? formatAge(child.birthdate) : 'No especificada',
      'Fecha Nacimiento': child?.birthdate || '',
      'Estado Físico': rec.physical_condition || 'Sano',
      'Estado Emocional': rec.emotional_condition || 'Feliz',
      'Tutor Principal': child?.parent1_name || '',
      'Teléfono Tutor 1': child?.parent1_phone || '',
      'Segundo Tutor': child?.parent2_name || '',
      'Teléfono Tutor 2': child?.parent2_phone || '',
      'Observaciones': rec.notes || child?.notes || '',
    };
  });

  const detailWorksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths for readability
  detailWorksheet['!cols'] = [
    { wch: 6 },   // N°
    { wch: 12 },  // Fecha
    { wch: 22 },  // Culto / Horario
    { wch: 14 },  // Hora Ingreso
    { wch: 28 },  // Nombre del Niño
    { wch: 24 },  // Categoría
    { wch: 14 },  // Edad
    { wch: 16 },  // Fecha Nacimiento
    { wch: 18 },  // Estado Físico
    { wch: 18 },  // Estado Emocional
    { wch: 24 },  // Tutor Principal
    { wch: 18 },  // Teléfono Tutor 1
    { wch: 24 },  // Segundo Tutor
    { wch: 18 },  // Teléfono Tutor 2
    { wch: 35 },  // Observaciones
  ];

  // 2. Prepare Sheet 2: Resumen Estadístico
  const total = records.length;

  // Category distribution
  const categoryCounts: Record<string, number> = {};
  categories.forEach(c => {
    categoryCounts[c.name] = 0;
  });
  categoryCounts['Sin Categoría'] = 0;

  records.forEach(rec => {
    const child = rec.child || (rec as unknown as { children?: Child }).children;
    const cat = rec.category || getChildCategory(child, categories);
    const catName = cat?.name || 'Sin Categoría';
    categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
  });

  // Physical stats
  const physStats: Record<string, number> = {};
  records.forEach(rec => {
    const p = rec.physical_condition || 'Sano';
    physStats[p] = (physStats[p] || 0) + 1;
  });

  // Emotional stats
  const emotStats: Record<string, number> = {};
  records.forEach(rec => {
    const e = rec.emotional_condition || 'Feliz';
    emotStats[e] = (emotStats[e] || 0) + 1;
  });

  // Service hour breakdown stats
  const serviceStats = {
    '8:00 AM - 10:00 AM': 0,
    '11:00 AM - 1:00 PM': 0,
  };
  records.forEach(rec => {
    if (rec.service_time === '11:00 AM') {
      serviceStats['11:00 AM - 1:00 PM']++;
    } else {
      serviceStats['8:00 AM - 10:00 AM']++;
    }
  });

  const summaryData: (string | number)[][] = [
    ['RESUMEN DE ASISTENCIA - MINISTERIO DE NIÑOS'],
    ['Período / Fecha:', dateLabel],
    ['Total de Asistencias:', total],
    [],
    ['DESGLOSE POR HORARIO DE CULTO'],
    ['Culto Dominical', 'Cantidad de Niños', 'Porcentaje'],
  ];

  Object.entries(serviceStats).forEach(([svc, count]) => {
    const pct = total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%';
    summaryData.push([svc, count, pct]);
  });

  summaryData.push([]);
  summaryData.push(['DESGLOSE POR CATEGORÍA']);
  summaryData.push(['Categoría', 'Rango de Edad', 'Cantidad de Niños', 'Porcentaje']);

  categories.forEach(c => {
    const count = categoryCounts[c.name] || 0;
    const pct = total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%';
    summaryData.push([c.name, `${c.min_age} a ${c.max_age} años`, count, pct]);
  });

  if (categoryCounts['Sin Categoría'] > 0) {
    const count = categoryCounts['Sin Categoría'];
    const pct = total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%';
    summaryData.push(['Sin Categoría / Otra', 'N/A', count, pct]);
  }

  summaryData.push([]);
  summaryData.push(['DESGLOSE POR ESTADO FÍSICO']);
  summaryData.push(['Condición Física', 'Cantidad', 'Porcentaje']);
  Object.entries(physStats).forEach(([cond, count]) => {
    const pct = total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%';
    summaryData.push([cond, count, pct]);
  });

  summaryData.push([]);
  summaryData.push(['DESGLOSE POR ESTADO EMOCIONAL']);
  summaryData.push(['Condición Emocional', 'Cantidad', 'Porcentaje']);
  Object.entries(emotStats).forEach(([cond, count]) => {
    const pct = total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%';
    summaryData.push([cond, count, pct]);
  });

  const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWorksheet['!cols'] = [
    { wch: 28 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
  ];

  // 3. Create Workbook and Append Sheets
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, detailWorksheet, 'Asistencia Detallada');
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Resumen Estadístico');

  // 4. Download file
  const cleanDate = dateLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${filenamePrefix}_${cleanDate}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export function exportSingleEventAttendanceToExcel(
  event: {
    title: string;
    event_date: string;
    start_time?: string;
    end_time?: string;
    location?: string;
    category?: Category | null;
  },
  records: AttendanceRecordForExport[],
  categories: Category[]
) {
  const eventDateStr = event.event_date || new Date().toISOString().split('T')[0];
  const timeStr = event.start_time
    ? `${event.start_time}${event.end_time ? ' - ' + event.end_time : ''}`
    : 'No especificado';
  const locationStr = event.location || 'Salón Principal';
  const targetCategoryStr = event.category ? event.category.name : 'Todas las edades';

  // 1. Detailed sheet
  const rows = records.map((rec, index) => {
    const child = rec.child || (rec as unknown as { children?: Child }).children;
    const cat = rec.category || getChildCategory(child, categories);
    const checkInTime = rec.checked_in_at
      ? new Date(rec.checked_in_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : '';

    return {
      'N°': index + 1,
      'Hora de Ingreso': checkInTime,
      'Nombre del Niño': child?.full_name || 'Desconocido',
      'Categoría': cat ? `${cat.name} (${cat.min_age}-${cat.max_age} años)` : 'Sin categoría',
      'Edad': child?.birthdate ? formatAge(child.birthdate) : 'No especificada',
      'Fecha Nacimiento': child?.birthdate || '',
      'Estado Físico': rec.physical_condition || 'Sano',
      'Estado Emocional': rec.emotional_condition || 'Feliz',
      'Tutor 1': child?.parent1_name || '',
      'Teléfono 1': child?.parent1_phone || '',
      'Tutor 2': child?.parent2_name || '',
      'Teléfono 2': child?.parent2_phone || '',
      'Observaciones / Alergias': rec.notes || child?.notes || '',
    };
  });

  const detailWorksheet = XLSX.utils.json_to_sheet(rows);
  detailWorksheet['!cols'] = [
    { wch: 6 },   // N°
    { wch: 16 },  // Hora Ingreso
    { wch: 30 },  // Nombre del Niño
    { wch: 24 },  // Categoría
    { wch: 14 },  // Edad
    { wch: 16 },  // Fecha Nacimiento
    { wch: 16 },  // Estado Físico
    { wch: 16 },  // Estado Emocional
    { wch: 24 },  // Tutor 1
    { wch: 18 },  // Teléfono 1
    { wch: 24 },  // Tutor 2
    { wch: 18 },  // Teléfono 2
    { wch: 35 },  // Observaciones
  ];

  // 2. Summary sheet with Event metadata
  const total = records.length;
  const categoryCounts: Record<string, number> = {};
  categories.forEach(c => { categoryCounts[c.name] = 0; });
  categoryCounts['Sin Categoría'] = 0;

  records.forEach(rec => {
    const child = rec.child || (rec as unknown as { children?: Child }).children;
    const cat = rec.category || getChildCategory(child, categories);
    const catName = cat?.name || 'Sin Categoría';
    categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
  });

  const physStats: Record<string, number> = {};
  records.forEach(rec => {
    const p = rec.physical_condition || 'Sano';
    physStats[p] = (physStats[p] || 0) + 1;
  });

  const emotStats: Record<string, number> = {};
  records.forEach(rec => {
    const e = rec.emotional_condition || 'Feliz';
    emotStats[e] = (emotStats[e] || 0) + 1;
  });

  const summaryData: (string | number)[][] = [
    ['REPORTE DE ASISTENCIA A EVENTO - MINISTERIO DE NIÑOS'],
    [],
    ['INFORMACIÓN DEL EVENTO'],
    ['Evento:', event.title],
    ['Fecha:', eventDateStr],
    ['Horario:', timeStr],
    ['Lugar / Salón:', locationStr],
    ['Audiencia / Categoría:', targetCategoryStr],
    ['Total Niños Asistentes:', total],
    [],
    ['DESGLOSE POR CATEGORÍA'],
    ['Categoría', 'Rango', 'Cantidad', 'Porcentaje'],
  ];

  categories.forEach(c => {
    const count = categoryCounts[c.name] || 0;
    const pct = total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%';
    summaryData.push([c.name, `${c.min_age} a ${c.max_age} años`, count, pct]);
  });

  if (categoryCounts['Sin Categoría'] > 0) {
    const count = categoryCounts['Sin Categoría'];
    const pct = total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%';
    summaryData.push(['Sin Categoría / Otra', 'N/A', count, pct]);
  }

  summaryData.push([]);
  summaryData.push(['DESGLOSE POR ESTADO FÍSICO AL INGRESO']);
  summaryData.push(['Condición Física', 'Cantidad', 'Porcentaje']);
  Object.entries(physStats).forEach(([cond, count]) => {
    const pct = total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%';
    summaryData.push([cond, count, pct]);
  });

  summaryData.push([]);
  summaryData.push(['DESGLOSE POR ESTADO EMOCIONAL AL INGRESO']);
  summaryData.push(['Condición Emocional', 'Cantidad', 'Porcentaje']);
  Object.entries(emotStats).forEach(([cond, count]) => {
    const pct = total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0%';
    summaryData.push([cond, count, pct]);
  });

  const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWorksheet['!cols'] = [
    { wch: 28 },
    { wch: 22 },
    { wch: 18 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, detailWorksheet, 'Asistencia Detallada');
  XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Resumen del Evento');

  const cleanTitle = event.title.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanDate = eventDateStr.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Evento_${cleanTitle}_${cleanDate}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
