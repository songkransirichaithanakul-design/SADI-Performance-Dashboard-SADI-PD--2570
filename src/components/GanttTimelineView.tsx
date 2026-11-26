import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Project, FundingSource, ProjectStatus, Quarter } from '../types';
import {
  CalendarRange,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  ArrowRight,
  Layers,
  Eye,
} from 'lucide-react';
import { ProjectSearchAutocomplete } from './ProjectSearchAutocomplete';

interface GanttTimelineViewProps {
  onOpenProjectDetail: (projectId: string) => void;
  onGoToUpdatePage?: () => void;
}

interface FiscalMonthDef {
  index: number;
  shortLabel: string;
  fullLabel: string;
  quarter: Quarter;
  tokens: string[];
}

const FISCAL_MONTHS_2570: FiscalMonthDef[] = [
  { index: 0, shortLabel: 'ต.ค. 69', fullLabel: 'ตุลาคม 2569', quarter: 'Q1', tokens: ['ต.ค.', 'ตุลาคม', 'ตค'] },
  { index: 1, shortLabel: 'พ.ย. 69', fullLabel: 'พฤศจิกายน 2569', quarter: 'Q1', tokens: ['พ.ย.', 'พฤศจิกายน', 'พย'] },
  { index: 2, shortLabel: 'ธ.ค. 69', fullLabel: 'ธันวาคม 2569', quarter: 'Q1', tokens: ['ธ.ค.', 'ธันวาคม', 'ธค'] },
  { index: 3, shortLabel: 'ม.ค. 70', fullLabel: 'มกราคม 2570', quarter: 'Q2', tokens: ['ม.ค.', 'มกราคม', 'มค'] },
  { index: 4, shortLabel: 'ก.พ. 70', fullLabel: 'กุมภาพันธ์ 2570', quarter: 'Q2', tokens: ['ก.พ.', 'กุมภาพันธ์', 'กพ'] },
  { index: 5, shortLabel: 'มี.ค. 70', fullLabel: 'มีนาคม 2570', quarter: 'Q2', tokens: ['มี.ค.', 'มีนาคม', 'มีค'] },
  { index: 6, shortLabel: 'เม.ย. 70', fullLabel: 'เมษายน 2570', quarter: 'Q3', tokens: ['เม.ย.', 'เมษายน', 'เมย'] },
  { index: 7, shortLabel: 'พ.ค. 70', fullLabel: 'พฤษภาคม 2570', quarter: 'Q3', tokens: ['พ.ค.', 'พฤษภาคม', 'พค'] },
  { index: 8, shortLabel: 'มิ.ย. 70', fullLabel: 'มิถุนายน 2570', quarter: 'Q3', tokens: ['มิ.ย.', 'มิถุนายน', 'มิย'] },
  { index: 9, shortLabel: 'ก.ค. 70', fullLabel: 'กรกฎาคม 2570', quarter: 'Q4', tokens: ['ก.ค.', 'กรกฎาคม', 'กค'] },
  { index: 10, shortLabel: 'ส.ค. 70', fullLabel: 'สิงหาคม 2570', quarter: 'Q4', tokens: ['ส.ค.', 'สิงหาคม', 'สค'] },
  { index: 11, shortLabel: 'ก.ย. 70', fullLabel: 'กันยายน 2570', quarter: 'Q4', tokens: ['ก.ย.', 'กันยายน', 'กย'] },
];

const QUARTER_MONTH_BOUNDS: Record<Quarter, [number, number]> = {
  Q1: [0, 2],
  Q2: [3, 5],
  Q3: [6, 8],
  Q4: [9, 11],
};

function resolveProjectMonthSpan(project: Project): { start: number; end: number; exactMonths: boolean } {
  const schedule = (project.executionDateSchedule || '').trim();
  const matchedIndices: number[] = [];

  FISCAL_MONTHS_2570.forEach((m) => {
    if (m.tokens.some((tok) => schedule.includes(tok))) {
      matchedIndices.push(m.index);
    }
  });

  if (matchedIndices.length > 0) {
    return {
      start: Math.min(...matchedIndices),
      end: Math.max(...matchedIndices),
      exactMonths: true,
    };
  }

  const qList = project.quarters.length > 0 ? project.quarters : (['Q1'] as Quarter[]);
  const starts = qList.map((q) => QUARTER_MONTH_BOUNDS[q][0]);
  const ends = qList.map((q) => QUARTER_MONTH_BOUNDS[q][1]);
  return {
    start: Math.min(...starts),
    end: Math.max(...ends),
    exactMonths: false,
  };
}

