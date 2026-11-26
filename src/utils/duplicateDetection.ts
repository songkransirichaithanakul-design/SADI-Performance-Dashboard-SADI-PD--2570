import type { FundingSource, Project } from '../types';

export type DuplicateReason =
  | 'exact_name'
  | 'similar_name_and_budget'
  | 'very_similar_name'
  | 'same_budget_actual'
  | 'same_budget_and_context';

export type DuplicateSeverity = 'high' | 'medium';

export interface DuplicateMatch {
  existingProject: Project;
  reason: DuplicateReason;
  severity: DuplicateSeverity;
  similarityScore: number; // 0..1
  explanation: string;
}

export interface SystemDuplicatePair {
  id: string;
  projectA: Project;
  projectB: Project;
  reason: DuplicateReason;
  severity: DuplicateSeverity;
  similarityScore: number;
  explanation: string;
  overlapBudgetAllocated: number;
  overlapBudgetActual: number;
}

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

export function normalizeProjectNameForCompare(name: string): string {
  return toArabicDigits(String(name || ''))
    .toLowerCase()
    .replace(/[\s()[\]（）\-_/.,:;'"]+/g, '')
    .trim();
}

export function extractCoreProjectName(name: string): string {
  let s = toArabicDigits(String(name || '')).toLowerCase().trim();
  // Remove generic Thai training prefixes so core course names can be compared accurately
  const genericPrefixes = [
    'โครงการฝึกอบรม',
    'โครงการพัฒนาศักยภาพบุคลากร',
    'โครงการพัฒนาศักยภาพ',
    'โครงการพัฒนา',
    'โครงการเสริมสร้าง',
    'โครงการ',
    'หลักสูตร',
    'การฝึกอบรม',
  ];
  for (const prefix of genericPrefixes) {
    s = s.replace(new RegExp(prefix, 'g'), ' ');
  }
  return s.replace(/[\s()[\]（）\-_/.,:;'"]+/g, '').trim();
}

function getBigrams(str: string): Map<string, number> {
  const map = new Map<string, number>();
  if (str.length < 2) {
    if (str.length === 1) map.set(str, 1);
    return map;
  }
  for (let i = 0; i < str.length - 1; i++) {
    const bg = str.slice(i, i + 2);
    map.set(bg, (map.get(bg) || 0) + 1);
  }
  return map;
}

export function computeNameSimilarity(nameA: string, nameB: string): number {
  const coreA = extractCoreProjectName(nameA);
  const coreB = extractCoreProjectName(nameB);
  if (!coreA || !coreB) return 0;
  if (coreA === coreB) return 1;

  const bigramsA = getBigrams(coreA);
  const bigramsB = getBigrams(coreB);
  let intersection = 0;
  let totalA = 0;
  let totalB = 0;

  bigramsA.forEach((count) => {
    totalA += count;
  });
  bigramsB.forEach((count) => {
    totalB += count;
  });

  bigramsA.forEach((countA, bg) => {
    const countB = bigramsB.get(bg) || 0;
    intersection += Math.min(countA, countB);
  });

  return totalA + totalB > 0 ? (2 * intersection) / (totalA + totalB) : 0;
}

/**
 * Distinct Thai track/level tokens that intentionally differentiate separate courses
 * (e.g. "ระดับต้น" vs "ระดับกลาง", "ตรวจสอบการเงิน" vs "ตรวจสอบผลสัมฤทธิ์").
 */
const DISTINCT_TRACK_GROUPS: string[][] = [
  ['ระดับต้น', 'ระดับกลาง', 'ระดับสูง'],
  ['ระดับพื้นฐาน', 'ระดับกลาง', 'ระดับขั้นสูง', 'ขั้นสูง'],
  ['ระดับปฏิบัติการ', 'ระดับชำนาญการพิเศษ', 'ระดับชำนาญการ'],
  ['การตรวจสอบการเงิน', 'การตรวจสอบผลสัมฤทธิ์', 'การตรวจสอบการปฏิบัติตามกฎหมาย', 'การตรวจสอบสืบสวน'],
  ['รุ่น1', 'รุ่น2', 'รุ่น3', 'รุ่น4', 'รุ่น5'],
  ['ระยะ1', 'ระยะ2', 'ระยะ3'],
  ['fundamental', 'intermediate', 'advanced'],
];

function hasExplicitDifferentTrack(nameA: string, nameB: string): boolean {
  const normA = normalizeProjectNameForCompare(nameA);
  const normB = normalizeProjectNameForCompare(nameB);

  for (const group of DISTINCT_TRACK_GROUPS) {
    // Match longest token first so "ระดับชำนาญการพิเศษ" doesn't collide with "ระดับชำนาญการ"
    const sorted = [...group].sort((a, b) => b.length - a.length);
    const tokenA = sorted.find((tok) => normA.includes(tok));
    const tokenB = sorted.find((tok) => normB.includes(tok));
    if (tokenA && tokenB && tokenA !== tokenB) {
      return true;
    }
  }
  return false;
}

export interface ProjectDuplicateCandidateInput {
  id?: string;
  code: string;
  name: string;
  category?: string;
  fundingSource: FundingSource;
  budgetAllocated: number;
  budgetActual: number;
  participantsPlanned?: number;
}

export function getDuplicateReasonLabel(reason: DuplicateReason): string {
  switch (reason) {
    case 'exact_name':
      return 'ชื่อโครงการซ้ำกัน (แม้รหัสโครงการต่างกัน)';
    case 'similar_name_and_budget':
      return 'ชื่อโครงการคล้ายกันมากและวงเงินงบประมาณตรงกัน';
    case 'very_similar_name':
      return 'ชื่อโครงการคล้ายกันมาก (อาจบันทึกซ้ำ)';
    case 'same_budget_actual':
      return 'ยอดเบิกจ่ายจริงเท่ากันเป๊ะในแหล่งงบเดียวกัน';
    case 'same_budget_and_context':
      return 'งบประมาณจัดสรรและหมวดหมู่/จำนวนผู้เข้าอบรมซ้ำกัน';
  }
}

function evaluatePair(
  a: ProjectDuplicateCandidateInput,
  b: Project
): Omit<DuplicateMatch, 'existingProject'> | null {
  if (a.id && a.id === b.id) return null;

  const normA = normalizeProjectNameForCompare(a.name);
  const normB = normalizeProjectNameForCompare(b.name);
  const coreA = extractCoreProjectName(a.name);
  const coreB = extractCoreProjectName(b.name);

  if (!normA || !normB) return null;

  const differentTrack = hasExplicitDifferentTrack(a.name, b.name);
  const similarity = computeNameSimilarity(a.name, b.name);
  const sameFunding = a.fundingSource === b.fundingSource;
  const sameAlloc = a.budgetAllocated > 0 && b.budgetAllocated > 0 && Math.abs(a.budgetAllocated - b.budgetAllocated) < 0.01;
  const sameActual = a.budgetActual > 0 && b.budgetActual > 0 && Math.abs(a.budgetActual - b.budgetActual) < 0.01;
  const sameCategory = Boolean(a.category && b.category && a.category.trim() === b.category.trim());
  const sameParticipants =
    Boolean(a.participantsPlanned && b.participantsPlanned && a.participantsPlanned > 0 && a.participantsPlanned === b.participantsPlanned);

  // 1. Exact same project name (ignoring whitespace/punctuation/generic prefix)
  if (normA === normB || (coreA.length >= 6 && coreA === coreB)) {
    const budgetNote = sameAlloc
      ? ` และงบจัดสรรเท่ากัน (฿${a.budgetAllocated.toLocaleString()})`
      : sameActual
      ? ` และยอดเบิกจ่ายจริงเท่ากัน (฿${a.budgetActual.toLocaleString()})`
      : '';
    return {
      reason: 'exact_name',
      severity: 'high',
      similarityScore: 1,
      explanation: `ชื่อโครงการตรงกับ "${b.code}"${budgetNote} แม้รหัสโครงการต่างกัน`,
    };
  }

  // 2. High name similarity + identical budget (allocated or actual), not explicitly different track
  if (!differentTrack && similarity >= 0.72 && (sameAlloc || sameActual)) {
    const amountLabel = sameActual
      ? `ยอดเบิกจ่ายจริง ฿${a.budgetActual.toLocaleString()}`
      : `งบจัดสรร ฿${a.budgetAllocated.toLocaleString()}`;
    return {
      reason: 'similar_name_and_budget',
      severity: 'high',
      similarityScore: similarity,
      explanation: `ชื่อคล้ายกับ "${b.code}" (${Math.round(similarity * 100)}%) และมี${amountLabel}เท่ากัน`,
    };
  }

  // 3. Very high name similarity (>= 88%) even if budget differs
  if (!differentTrack && similarity >= 0.88) {
    return {
      reason: 'very_similar_name',
      severity: 'high',
      similarityScore: similarity,
      explanation: `ชื่อโครงการใกล้เคียงกับ "${b.code}" มากถึง ${Math.round(similarity * 100)}% (อาจเป็นการบันทึกซ้ำภายใต้รหัสอื่น)`,
    };
  }

  // 4. Identical non-zero actual disbursement in same funding source (or identical actual + allocated)
  if (sameActual && (sameFunding || sameAlloc)) {
    return {
      reason: 'same_budget_actual',
      severity: 'high',
      similarityScore: similarity,
      explanation: `ยอดเบิกจ่ายจริงเท่ากับ "${b.code}" เป๊ะ (฿${a.budgetActual.toLocaleString()})${
        sameAlloc ? ` และงบจัดสรรเท่ากัน (฿${a.budgetAllocated.toLocaleString()})` : ''
      } กรุณาตรวจสอบว่าไม่ได้บันทึกเบิกจ่ายซ้ำซ้อน`,
    };
  }

  // 5. Same budget allocated + same funding + same category + (same participants OR moderate name overlap)
  // Guard against differentTrack so distinct official SADI courses (e.g. Online 95,000 or Basic/Inter 455,000) don't false-alarm.
  if (
    !differentTrack &&
    sameAlloc &&
    sameFunding &&
    sameCategory &&
    (similarity >= 0.45 || sameParticipants)
  ) {
    return {
      reason: 'same_budget_and_context',
      severity: 'medium',
      similarityScore: similarity,
      explanation: `งบจัดสรร ฿${a.budgetAllocated.toLocaleString()} แหล่งงบ และหมวดหมู่ตรงกับ "${b.code}"${
        sameParticipants ? ` (ผู้เข้าอบรม ${a.participantsPlanned} คนเท่ากัน)` : ''
      }`,
    };
  }

  return null;
}

/**
 * Find potential duplicates for a single candidate project (used in ProjectModal & per-row import checks).
 */
export function findDuplicateMatchesForProject(
  candidate: ProjectDuplicateCandidateInput,
  existingProjects: Project[]
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  for (const existing of existingProjects) {
    const evaluated = evaluatePair(candidate, existing);
    if (evaluated) {
      matches.push({
        existingProject: existing,
        ...evaluated,
      });
    }
  }

  return matches.sort((x, y) => {
    if (x.severity !== y.severity) return x.severity === 'high' ? -1 : 1;
    return y.similarityScore - x.similarityScore;
  });
}

/**
 * Scan an entire project collection (e.g., active DB or projected post-import list)
 * to identify all overlapping/duplicate pairs even when their codes differ.
 */
export function detectSystemDuplicates(projects: Project[]): SystemDuplicatePair[] {
  const pairs: SystemDuplicatePair[] = [];

  for (let i = 0; i < projects.length; i++) {
    const a = projects[i];
    for (let j = i + 1; j < projects.length; j++) {
      const b = projects[j];
      const evaluated = evaluatePair(a, b);
      if (evaluated) {
        pairs.push({
          id: `${a.id}__${b.id}`,
          projectA: a,
          projectB: b,
          reason: evaluated.reason,
          severity: evaluated.severity,
          similarityScore: evaluated.similarityScore,
          explanation: evaluated.explanation,
          overlapBudgetAllocated: Math.min(a.budgetAllocated, b.budgetAllocated),
          overlapBudgetActual: Math.min(a.budgetActual, b.budgetActual),
        });
      }
    }
  }

  return pairs.sort((x, y) => {
    if (x.severity !== y.severity) return x.severity === 'high' ? -1 : 1;
    return y.overlapBudgetActual - x.overlapBudgetActual || y.similarityScore - x.similarityScore;
  });
}
