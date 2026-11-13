import * as XLSX from 'xlsx';
import type { Project, FundingSource, ProjectStatus, Quarter } from '../types';

export interface ParsedImportRow {
  rowNumber: number;
  code: string;
  name: string;
  matchedProject?: Project;
  isNew: boolean;
  updatedProject: Project;
  changedSummary: string[];
}

export interface ImportParseResult {
  fileName: string;
  totalRows: number;
  rows: ParsedImportRow[];
  updatesCount: number;
  newCount: number;
  warnings: string[];
  errors: string[];
}

const VALID_QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）]/g, '');
}

function parseNumberSafe(val: unknown, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') {
    return Number.isFinite(val) && val >= 0 ? Math.round(val * 100) / 100 : fallback;
  }
  const cleaned = String(val).replace(/[฿,\sบาท]/g, '').trim();
  if (!cleaned) return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback;
}

function parseStatus(val: unknown, fallback: ProjectStatus): ProjectStatus {
  const s = String(val ?? '').trim().toLowerCase();
  if (!s) return fallback;
  if (s === 'completed' || s.includes('เสร็จ') || s.includes('เรียบร้อย') || s.includes('done')) {
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
  const s = String(val ?? '').toUpperCase();
  const matched = VALID_QUARTERS.filter((q) => s.includes(q));
  return matched.length > 0 ? matched : fallback.length > 0 ? fallback : ['Q1'];
}

function statusToTh(status: ProjectStatus): string {
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

/**
 * Download an Excel (.xlsx) Import Template pre-populated with clean column headers,
 * sample/existing rows, and a Thai instruction guide sheet.
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

  const guideRows = [
    { 'ชื่อคอลัมน์': 'รหัสโครงการ', 'ความหมายและรูปแบบที่รองรับ': 'รหัสอ้างอิงโครงการ (เช่น GOV-70-01, FND-70-01) ใช้จับคู่ปรับปรุงโครงการเดิม หรือตั้งรหัสใหม่เพื่อเพิ่มโครงการใหม่' },
    { 'ชื่อคอลัมน์': 'สถานะโครงการ', 'ความหมายและรูปแบบที่รองรับ': 'ระบุเป็น: อยู่ระหว่างดำเนินการ | ยังไม่ได้ดำเนินการ | ดำเนินการเสร็จแล้ว (หรือ in_progress | not_started | completed)' },
    { 'ชื่อคอลัมน์': 'แหล่งงบประมาณ', 'ความหมายและรูปแบบที่รองรับ': 'ระบุเป็น: งบประมาณรายจ่ายประจำปี | เงินกองทุน สตง. (หรือ budget_annual | budget_fund)' },
    { 'ชื่อคอลัมน์': 'ไตรมาสตามแผน', 'ความหมายและรูปแบบที่รองรับ': 'ระบุเป็น Q1, Q2, Q3, Q4 (หลายไตรมาสคั่นด้วยจุลภาค เช่น Q1, Q2)' },
    { 'ชื่อคอลัมน์': 'ดำเนินการจริง', 'ความหมายและรูปแบบที่รองรับ': 'ข้อความระบุวันจัดอบรมจริงหรือความก้าวหน้าล่าสุด' },
    { 'ชื่อคอลัมน์': 'จำนวนรุ่นจริง / คนเข้าอบรมจริง / งบใช้จ่ายจริง (บาท)', 'ความหมายและรูปแบบที่รองรับ': 'ตัวเลขอาราบิก (ค่ามากกว่าหรือเท่ากับ 0) ระบบคำนวณงบคงเหลือและร้อยละให้อัตโนมัติ' },
  ];

  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.json_to_sheet(templateRows);
  wsData['!cols'] = [
    { wch: 7 }, { wch: 13 }, { wch: 48 }, { wch: 30 }, { wch: 24 },
    { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 28 },
    { wch: 15 }, { wch: 14 }, { wch: 16 }, { wch: 15 }, { wch: 16 }, { wch: 18 },
  ];
  const wsGuide = XLSX.utils.json_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 32 }, { wch: 80 }];

  XLSX.utils.book_append_sheet(wb, wsData, 'ข้อมูลสำหรับนำเข้า');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'คำแนะนำการกรอกข้อมูล');
  XLSX.writeFile(wb, `SADI_Import_Template_2570.xlsx`);
}

/**
 * Download a UTF-8 BOM CSV Import Template compatible with Microsoft Excel and Google Sheets.
 */
export function downloadImportTemplateCSV(projects: Project[]) {
  const headers = [
    'ลำดับ',
    'รหัสโครงการ',
    'ชื่อโครงการ/หลักสูตร',
    'หมวดหมู่',
    'กลุ่มเป้าหมาย',
    'แหล่งงบประมาณ',
    'สถานะโครงการ',
    'ไตรมาสตามแผน',
    'กำหนดการตามแผน',
    'ดำเนินการจริง',
    'จำนวนรุ่นตามแผน',
    'จำนวนรุ่นจริง',
    'คนเข้าอบรมตามแผน',
    'คนเข้าอบรมจริง',
    'งบจัดสรร (บาท)',
    'งบใช้จ่ายจริง (บาท)',
  ];

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
 * Parse uploaded .xlsx, .xls, .csv, or .json file into validated project updates/additions.
 */
export async function parseImportedFile(
  file: File,
  existingProjects: Project[]
): Promise<ImportParseResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const rows: ParsedImportRow[] = [];

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const codeMap = new Map(existingProjects.map((p) => [p.code.trim().toLowerCase(), p]));
  const idMap = new Map(existingProjects.map((p) => [p.id.trim().toLowerCase(), p]));

  let rawRecords: Record<string, unknown>[] = [];

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
      throw new Error('ไฟล์ JSON ไม่มีโครงสร้างอาร์เรย์โครงการที่รองรับ');
    }
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('ไม่พบแผ่นงาน (Sheet) ในไฟล์ที่อัปโหลด');
    }
    const sheet = workbook.Sheets[firstSheetName];
    rawRecords = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  }

  if (rawRecords.length === 0) {
    errors.push('ไม่พบแถวข้อมูลในไฟล์ที่นำเข้า');
    return {
      fileName: file.name,
      totalRows: 0,
      rows: [],
      updatesCount: 0,
      newCount: 0,
      warnings,
      errors,
    };
  }

  rawRecords.forEach((rec, index) => {
    const rowNumber = index + 2; // Excel row accounting for header row
    const rawCode = String(getField(rec, ['รหัสโครงการ', 'code', 'projectcode']) ?? '').trim();
    const rawId = String(getField(rec, ['id', 'รหัสอ้างอิง']) ?? '').trim();
    const rawName = String(
      getField(rec, ['ชื่อโครงการ/หลักสูตร', 'ชื่อโครงการ', 'name', 'projectname']) ?? ''
    ).trim();

    if (!rawCode && !rawName) {
      warnings.push(`แถวที่ ${rowNumber}: ข้ามแถวว่างที่ไม่มีรหัสหรือชื่อโครงการ`);
      return;
    }

    const matched =
      (rawId ? idMap.get(rawId.toLowerCase()) : undefined) ||
      (rawCode ? codeMap.get(rawCode.toLowerCase()) : undefined);

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
    const rawCat = getField(rec, ['หมวดหมู่', 'category']);
    const nextCat = rawCat ? String(rawCat).trim() : base.category;

    const rawTarget = getField(rec, ['กลุ่มเป้าหมาย', 'targetgroup']);
    const nextTarget = rawTarget ? String(rawTarget).trim() : base.targetGroup;

    const rawFunding = getField(rec, ['แหล่งงบประมาณ', 'fundingsource', 'fundingsourcenameth']);
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

    const rawActualDate = getField(rec, ['ดำเนินการจริง', 'ดำเนินการจริง (เปลี่ยนแปลงได้)', 'actualdateorquarter']);
    const nextActualDate = rawActualDate !== undefined ? String(rawActualDate).trim() : base.actualDateOrQuarter;

    const nextBatchesPlanned = Math.round(
      parseNumberSafe(getField(rec, ['จำนวนรุ่นตามแผน', 'batchesplanned']), base.batchesPlanned)
    );
    const nextBatchesActual = Math.round(
      parseNumberSafe(getField(rec, ['จำนวนรุ่นจริง', 'batchesactual']), base.batchesActual)
    );
    const nextPartPlanned = Math.round(
      parseNumberSafe(getField(rec, ['คนเข้าอบรมตามแผน', 'ผู้เข้าอบรมตามแผน (คน)', 'participantsplanned']), base.participantsPlanned)
    );
    const nextPartActual = Math.round(
      parseNumberSafe(getField(rec, ['คนเข้าอบรมจริง', 'ผู้เข้าอบรมจริง (คน)', 'participantsactual']), base.participantsActual)
    );
    const nextBudgetAllocated = parseNumberSafe(
      getField(rec, ['งบจัดสรร (บาท)', 'งบประมาณจัดสรร (บาท)', 'งบจัดสรร', 'budgetallocated']),
      base.budgetAllocated
    );
    const nextBudgetActual = parseNumberSafe(
      getField(rec, ['งบใช้จ่ายจริง (บาท)', 'งบประมาณใช้จริง (บาท)', 'ใช้จ่ายจริง (บาท)', 'budgetactual']),
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
      actualDateOrQuarter: nextActualDate,
      batchesPlanned: nextBatchesPlanned,
      batchesActual: nextBatchesActual,
      participantsPlanned: nextPartPlanned,
      participantsActual: nextPartActual,
      budgetAllocated: nextBudgetAllocated,
      budgetActual: nextBudgetActual,
    };

    const changedSummary: string[] = [];
    if (!matched) {
      changedSummary.push('โครงการใหม่จากไฟล์นำเข้า');
    } else {
      if (matched.status !== updatedProject.status) {
        changedSummary.push(`สถานะ: ${statusToTh(matched.status)} → ${statusToTh(updatedProject.status)}`);
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
      updatedProject,
      changedSummary,
    });
  });

  const updatesCount = rows.filter((r) => !r.isNew).length;
  const newCount = rows.filter((r) => r.isNew).length;

  return {
    fileName: file.name,
    totalRows: rows.length,
    rows,
    updatesCount,
    newCount,
    warnings,
    errors,
  };
}
