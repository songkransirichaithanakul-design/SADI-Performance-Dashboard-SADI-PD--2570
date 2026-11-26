import * as XLSX from 'xlsx';
import type { Project, FundingSource, ProjectStatus, Quarter } from '../types';

export interface ImportColumnSpec {
  order: number;
  columnName: string;
  required: boolean;
  example: string;
  description: string;
}

export const IMPORT_TEMPLATE_SCHEMA: ImportColumnSpec[] = [
  { order: 1, columnName: 'ลำดับ', required: false, example: '1', description: 'ลำดับที่ในไฟล์ (ใช้เพื่อความสะดวกในการอ่าน)' },
  { order: 2, columnName: 'รหัสโครงการ', required: true, example: 'GOV-70-01', description: 'รหัสอ้างอิงหลักสำหรับจับคู่ปรับปรุงโครงการเดิม หรือตั้งรหัสใหม่เพื่อเพิ่มโครงการใหม่' },
  { order: 3, columnName: 'ชื่อโครงการ/หลักสูตร', required: true, example: 'หลักสูตรการตรวจสอบการเงิน...', description: 'ชื่อโครงการหรือหลักสูตรพัฒนาศักยภาพบุคลากร' },
  { order: 4, columnName: 'หมวดหมู่', required: false, example: '1. การพัฒนาสายวิชาชีพ (Professional Development)', description: 'หมวดหมู่สมรรถนะของโครงการ' },
  { order: 5, columnName: 'กลุ่มเป้าหมาย', required: false, example: 'ทุกระดับ กลาง/ภาค', description: 'กลุ่มบุคลากรเป้าหมายที่เข้าอบรม' },
  { order: 6, columnName: 'แหล่งงบประมาณ', required: false, example: 'งบประมาณรายจ่ายประจำปี', description: 'ระบุ "งบประมาณรายจ่ายประจำปี" หรือ "เงินกองทุน สตง."' },
  { order: 7, columnName: 'สถานะโครงการ', required: true, example: 'อยู่ระหว่างดำเนินการ', description: 'ระบุ: อยู่ระหว่างดำเนินการ | ยังไม่ได้ดำเนินการ | ดำเนินการเสร็จแล้ว' },
  { order: 8, columnName: 'ไตรมาสตามแผน', required: false, example: 'Q1, Q2', description: 'ไตรมาสที่ดำเนินการ (Q1, Q2, Q3, Q4 คั่นด้วยจุลภาค)' },
  { order: 9, columnName: 'กำหนดการตามแผน', required: false, example: 'พ.ย. 69 - ก.พ. 70', description: 'ช่วงเวลาที่วางแผนดำเนินการ' },
  { order: 10, columnName: 'ดำเนินการจริง', required: false, example: 'จัดอบรมรุ่น 1 วันที่ 15-17 ธ.ค. 69', description: 'วันที่จัดจริงหรือบันทึกความก้าวหน้าล่าสุด' },
  { order: 11, columnName: 'จำนวนรุ่นตามแผน', required: false, example: '2', description: 'จำนวนรุ่นตามแผน (ตัวเลขจำนวนเต็ม)' },
  { order: 12, columnName: 'จำนวนรุ่นจริง', required: true, example: '1', description: 'จำนวนรุ่นที่จัดอบรมจริงแล้ว (ตัวเลขจำนวนเต็ม >= 0)' },
  { order: 13, columnName: 'คนเข้าอบรมตามแผน', required: false, example: '100', description: 'จำนวนผู้เข้าอบรมตามเป้าหมาย (คน)' },
  { order: 14, columnName: 'คนเข้าอบรมจริง', required: true, example: '52', description: 'จำนวนผู้เข้าอบรมจริงสะสม (คน)' },
  { order: 15, columnName: 'งบจัดสรร (บาท)', required: false, example: '850000', description: 'วงเงินงบประมาณที่ได้รับจัดสรร (บาท)' },
  { order: 16, columnName: 'งบใช้จ่ายจริง (บาท)', required: true, example: '425000', description: 'ยอดเบิกจ่ายจริงสะสม (บาท) ระบบคำนวณคงเหลือและ % ให้อัตโนมัติ' },
];

export interface ParsedImportRow {
  rowNumber: number;
  code: string;
  name: string;
  matchedProject?: Project;
  isNew: boolean;
  hasChanges: boolean;
  updatedProject: Project;
  changedSummary: string[];
}

