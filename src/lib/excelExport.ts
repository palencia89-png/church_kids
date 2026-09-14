import * as XLSX from 'xlsx';
import type { Attendance, Child, Category } from './supabase';
import { getServiceFromRecord } from './supabase';
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
    const service = getServiceFromRecord(rec);

    return {
      'N°': index + 1,
      'Fecha': rec.event_date || '',
      'Hora Ingreso': checkInTime,
      'Servicio': `Servicio de las ${service}`,
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
    { wch: 14 },  // Hora Ingreso
    { wch: 22 },  // Servicio
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

  // Service distribution
  const serviceStats = {
    'Servicio 8:00 AM': 0,
    'Servicio 11:00 AM': 0,
  };

  records.forEach(rec => {
    const s = getServiceFromRecord(rec);
    if (s === '11:00 AM') serviceStats['Servicio 11:00 AM']++;
    else serviceStats['Servicio 8:00 AM']++;
  });

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

  const summaryData: (string | number)[][] = [
    ['RESUMEN DE ASISTENCIA - MINISTERIO DE NIÑOS'],
    ['Período / Fecha:', dateLabel],
    ['Total de Asistencias:', total],
    [],
    ['DESGLOSE POR SERVICIO (HORARIO)'],
    ['Servicio', 'Cantidad de Niños', 'Porcentaje'],
    ['Servicio de 8:00 AM', serviceStats['Servicio 8:00 AM'], total > 0 ? `${((serviceStats['Servicio 8:00 AM'] / total) * 100).toFixed(1)}%` : '0%'],
    ['Servicio de 11:00 AM', serviceStats['Servicio 11:00 AM'], total > 0 ? `${((serviceStats['Servicio 11:00 AM'] / total) * 100).toFixed(1)}%` : '0%'],
    [],
    ['DESGLOSE POR CATEGORÍA'],
    ['Categoría', 'Rango de Edad', 'Cantidad de Niños', 'Porcentaje'],
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