function computeProgressPercent(project: Project): number {
  if (project.status === 'completed') return 100;
  if (project.batchesPlanned > 0 && project.batchesActual > 0) {
    return Math.min(100, Math.round((project.batchesActual / project.batchesPlanned) * 100));
  }
  if (project.budgetAllocated > 0 && project.budgetActual > 0) {
    return Math.min(100, Math.round((project.budgetActual / project.budgetAllocated) * 100));
  }
  return project.status === 'in_progress' ? 20 : 0;
}

function cleanCategoryLabel(category: string): string {
  let clean = category.split('(')[0].replace(/^\d+\.\s*/, '').trim();
  if (clean.includes('ภารกิจตามแผนปฏิบัติราชการ')) {
    clean = 'ภารกิจแผนปฏิบัติราชการ 5 ปี';
  }
  return clean;
}

export const GanttTimelineView: React.FC<GanttTimelineViewProps> = ({
  onOpenProjectDetail,
  onGoToUpdatePage,
}) => {
  const { projects, searchQuery } = useApp();

  const [fundingFilter, setFundingFilter] = useState<FundingSource | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [quarterFilter, setQuarterFilter] = useState<Quarter | 'all'>('all');
  const [groupBy, setGroupBy] = useState<'chronological' | 'status' | 'category'>('chronological');

  const enrichedProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return projects
      .filter((p) => {
        const matchFunding = fundingFilter === 'all' || p.fundingSource === fundingFilter;
        const matchStatus = statusFilter === 'all' || p.status === statusFilter;
        const matchQuarter = quarterFilter === 'all' || p.quarters.includes(quarterFilter);
        const haystack = [
          p.code,
          p.name,
          p.category,
          p.targetGroup,
          p.executionDateSchedule,
          p.actualDateOrQuarter || '',
          p.quarters.join(' '),
        ]
          .join(' ')
          .toLowerCase();
        const matchSearch = tokens.length === 0 || tokens.every((t) => haystack.includes(t));
        return matchFunding && matchStatus && matchQuarter && matchSearch;
      })
      .map((project) => ({
        project,
        span: resolveProjectMonthSpan(project),
        progressPct: computeProgressPercent(project),
      }))
      .sort((a, b) => {
        if (a.span.start !== b.span.start) return a.span.start - b.span.start;
        if (a.span.end !== b.span.end) return a.span.end - b.span.end;
        return a.project.code.localeCompare(b.project.code);
      });
  }, [projects, fundingFilter, statusFilter, quarterFilter, searchQuery]);

  const groupedRows = useMemo(() => {
    if (groupBy === 'chronological') {
      return [{ groupTitle: '', items: enrichedProjects }];
    }

    if (groupBy === 'status') {
      const order: Array<{ key: ProjectStatus; label: string }> = [
        { key: 'in_progress', label: 'อยู่ระหว่างดำเนินการ (In Progress)' },
        { key: 'not_started', label: 'ยังไม่ได้ดำเนินการ (Planned / Upcoming)' },
        { key: 'completed', label: 'ดำเนินการเสร็จแล้ว (Completed)' },
      ];
      return order
        .map((st) => ({
          groupTitle: st.label,
          items: enrichedProjects.filter((item) => item.project.status === st.key),
        }))
        .filter((g) => g.items.length > 0);
    }

    const map = new Map<string, typeof enrichedProjects>();
    enrichedProjects.forEach((item) => {
      const key = cleanCategoryLabel(item.project.category);
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([groupTitle, items]) => ({ groupTitle, items }));
  }, [enrichedProjects, groupBy]);

  const summary = useMemo(() => {
    const total = enrichedProjects.length;
    const completed = enrichedProjects.filter((x) => x.project.status === 'completed').length;
    const inProgress = enrichedProjects.filter((x) => x.project.status === 'in_progress').length;
    const notStarted = enrichedProjects.filter((x) => x.project.status === 'not_started').length;
    const quarterCounts = (['Q1', 'Q2', 'Q3', 'Q4'] as Quarter[]).map((q) => ({
      quarter: q,
      count: enrichedProjects.filter((x) => x.project.quarters.includes(q)).length,
    }));
    return { total, completed, inProgress, notStarted, quarterCounts };
  }, [enrichedProjects]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Carbon Blue Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-[#091122] border border-cyan-900/40 p-5 sm:p-6 shadow-[0_10px_40px_rgba(4,10,24,0.6)]">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-cyan-300/90">
              <span>สถาบันพัฒนาการตรวจเงินแผ่นดิน (SADI)</span>
              <span className="text-cyan-700" aria-hidden="true">·</span>
              <span className="font-mono text-cyan-400">Gantt Timeline ปีงบประมาณ 2570 (ต.ค. 69 – ก.ย. 70)</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-white tracking-tight text-balance">
              ไทม์ไลน์แผนการดำเนินงานและสถานะโครงการรายเดือน (Gantt Chart)
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              ติดตามช่วงเวลาดำเนินการ สถานะความคืบหน้า และรุ่นที่จัดอบรมของทุกโครงการในมุมมองปฏิทิน 12 เดือน · คลิกที่แถวโครงการเพื่อดูรายละเอียด
            </p>
          </div>
        </div>
      </div>

      {/* 4 Status Summary Filter Cards (Carbon Blue) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`text-left bg-[#0A1326] rounded-2xl p-4 border transition-all cursor-pointer shadow-md ${
            statusFilter === 'all' ? 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.18)]' : 'border-cyan-900/50 hover:border-cyan-600/70'
          }`}
        >
          <div className="text-xs text-slate-400 font-medium">โครงการในไทม์ไลน์</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-white tabular-nums">{summary.total}</span>
            <span className="text-[11px] text-slate-400">รายการ</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
          className={`text-left bg-[#0A1326] rounded-2xl p-4 border transition-all cursor-pointer shadow-md ${
            statusFilter === 'completed' ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-cyan-900/50 hover:border-emerald-500/70'
          }`}
        >
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>ดำเนินการเสร็จแล้ว</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-emerald-400 tabular-nums">{summary.completed}</span>
            <span className="text-[11px] font-mono text-emerald-300 tabular-nums">
              {summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0}%
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
          className={`text-left bg-[#0A1326] rounded-2xl p-4 border transition-all cursor-pointer shadow-md ${
            statusFilter === 'in_progress' ? 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]' : 'border-cyan-900/50 hover:border-cyan-500/70'
          }`}
        >
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>อยู่ระหว่างดำเนินการ</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-cyan-300 tabular-nums">{summary.inProgress}</span>
            <span className="text-[11px] font-mono text-cyan-300 tabular-nums">
              {summary.total > 0 ? Math.round((summary.inProgress / summary.total) * 100) : 0}%
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'not_started' ? 'all' : 'not_started')}
          className={`text-left bg-[#0A1326] rounded-2xl p-4 border transition-all cursor-pointer shadow-md ${
            statusFilter === 'not_started' ? 'border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'border-cyan-900/50 hover:border-amber-500/70'
          }`}
        >
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>ยังไม่ได้ดำเนินการ</span>
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-black font-mono text-amber-300 tabular-nums">{summary.notStarted}</span>
            <span className="text-[11px] font-mono text-amber-300 tabular-nums">
              {summary.total > 0 ? Math.round((summary.notStarted / summary.total) * 100) : 0}%
            </span>
          </div>
        </button>
      </div>

      {/* Filter & Grouping Bar (Carbon Blue) */}
      <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex-1">
            <ProjectSearchAutocomplete
              variant="dark"
              onSelectProject={(project) => onOpenProjectDetail(project.id)}
              placeholder="ค้นหาโครงการในไทม์ไลน์ด้วยรหัส ชื่อหลักสูตร กลุ่มเป้าหมาย หรือเดือน..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
            <div className="inline-flex p-1 bg-[#060B16] rounded-xl border border-cyan-950">
              {(['all', 'budget_annual', 'budget_fund'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFundingFilter(f)}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    fundingFilter === f
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-700/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f === 'all' ? 'ทุกแหล่งงบ' : f === 'budget_annual' ? 'งบประจำปี' : 'เงินกองทุน สตง.'}
                </button>
              ))}
            </div>

            <div className="inline-flex p-1 bg-[#060B16] rounded-xl border border-cyan-950 font-mono">
              {(['all', 'Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuarterFilter(q)}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    quarterFilter === q
                      ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-700/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {q === 'all' ? 'ทุก Q' : q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-cyan-950/80 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-300">
            <span className="font-semibold text-cyan-300 inline-flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-cyan-400" /> สัญลักษณ์สถานะ:
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
              <span>ดำเนินการเสร็จแล้ว</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded-sm bg-cyan-500 inline-block" />
              <span>อยู่ระหว่างดำเนินการ</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-2.5 rounded-sm bg-amber-400/90 border border-amber-500 inline-block" />
              <span>ยังไม่ได้ดำเนินการ (แผนล่วงหน้า)</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">จัดเรียง:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'chronological' | 'status' | 'category')}
              className="px-2.5 py-1.5 rounded-lg border border-cyan-900/70 bg-[#060D1A] text-white text-xs font-medium focus:outline-hidden focus:border-cyan-400 cursor-pointer"
            >
              <option value="chronological">เรียงตามช่วงเวลาเริ่ม (ต.ค. → ก.ย.)</option>
              <option value="status">จัดกลุ่มตามสถานะโครงการ</option>
              <option value="category">จัดกลุ่มตามหมวดหมู่สมรรถนะ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main 12-Month Carbon Blue Gantt Chart Table */}
      <div className="bg-[#091224] border border-cyan-900/50 rounded-2xl shadow-[0_10px_40px_rgba(4,10,24,0.5)] overflow-hidden">
        {enrichedProjects.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CalendarRange className="w-8 h-8 text-cyan-700 mx-auto" />
            <div className="text-sm font-semibold text-white">ไม่พบโครงการที่ตรงกับตัวกรองในไทม์ไลน์</div>
            <p className="text-xs text-slate-400">ลองปรับเงื่อนไขแหล่งงบ ไตรมาส หรือสถานะโครงการใหม่อีกครั้ง</p>
          </div>
        ) : (
          <div className="overflow-x-auto prominent-scrollbar">
            <div className="min-w-[1060px]">
              {/* Quarter Header Row */}
              <div className="grid grid-cols-[340px_1fr] bg-[#050B16] text-white border-b border-cyan-950">
                <div className="px-4 py-2.5 text-xs font-bold flex items-center justify-between border-r border-cyan-950">
                  <span>โครงการ / หลักสูตร ({enrichedProjects.length})</span>
                  <span className="text-[11px] font-normal text-slate-400">สถานะ · งบประมาณ</span>
                </div>
                <div className="grid grid-cols-4 divide-x divide-cyan-950 text-center text-xs font-mono font-bold">
                  <div className="py-2 text-cyan-300">
                    Q1 · ต.ค. – ธ.ค. 69 ({summary.quarterCounts[0].count})
                  </div>
                  <div className="py-2 text-blue-300">
                    Q2 · ม.ค. – มี.ค. 70 ({summary.quarterCounts[1].count})
                  </div>
                  <div className="py-2 text-purple-300">
                    Q3 · เม.ย. – มิ.ย. 70 ({summary.quarterCounts[2].count})
                  </div>
                  <div className="py-2 text-emerald-300">
                    Q4 · ก.ค. – ก.ย. 70 ({summary.quarterCounts[3].count})
                  </div>
                </div>
              </div>

              {/* 12 Months Sub-Header Row */}
              <div className="grid grid-cols-[340px_1fr] bg-[#071124] border-b border-cyan-900/60 sticky top-0 z-10">
                <div className="px-4 py-2 text-[11px] font-semibold text-cyan-300/80 border-r border-cyan-950 flex items-center justify-between">
                  <span>คลิกที่แถวเพื่อเปิดรายละเอียดโครงการ</span>
                  <span>รุ่นจริง/แผน</span>
                </div>
                <div className="grid grid-cols-12 divide-x divide-cyan-950/80 text-center">
                  {FISCAL_MONTHS_2570.map((m) => (
                    <div
                      key={m.index}
                      className={`py-2 text-[11px] font-mono font-semibold ${
                        m.index % 3 === 0 ? 'text-cyan-200 bg-[#0A1730]/70' : 'text-slate-400'
                      }`}
                    >
                      {m.shortLabel}
                    </div>
                  ))}
                </div>
              </div>

              {/* Grouped Gantt Rows */}
              <div className="divide-y divide-cyan-950/70">
                {groupedRows.map((group) => (
                  <React.Fragment key={group.groupTitle || 'all'}>
                    {group.groupTitle && (
                      <div className="px-4 py-2 bg-[#060E1F] border-y border-cyan-900/50 text-xs font-bold text-cyan-300 flex items-center justify-between">
                        <span>{group.groupTitle}</span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {group.items.length} โครงการ
                        </span>
                      </div>
                    )}

                    {group.items.map(({ project, span, progressPct }) => {
                      const leftPct = (span.start / 12) * 100;
                      const widthPct = ((span.end - span.start + 1) / 12) * 100;

                      const statusMeta =
                        project.status === 'completed'
                          ? {
                              label: 'เสร็จแล้ว',
                              textClass: 'text-emerald-400',
                              barTrack: 'bg-emerald-950/70 border-emerald-500/70',
                              barFill: 'bg-emerald-500/80',
                              barText: 'text-white',
                            }
                          : project.status === 'in_progress'
                          ? {
                              label: 'กำลังดำเนินการ',
                              textClass: 'text-cyan-300',
                              barTrack: 'bg-cyan-950/60 border-cyan-500/60',
                              barFill: 'bg-gradient-to-r from-cyan-500/50 to-blue-500/50',
                              barText: 'text-cyan-100',
                            }
                          : {
                              label: 'ยังไม่เริ่ม',
                              textClass: 'text-amber-300',
                              barTrack: 'bg-amber-950/40 border-amber-500/50',
                              barFill: 'bg-amber-500/25',
                              barText: 'text-amber-100',
                            };

                      return (
                        <div
                          key={project.id}
                          onClick={() => onOpenProjectDetail(project.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOpenProjectDetail(project.id);
                            }
                          }}
                          className="grid grid-cols-[340px_1fr] hover:bg-[#0C1B38]/80 transition-colors cursor-pointer group"
                        >
                          {/* Left Project Summary Cell */}
                          <div className="px-4 py-3 border-r border-cyan-950/80 space-y-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-mono font-bold text-cyan-300 shrink-0">
                                  {project.code}
                                </span>
                                <span className="text-slate-600" aria-hidden="true">·</span>
                                <span className={`font-semibold whitespace-nowrap ${statusMeta.textClass}`}>
                                  {statusMeta.label}
                                </span>
                              </div>
                              <span className="font-mono text-slate-300 tabular-nums shrink-0">
                                {project.batchesActual}/{project.batchesPlanned} รุ่น
                              </span>
                            </div>

                            <div className="text-xs font-semibold text-white group-hover:text-cyan-200 leading-snug line-clamp-2 transition-colors">
                              {project.name}
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                              <span className="truncate max-w-[195px] font-sans">
                                {project.fundingSource === 'budget_annual' ? 'งบประจำปี' : 'เงินกองทุน สตง.'}
                              </span>
                              <span className="font-semibold text-emerald-400">
                                ฿{project.budgetAllocated.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Right 12-Month Gantt Track */}
                          <div className="relative grid grid-cols-12 divide-x divide-cyan-950/50 items-center py-2.5 bg-[#060D1A]/50">
                            {FISCAL_MONTHS_2570.map((m) => (
                              <div
                                key={m.index}
                                className={`h-full ${
                                  m.index === 3 || m.index === 6 || m.index === 9
                                    ? 'border-l border-cyan-900/70'
                                    : ''
                                }`}
                              />
                            ))}

                            {/* Positioned Gantt Bar */}
                            <div
                              className="absolute inset-y-0 flex items-center px-1.5 pointer-events-none"
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                              }}
                            >
                              <div
                                className={`relative w-full h-9 rounded-lg border overflow-hidden shadow-sm flex items-center px-2.5 transition-transform group-hover:scale-[1.01] ${statusMeta.barTrack}`}
                                title={`${project.name}\nกำหนดการ: ${project.executionDateSchedule}\nดำเนินการจริง: ${project.actualDateOrQuarter || '-'}`}
                              >
                                <div
                                  className={`absolute inset-y-0 left-0 transition-all duration-300 ${statusMeta.barFill}`}
                                  style={{
                                    width: `${
                                      project.status === 'completed'
                                        ? 100
                                        : project.status === 'in_progress'
                                        ? Math.max(progressPct, 30)
                                        : 100
                                    }%`,
                                  }}
                                />

                                <div
                                  className={`relative z-10 w-full flex items-center justify-between gap-2 text-[11px] font-semibold truncate ${statusMeta.barText}`}
                                >
                                  <span className="truncate">
                                    {project.executionDateSchedule || project.quarters.join(', ')}
                                  </span>
                                  <span className="font-mono text-[10px] shrink-0 opacity-90 hidden sm:inline">
                                    {project.status === 'completed'
                                      ? '100%'
                                      : project.status === 'in_progress'
                                      ? `${progressPct}%`
                                      : project.quarters.join('/')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Subtle right inspect icon on hover */}
                            <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#091224]/95 border border-cyan-500/60 text-cyan-300 text-[10px] font-semibold shadow-sm">
                                <Eye className="w-3 h-3" /> ดูรายละเอียด
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