export interface ImportParseResult {
  fileName: string;
  sheetName: string;
  totalRows: number;
  rows: ParsedImportRow[];
  updatesCount: number;
  changedUpdatesCount: number;
  newCount: number;
  warnings: string[];
  errors: string[];
}

const VALID_QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

const THAI_DIGITS_MAP: Record<string, string> = {
  '๐': '0',
  '๑': '1',
  '๒': '2',
  '๓': '3',
  '๔': '4',
  '๕': '5',
  '๖': '6',
  '๗': '7',
  '๘': '8',
  '๙': '9',
};

function toArabicDigits(input: string): string {
  return input.replace(/[๐-๙]/g, (d) => THAI_DIGITS_MAP[d] ?? d);
}

function normalizeHeader(h: unknown): string {
  return toArabicDigits(String(h ?? ''))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）/_\-]/g, '');
}

function parseNumberSafe(val: unknown, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') {
    return Number.isFinite(val) && val >= 0 ? Math.round(val * 100) / 100 : fallback;
  }
  const cleaned = toArabicDigits(String(val))
    .replace(/[฿,\sบาทคนรุ่น]/g, '')
    .trim();
  if (!cleaned || cleaned === '-') return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback;
}

function parseStatus(val: unknown, fallback: ProjectStatus): ProjectStatus {
  const s = String(val ?? '').trim().toLowerCase();
  if (!s) return fallback;
  if (s === 'completed' || s.includes('เสร็จ') || s.includes('เรียบร้อย') || s.includes('done') || s.includes('สำเร็จ')) {
    return 'completed';
  }
  if (s === 'in_progress' || s.includes('ระหว่าง') || s.includes('กำลัง')) {
    return 'in_progress';
  }
  if (s === 'not_started' || s.includes('ยังไม่') || s.includes('รอ')) {
    return 'not_started';
  }
  return fallback;
}

function parseFundingSource(val: unknown, fallback: FundingSource): { source: FundingSource; nameTh: string } {
  const s = String(val ?? '').trim().toLowerCase();
  if (!s) {
    return {
      source: fallback,
      nameTh: fallback === 'budget_annual' ? 'งบประมาณรายจ่ายประจำปี' : 'เงินกองทุนเพื่อการพัฒนาการตรวจเงินแผ่นดิน',
    };
  }
  if (s === 'budget_fund' || s.includes('กองทุน') || s.includes('fund') || s.startsWith('fnd')) {
    return {
      source: 'budget_fund',
      nameTh: 'เงินกองทุนเพื่อการพัฒนาการตรวจเงินแผ่นดิน',
    };
  }
  if (s === 'budget_annual' || s.includes('แผ่นดิน') || s.includes('ประจำปี') || s.includes('annual') || s.startsWith('gov')) {
    return {
      source: 'budget_annual',
      nameTh: 'งบประมาณรายจ่ายประจำปี',
    };
  }
  return {
    source: fallback,
    nameTh: fallback === 'budget_annual' ? 'งบประมาณรายจ่ายประจำปี' : 'เงินกองทุนเพื่อการพัฒนาการตรวจเงินแผ่นดิน',
  };
}

function parseQuarters(val: unknown, fallback: Quarter[]): Quarter[] {
  const s = toArabicDigits(String(val ?? '')).toUpperCase();
  const matched = VALID_QUARTERS.filter((q) => s.includes(q));
  return matched.length > 0 ? matched : fallback.length > 0 ? fallback : ['Q1'];
}

export function statusToTh(status: ProjectStatus): string {
  if (status === 'completed') return 'ดำเนินการเสร็จแล้ว';
  if (status === 'in_progress') return 'อยู่ระหว่างดำเนินการ';
  return 'ยังไม่ได้ดำเนินการ';
}

function getField(rowObj: Record<string, unknown>, candidates: string[]): unknown {
  const normalizedKeys = new Map<string, unknown>();
  Object.entries(rowObj).forEach(([k, v]) => {
    normalizedKeys.set(normalizeHeader(k), v);
  });
  for (const cand of candidates) {
    const target = normalizeHeader(cand);
    if (normalizedKeys.has(target)) {
      return normalizedKeys.get(target);
    }
  }
  return undefined;
}

function hasRecognizedProjectColumns(rec: Record<string, unknown>): boolean {
  const keys = Object.keys(rec).map(normalizeHeader);
  const codeOrNameKeys = ['รหัสโครงการ', 'รหัส', 'code', 'projectcode', 'ชื่อโครงการหลักสูตร', 'ชื่อโครงการ', 'name', 'projectname'];
  return codeOrNameKeys.some((target) => keys.includes(normalizeHeader(target)));
}

/**
 * Download an Excel (.xlsx) Import Template pre-populated with clean column headers,
 * current project rows, and a Thai instruction guide sheet.
 */
export function downloadImportTemplateXLSX(projects: Project[]) {
  const templateRows = projects.map((p, idx) => ({
    'ลำดับ': idx + 1,
    'รหัสโครงการ': p.code,
    'ชื่อโครงการ/หลักสูตร': p.name,
    'หมวดหมู่': p.category,
    'กลุ่มเป้าหมาย': p.targetGroup,
    'แหล่งงบประมาณ': p.fundingSource === 'budget_annual' ? 'งบประมาณรายจ่ายประจำปี' : 'เงินกองทุน สตง.',
    'สถานะโครงการ': statusToTh(p.status),
    'ไตรมาสตามแผน': p.quarters.join(', '),
    'กำหนดการตามแผน': p.executionDateSchedule,
    'ดำเนินการจริง': p.actualDateOrQuarter || '',
    'จำนวนรุ่นตามแผน': p.batchesPlanned,
    'จำนวนรุ่นจริง': p.batchesActual,
    'คนเข้าอบรมตามแผน': p.participantsPlanned,
    'คนเข้าอบรมจริง': p.participantsActual,
    'งบจัดสรร (บาท)': p.budgetAllocated,
    'งบใช้จ่ายจริง (บาท)': p.budgetActual,
  }));

  const guideRows = IMPORT_TEMPLATE_SCHEMA.map((col) => ({
    'ลำดับ': col.order,
    'ชื่อคอลัมน์มาตรฐาน': col.columnName,
    'จำเป็น': col.required ? 'จำเป็น' : 'ไม่บังคับ',
    'ตัวอย่างข้อมูล': col.example,
    'คำอธิบายและรูปแบบที่รองรับ': col.description,
  }));

  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.json_to_sheet(templateRows);
  wsData['!cols'] = [
    { wch: 7 }, { wch: 13 }, { wch: 48 }, { wch: 30 }, { wch: 24 },
    { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 28 },
    { wch: 15 }, { wch: 14 }, { wch: 16 }, { wch: 15 }, { wch: 16 }, { wch: 18 },
  ];
  const wsGuide = XLSX.utils.json_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 8 }, { wch: 26 }, { wch: 12 }, { wch: 32 }, { wch: 64 }];

  XLSX.utils.book_append_sheet(wb, wsData, 'ข้อมูลสำหรับนำเข้า');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'คำแนะนำการกรอกข้อมูล');
  XLSX.writeFile(wb, `SADI_Import_Template_2570.xlsx`);
}

/**
 * Download a UTF-8 BOM CSV Import Template compatible with Microsoft Excel and Google Sheets.
 */
export function downloadImportTemplateCSV(projects: Project[]) {
  const headers = IMPORT_TEMPLATE_SCHEMA.map((c) => c.columnName);

  const rows = projects.map((p, idx) =>
    [
      idx + 1,
      `"${p.code}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category.replace(/"/g, '""')}"`,
      `"${p.targetGroup.replace(/"/g, '""')}"`,
      `"${p.fundingSource === 'budget_annual' ? 'งบประมาณรายจ่ายประจำปี' : 'เงินกองทุน สตง.'}"`,
      `"${statusToTh(p.status)}"`,
      `"${p.quarters.join(', ')}"`,
      `"${(p.executionDateSchedule || '').replace(/"/g, '""')}"`,
      `"${(p.actualDateOrQuarter || '').replace(/"/g, '""')}"`,
      p.batchesPlanned,
      p.batchesActual,
      p.participantsPlanned,
      p.participantsActual,
      p.budgetAllocated,
      p.budgetActual,
    ].join(',')
  );

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `SADI_Import_Template_2570.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Download a structured JSON Import Template ready for external editing and re-import.
 */
export function downloadImportTemplateJSON(projects: Project[]) {
  const payload = {
    schemaVersion: 4,
    fiscalYear: '2570',
    templateDescription: 'โครงสร้างไฟล์ JSON มาตรฐานสำหรับบันทึกภายนอกและนำเข้าสู่ระบบรายงานผล สตง. (SADI)',
    projects: projects.map((p) => ({
      code: p.code,
      name: p.name,
      category: p.category,
      targetGroup: p.targetGroup,
      fundingSource: p.fundingSource,
      status: p.status,
      quarters: p.quarters,
      executionDateSchedule: p.executionDateSchedule,
      actualDateOrQuarter: p.actualDateOrQuarter || '',
      batchesPlanned: p.batchesPlanned,
      batchesActual: p.batchesActual,
      participantsPlanned: p.participantsPlanned,
      participantsActual: p.participantsActual,
      budgetAllocated: p.budgetAllocated,
      budgetActual: p.budgetActual,
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `SADI_Import_Template_2570.json`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export complete processed dataset as formatted multi-sheet Excel (.xlsx)
 * for Page 1 (หน้าข้อมูลโครงการ).
 */
export function exportFullDatasetXLSX(projects: Project[]) {
  const detailRows = projects.map((p, idx) => {
    const remaining = p.budgetAllocated - p.budgetActual;
    const pct = p.budgetAllocated > 0 ? Number(((p.budgetActual / p.budgetAllocated) * 100).toFixed(2)) : 0;
    return {
      'ลำดับ': idx + 1,
      'รหัสโครงการ': p.code,
      'ชื่อโครงการ/หลักสูตร': p.name,
      'หมวดหมู่': p.category,
      'กลุ่มเป้าหมาย': p.targetGroup,
      'แหล่งงบประมาณ': p.fundingSourceNameTh,
      'สถานะโครงการ': statusToTh(p.status),
      'ไตรมาส': p.quarters.join(', '),
      'กำหนดการตามแผน': p.executionDateSchedule,
      'ดำเนินการจริง': p.actualDateOrQuarter || '-',
      'จำนวนรุ่นตามแผน': p.batchesPlanned,
      'จำนวนรุ่นจริง': p.batchesActual,
      'คนเข้าอบรมตามแผน': p.participantsPlanned,
      'คนเข้าอบรมจริง': p.participantsActual,
      'งบจัดสรร (บาท)': p.budgetAllocated,
      'งบใช้จ่ายจริง (บาท)': p.budgetActual,
      'งบคงเหลือ (บาท)': remaining,
      'ร้อยละเบิกจ่าย (%)': pct,
      'ผู้ปรับปรุงล่าสุด': p.lastModifiedBy || '-',
      'วันเวลาปรับปรุงล่าสุด': p.lastModifiedAt || '-',
    };
  });

  const annual = projects.filter((p) => p.fundingSource === 'budget_annual');
  const fund = projects.filter((p) => p.fundingSource === 'budget_fund');
  const summaryRows = [
    {
      'แหล่งงบประมาณ': 'งบประมาณรายจ่ายประจำปี พ.ศ. 2570',
      'จำนวนโครงการ': annual.length,
      'งบจัดสรรรวม (บาท)': annual.reduce((s, p) => s + p.budgetAllocated, 0),
      'เบิกจ่ายจริง (บาท)': annual.reduce((s, p) => s + p.budgetActual, 0),
      'คงเหลือ (บาท)': annual.reduce((s, p) => s + (p.budgetAllocated - p.budgetActual), 0),
    },
    {
      'แหล่งงบประมาณ': 'เงินกองทุนเพื่อการพัฒนาการตรวจเงินแผ่นดิน',
      'จำนวนโครงการ': fund.length,
      'งบจัดสรรรวม (บาท)': fund.reduce((s, p) => s + p.budgetAllocated, 0),
      'เบิกจ่ายจริง (บาท)': fund.reduce((s, p) => s + p.budgetActual, 0),
      'คงเหลือ (บาท)': fund.reduce((s, p) => s + (p.budgetAllocated - p.budgetActual), 0),
    },
    {
      'แหล่งงบประมาณ': 'รวมทั้งหมด',
      'จำนวนโครงการ': projects.length,
      'งบจัดสรรรวม (บาท)': projects.reduce((s, p) => s + p.budgetAllocated, 0),
      'เบิกจ่ายจริง (บาท)': projects.reduce((s, p) => s + p.budgetActual, 0),
      'คงเหลือ (บาท)': projects.reduce((s, p) => s + (p.budgetAllocated - p.budgetActual), 0),
    },
  ];

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 44 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];

  const wsDetails = XLSX.utils.json_to_sheet(detailRows);
  wsDetails['!cols'] = [
    { wch: 7 }, { wch: 13 }, { wch: 48 }, { wch: 30 }, { wch: 24 },
    { wch: 28 }, { wch: 22 }, { wch: 12 }, { wch: 24 }, { wch: 28 },
    { wch: 15 }, { wch: 14 }, { wch: 16 }, { wch: 15 }, { wch: 16 },
    { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, wsDetails, 'ข้อมูลโครงการชุดสมบูรณ์');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'สรุปงบประมาณ 2570');
  XLSX.writeFile(wb, `SADI_Complete_Projects_Dataset_2570_${Date.now()}.xlsx`);
}

/**
 * Build a 2D cell matrix matching the standard 16-column IMPORT_TEMPLATE_SCHEMA
 * for populating or syncing a Google Sheet.
 */
export function buildSheetMatrixFromProjects(projects: Project[]): (string | number)[][] {
  const headers = IMPORT_TEMPLATE_SCHEMA.map((c) => c.columnName);
  const dataRows = projects.map((p, idx) => [
    idx + 1,
    p.code,
    p.name,
    p.category,
    p.targetGroup,
    p.fundingSource === 'budget_annual' ? 'งบประมาณรายจ่ายประจำปี' : 'เงินกองทุน สตง.',
    statusToTh(p.status),
    p.quarters.join(', '),
    p.executionDateSchedule || '-',
    p.actualDateOrQuarter || '',
    p.batchesPlanned,
    p.batchesActual,
    p.participantsPlanned,
    p.participantsActual,
    p.budgetAllocated,
    p.budgetActual,
  ]);
  return [headers, ...dataRows];
}

/**
 * Build the Thai column guide matrix for the instruction tab inside a newly created Google Sheet.
 */
export function buildGuideSheetMatrix(): (string | number)[][] {
  const headers = [
    'ลำดับ',
    'ชื่อคอลัมน์มาตรฐาน',
    'จำเป็น',
    'ตัวอย่างข้อมูล',
    'คำอธิบายและรูปแบบที่รองรับ',
  ];
  const rows = IMPORT_TEMPLATE_SCHEMA.map((col) => [
    col.order,
    col.columnName,
    col.required ? 'จำเป็น' : 'ไม่บังคับ',
    col.example,
    col.description,
  ]);
  return [headers, ...rows];
}

/**
 * Convert a 2D Google Sheets values matrix (header row + data rows) into keyed row objects.
 */
export function convertSheetMatrixToRecords(values: unknown[][]): Record<string, unknown>[] {
  if (!Array.isArray(values) || values.length < 2) return [];

  // Find the first non-empty row that looks like a header row (prefer row with recognized columns, else first non-empty row)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(values.length, 10); i++) {
    const row = values[i];
    if (!Array.isArray(row)) continue;
    const nonEmptyCells = row.filter((c) => String(c ?? '').trim() !== '');
    if (nonEmptyCells.length === 0) continue;
    const probeObj: Record<string, unknown> = {};
    row.forEach((cell, colIdx) => {
      const key = String(cell ?? '').trim() || `col_${colIdx}`;
      probeObj[key] = '';
    });
    if (hasRecognizedProjectColumns(probeObj)) {
      headerRowIdx = i;
      break;
    }
    if (headerRowIdx === -1) {
      headerRowIdx = i;
    }
  }

  if (headerRowIdx === -1) return [];

  const headers = values[headerRowIdx].map((h, idx) => {
    const label = String(h ?? '').trim();
    return label || `col_${idx + 1}`;
  });

  const records: Record<string, unknown>[] = [];
  for (let r = headerRowIdx + 1; r < values.length; r++) {
    const row = values[r] || [];
    const hasAnyValue = row.some((cell) => String(cell ?? '').trim() !== '');
    if (!hasAnyValue) continue;

    const obj: Record<string, unknown> = {};
    headers.forEach((header, colIdx) => {
      obj[header] = colIdx < row.length ? row[colIdx] : '';
    });
    records.push(obj);
  }

  return records;
}

/**
 * Core shared parser that validates keyed project records (from Excel, CSV, JSON, or Google Sheets)
 * against the existing project dataset and computes row-by-row diffs.
 */
export function parseRawProjectRecords(
  rawRecords: Record<string, unknown>[],
  existingProjects: Project[],
  sourceName: string,
  sheetName: string
): ImportParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const rows: ParsedImportRow[] = [];

  const codeMap = new Map(existingProjects.map((p) => [p.code.trim().toLowerCase(), p]));
  const idMap = new Map(existingProjects.map((p) => [p.id.trim().toLowerCase(), p]));
  const nameMap = new Map(existingProjects.map((p) => [p.name.trim().toLowerCase(), p]));

  if (rawRecords.length === 0) {
    errors.push('ไม่พบแถวข้อมูลในแหล่งข้อมูลที่นำเข้า');
    return {
      fileName: sourceName,
      sheetName,
      totalRows: 0,
      rows: [],
      updatesCount: 0,
      changedUpdatesCount: 0,
      newCount: 0,
      warnings,
      errors,
    };
  }

  if (!hasRecognizedProjectColumns(rawRecords[0])) {
    errors.push(
      'โครงสร้างคอลัมน์ไม่ตรงตามมาตรฐานที่ระบบออกแบบไว้ (ไม่พบคอลัมน์ "รหัสโครงการ" หรือ "ชื่อโครงการ/หลักสูตร") กรุณาตรวจสอบแท็บชีตที่เลือกหรือใช้โครงสร้าง 16 คอลัมน์มาตรฐาน'
    );
    return {
      fileName: sourceName,
      sheetName,
      totalRows: 0,
      rows: [],
      updatesCount: 0,
      changedUpdatesCount: 0,
      newCount: 0,
      warnings,
      errors,
    };
  }

  rawRecords.forEach((rec, index) => {
    const rowNumber = index + 2; // Row accounting for header row
    const rawCode = String(getField(rec, ['รหัสโครงการ', 'รหัส', 'code', 'projectcode']) ?? '').trim();
    const rawId = String(getField(rec, ['id', 'รหัสอ้างอิง']) ?? '').trim();
    const rawName = String(
      getField(rec, ['ชื่อโครงการ/หลักสูตร', 'ชื่อโครงการ', 'หลักสูตร', 'name', 'projectname']) ?? ''
    ).trim();

    if (!rawCode && !rawName) {
      warnings.push(`แถวที่ ${rowNumber}: ข้ามแถวว่างที่ไม่มีรหัสหรือชื่อโครงการ`);
      return;
    }

    const matched =
      (rawId ? idMap.get(rawId.toLowerCase()) : undefined) ||
      (rawCode ? codeMap.get(rawCode.toLowerCase()) : undefined) ||
      (rawName ? nameMap.get(rawName.toLowerCase()) : undefined);

    const base: Project = matched || {
      id: `imp-${Date.now()}-${index}`,
      code: rawCode || `IMP-70-${String(index + 1).padStart(2, '0')}`,
      name: rawName || `โครงการนำเข้า ${index + 1}`,
      category: '1. การพัฒนาสายวิชาชีพ (Professional Development)',
      targetGroup: 'ทุกระดับ กลาง/ภาค',
      batchesPlanned: 1,
      batchesActual: 0,
      participantsPerBatch: 50,
      participantsPlanned: 50,
      participantsActual: 0,
      budgetAllocated: 0,
      budgetActual: 0,
      fundingSource: 'budget_annual',
      fundingSourceNameTh: 'งบประมาณรายจ่ายประจำปี',
      status: 'not_started',
      quarters: ['Q1'],
      executionDateSchedule: '-',
      actualDateOrQuarter: '',
    };

    const nextName = rawName || base.name;
    const rawCat = getField(rec, ['หมวดหมู่', 'หมวดหมู่สมรรถนะ', 'category']);
    const nextCat = rawCat !== undefined && String(rawCat).trim() !== '' ? String(rawCat).trim() : base.category;

    const rawTarget = getField(rec, ['กลุ่มเป้าหมาย', 'targetgroup']);
    const nextTarget = rawTarget !== undefined && String(rawTarget).trim() !== '' ? String(rawTarget).trim() : base.targetGroup;

    const rawFunding = getField(rec, ['แหล่งงบประมาณ', 'แหล่งงบ', 'fundingsource', 'fundingsourcenameth']);
    const { source: nextFundingSource, nameTh: nextFundingNameTh } = parseFundingSource(
      rawFunding || rawCode,
      base.fundingSource
    );

    const rawStatus = getField(rec, ['สถานะโครงการ', 'สถานะ', 'status']);
    const nextStatus = parseStatus(rawStatus, base.status);

    const rawQuarters = getField(rec, ['ไตรมาสตามแผน', 'ไตรมาส', 'quarters']);
    const nextQuarters = parseQuarters(rawQuarters, base.quarters);

    const rawSched = getField(rec, ['กำหนดการตามแผน', 'กำหนดการดำเนินการ', 'executiondateschedule']);
    const nextSched = rawSched !== undefined && String(rawSched).trim() !== '' ? String(rawSched).trim() : base.executionDateSchedule;

    const rawActualDate = getField(rec, [
      'ดำเนินการจริง',
      'ดำเนินการจริง (เปลี่ยนแปลงได้)',
      'วันที่จัดจริง / ไตรมาสจริง',
      'วันที่ดำเนินการจริง',
      'actualdateorquarter',
    ]);
    const cleanedActualDate =
      rawActualDate !== undefined && String(rawActualDate).trim() !== '-'
        ? String(rawActualDate).trim()
        : base.actualDateOrQuarter || '';

    const nextBatchesPlanned = Math.round(
      parseNumberSafe(getField(rec, ['จำนวนรุ่นตามแผน', 'รุ่นตามแผน', 'batchesplanned']), base.batchesPlanned)
    );
    const nextBatchesActual = Math.round(
      parseNumberSafe(getField(rec, ['จำนวนรุ่นจริง', 'จำนวนรุ่นที่จัดจริง', 'รุ่นจริง', 'batchesactual']), base.batchesActual)
    );
    const nextPartPlanned = Math.round(
      parseNumberSafe(
        getField(rec, ['คนเข้าอบรมตามแผน', 'ผู้เข้าอบรมตามแผน (คน)', 'ผู้เข้าอบรมตามแผน', 'participantsplanned']),
        base.participantsPlanned
      )
    );
    const nextPartActual = Math.round(
      parseNumberSafe(
        getField(rec, ['คนเข้าอบรมจริง', 'ผู้เข้าอบรมจริง (คน)', 'ผู้เข้าอบรมจริง', 'participantsactual']),
        base.participantsActual
      )
    );
    const nextBudgetAllocated = parseNumberSafe(
      getField(rec, ['งบจัดสรร (บาท)', 'งบประมาณจัดสรร (บาท)', 'งบประมาณที่ได้รับจัดสรร', 'งบจัดสรร', 'budgetallocated']),
      base.budgetAllocated
    );
    const nextBudgetActual = parseNumberSafe(
      getField(rec, ['งบใช้จ่ายจริง (บาท)', 'งบประมาณใช้จริง (บาท)', 'ใช้จ่ายจริง (บาท)', 'งบใช้จ่ายจริง', 'ผลเบิกจ่ายจริง', 'budgetactual']),
      base.budgetActual
    );

    const updatedProject: Project = {
      ...base,
      code: rawCode || base.code,
      name: nextName,
      category: nextCat,
      targetGroup: nextTarget,
      fundingSource: nextFundingSource,
      fundingSourceNameTh: nextFundingNameTh,
      status: nextStatus,
      quarters: nextQuarters,
      executionDateSchedule: nextSched,
      actualDateOrQuarter: cleanedActualDate,
      batchesPlanned: nextBatchesPlanned,
      batchesActual: nextBatchesActual,
      participantsPlanned: nextPartPlanned,
      participantsActual: nextPartActual,
      budgetAllocated: nextBudgetAllocated,
      budgetActual: nextBudgetActual,
    };

    const changedSummary: string[] = [];
    if (!matched) {
      changedSummary.push('โครงการใหม่จากแหล่งนำเข้า');
    } else {
      if (matched.name !== updatedProject.name) {
        changedSummary.push('ปรับปรุงชื่อโครงการ');
      }
      if (matched.status !== updatedProject.status) {
        changedSummary.push(`สถานะ: ${statusToTh(matched.status)} → ${statusToTh(updatedProject.status)}`);
      }
      if (matched.budgetAllocated !== updatedProject.budgetAllocated) {
        changedSummary.push(`งบจัดสรร: ฿${matched.budgetAllocated.toLocaleString()} → ฿${updatedProject.budgetAllocated.toLocaleString()}`);
      }
      if (matched.budgetActual !== updatedProject.budgetActual) {
        changedSummary.push(`ใช้จ่ายจริง: ฿${matched.budgetActual.toLocaleString()} → ฿${updatedProject.budgetActual.toLocaleString()}`);
      }
      if (matched.batchesActual !== updatedProject.batchesActual) {
        changedSummary.push(`รุ่นจริง: ${matched.batchesActual} → ${updatedProject.batchesActual}`);
      }
      if (matched.participantsActual !== updatedProject.participantsActual) {
        changedSummary.push(`ผู้เข้าอบรมจริง: ${matched.participantsActual} → ${updatedProject.participantsActual}`);
      }
      if ((matched.actualDateOrQuarter || '') !== (updatedProject.actualDateOrQuarter || '')) {
        changedSummary.push('ปรับปรุงวัน/ความก้าวหน้าจริง');
      }
    }

    rows.push({
      rowNumber,
      code: updatedProject.code,
      name: updatedProject.name,
      matchedProject: matched,
      isNew: !matched,
      hasChanges: !matched || changedSummary.length > 0,
      updatedProject,
      changedSummary,
    });
  });

  const updatesCount = rows.filter((r) => !r.isNew).length;
  const changedUpdatesCount = rows.filter((r) => !r.isNew && r.hasChanges).length;
  const newCount = rows.filter((r) => r.isNew).length;

  return {
    fileName: sourceName,
    sheetName,
    totalRows: rows.length,
    rows,
    updatesCount,
    changedUpdatesCount,
    newCount,
    warnings,
    errors,
  };
}

/**
 * Parse a 2D values array fetched from Google Sheets API into the unified ImportParseResult pipeline.
 */
export function parseGoogleSheetValues(
  values: unknown[][],
  existingProjects: Project[],
  spreadsheetTitle: string,
  sheetName: string
): ImportParseResult {
  const rawRecords = convertSheetMatrixToRecords(values);
  return parseRawProjectRecords(
    rawRecords,
    existingProjects,
    `Google Sheet: ${spreadsheetTitle}`,
    sheetName
  );
}

/**
 * Parse uploaded .xlsx, .xls, .csv, or .json file into validated project updates/additions.
 */
export async function parseImportedFile(
  file: File,
  existingProjects: Project[]
): Promise<ImportParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  let rawRecords: Record<string, unknown>[] = [];
  let selectedSheetName = ext === 'json' ? 'JSON' : 'Sheet1';

  if (ext === 'json') {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      rawRecords = parsed;
    } else if (parsed && Array.isArray(parsed.projects)) {
      rawRecords = parsed.projects;
    } else if (parsed && Array.isArray(parsed.data)) {
      rawRecords = parsed.data;
    } else {
      throw new Error('ไฟล์ JSON ไม่มีโครงสร้างอาร์เรย์โครงการที่รองรับ (รองรับ projects หรือ data)');
    }
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });
    if (!workbook.SheetNames.length) {
      throw new Error('ไม่พบแผ่นงาน (Sheet) ในไฟล์ที่อัปโหลด');
    }

    // Prefer our standard template or full export sheet names, otherwise pick first sheet with matching headers
    const preferredNames = ['ข้อมูลสำหรับนำเข้า', 'ข้อมูลโครงการชุดสมบูรณ์'];
    let chosenSheet =
      preferredNames.find((name) => workbook.SheetNames.includes(name)) || workbook.SheetNames[0];

    const initialRecords = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[chosenSheet],
      { defval: '' }
    );

    if (initialRecords.length === 0 || !hasRecognizedProjectColumns(initialRecords[0])) {
      for (const sName of workbook.SheetNames) {
        const candidate = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          workbook.Sheets[sName],
          { defval: '' }
        );
        if (candidate.length > 0 && hasRecognizedProjectColumns(candidate[0])) {
          chosenSheet = sName;
          rawRecords = candidate;
          break;
        }
      }
      if (rawRecords.length === 0) {
        rawRecords = initialRecords;
      }
    } else {
      rawRecords = initialRecords;
    }

    selectedSheetName = chosenSheet;
  }

  return parseRawProjectRecords(rawRecords, existingProjects, file.name, selectedSheetName);
}
