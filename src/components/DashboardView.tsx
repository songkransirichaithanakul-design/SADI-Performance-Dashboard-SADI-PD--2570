import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { FundingSource, Quarter, ProjectStatus } from '../types';
import {
  TrendingUp,
  DollarSign,
  Users,
  PieChart,
  Layers,
  ArrowRight,
  Filter,
  FileSpreadsheet,
  Sliders,
  ShieldCheck,
  Zap,
  MousePointerClick,
} from 'lucide-react';
import { ProjectSearchAutocomplete } from './ProjectSearchAutocomplete';

interface DashboardNavigateFilter {
  funding?: FundingSource | 'all';
  status?: ProjectStatus | 'all';
  quarter?: Quarter | 'all';
  category?: string | 'all';
}

interface DashboardViewProps {
  onNavigateToProjects: (filter?: DashboardNavigateFilter) => void;
  onOpenProjectDetail: (projectId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToProjects,
  onOpenProjectDetail,
}) => {
  const {
    projects,
    selectedFundingFilter,
    setSelectedFundingFilter,
    selectedQuarterFilter,
    setSelectedQuarterFilter,
    exportDataToCSV,
  } = useApp();

  // Interactive Scenario Simulator State (disbursement simulation rate 0% - 100%)
  const [simulatedRate, setSimulatedRate] = useState<number>(0);

  // Filtered projects for dashboard based on selected funding source & quarter
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchFunding = selectedFundingFilter === 'all' || p.fundingSource === selectedFundingFilter;
      const matchQuarter = selectedQuarterFilter === 'all' || p.quarters.includes(selectedQuarterFilter);
      return matchFunding && matchQuarter;
    });
  }, [projects, selectedFundingFilter, selectedQuarterFilter]);

  // Key KPI Calculations
  const metrics = useMemo(() => {
    const totalAllocated = filteredProjects.reduce((sum, p) => sum + p.budgetAllocated, 0);
    const totalActual = filteredProjects.reduce((sum, p) => sum + p.budgetActual, 0);
    const totalRemaining = totalAllocated - totalActual;
    const disbursementRate = totalAllocated > 0 ? (totalActual / totalAllocated) * 100 : 0;

    const totalCount = filteredProjects.length;
    const completedCount = filteredProjects.filter((p) => p.status === 'completed').length;
    const inProgressCount = filteredProjects.filter((p) => p.status === 'in_progress').length;
    const notStartedCount = filteredProjects.filter((p) => p.status === 'not_started').length;

    const targetPersonnel = filteredProjects.reduce((sum, p) => sum + p.participantsPlanned, 0);

    return {
      totalAllocated,
      totalActual,
      totalRemaining,
      disbursementRate,
      totalCount,
      completedCount,
      inProgressCount,
      notStartedCount,
      targetPersonnel,
    };
  }, [filteredProjects]);

  // Funding comparison metrics (for Donut Ring Chart)
  const fundingBreakdown = useMemo(() => {
    const quarterFiltered = projects.filter(
      (p) => selectedQuarterFilter === 'all' || p.quarters.includes(selectedQuarterFilter)
    );
    const annualProjects = quarterFiltered.filter((p) => p.fundingSource === 'budget_annual');
    const fundProjects = quarterFiltered.filter((p) => p.fundingSource === 'budget_fund');

    const annualAllocated = annualProjects.reduce((s, p) => s + p.budgetAllocated, 0);
    const fundAllocated = fundProjects.reduce((s, p) => s + p.budgetAllocated, 0);
    const combined = annualAllocated + fundAllocated;

    return {
      totalCount: quarterFiltered.length,
      annual: {
        count: annualProjects.length,
        allocated: annualAllocated,
        share: combined > 0 ? (annualAllocated / combined) * 100 : 0,
      },
      fund: {
        count: fundProjects.length,
        allocated: fundAllocated,
        share: combined > 0 ? (fundAllocated / combined) * 100 : 0,
      },
      combined,
    };
  }, [projects, selectedQuarterFilter]);

  // Quarterly data for interactive Bar Chart & dynamic S-Curve
  const quarterlyTrend = useMemo(() => {
    const quarterDefs: { q: Quarter; label: string; color: string }[] = [
      { q: 'Q1', label: 'ต.ค.-ธ.ค. 69', color: '#06B6D4' },
      { q: 'Q2', label: 'ม.ค.-มี.ค. 70', color: '#3B82F6' },
      { q: 'Q3', label: 'เม.ย.-มิ.ย. 70', color: '#8B5CF6' },
      { q: 'Q4', label: 'ก.ค.-ก.ย. 70', color: '#10B981' },
    ];

    const fundingProjects = projects.filter(
      (p) => selectedFundingFilter === 'all' || p.fundingSource === selectedFundingFilter
    );

    let cumAllocated = 0;
    let cumActual = 0;

    const rawList = quarterDefs.map((item) => {
      const qProjects = fundingProjects.filter((p) => p.quarters.includes(item.q));
      const qAllocated = qProjects.reduce((s, p) => s + p.budgetAllocated, 0);
      const qActual = qProjects.reduce((s, p) => s + p.budgetActual, 0);
      const inProgress = qProjects.filter((p) => p.status === 'in_progress').length;
      const notStarted = qProjects.filter((p) => p.status === 'not_started').length;
      const completed = qProjects.filter((p) => p.status === 'completed').length;

      cumAllocated += qAllocated;
      cumActual += qActual;

      return {
        quarter: item.q,
        label: item.label,
        color: item.color,
        count: qProjects.length,
        allocated: qAllocated,
        actual: qActual,
        inProgress,
        notStarted,
        completed,
        cumAllocated,
        cumActual,
      };
    });

    const maxAllocated = Math.max(...rawList.map((d) => d.allocated), 1);
    const maxCumAllocated = Math.max(...rawList.map((d) => d.cumAllocated), 1);

    const list = rawList.map((d, idx) => {
      const x = 45 + idx * 135;
      const yPlan = 86 - (d.cumAllocated / maxCumAllocated) * 72;
      const yActual = 86 - (d.cumActual / maxCumAllocated) * 72;
      return { ...d, x, yPlan, yActual };
    });

    return { list, maxAllocated, maxCumAllocated };
  }, [projects, selectedFundingFilter]);

  // Competency Categories breakdown (merged by clean name, sorted by budget share descending, numbered 1..N)
  const categoryBreakdown = useMemo(() => {
    const colorPalette = ['#10B981', '#3B82F6', '#06B6D4', '#8B5CF6', '#F59E0B', '#0EA5E9', '#EC4899', '#F97316'];
    const map = new Map<string, { filterKey: string; count: number; allocated: number }>();

    filteredProjects.forEach((p) => {
      let cleanCat = p.category.split('(')[0].replace(/^\d+\.\s*/, '').trim();
      if (cleanCat.includes('ภารกิจตามแผนปฏิบัติราชการ')) {
        cleanCat = 'ภารกิจแผนปฏิบัติราชการ 5 ปี';
      }
      const existing = map.get(cleanCat) || { filterKey: cleanCat, count: 0, allocated: 0 };
      existing.count += 1;
      existing.allocated += p.budgetAllocated;
      map.set(cleanCat, existing);
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1].allocated - a[1].allocated)
      .map(([cleanName, data], index) => ({
        rank: index + 1,
        name: `${index + 1}. ${cleanName}`,
        ...data,
        color: colorPalette[index % colorPalette.length],
        share: metrics.totalAllocated > 0 ? (data.allocated / metrics.totalAllocated) * 100 : 0,
      }));
  }, [filteredProjects, metrics.totalAllocated]);

  // Donut Ring Geometry
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const annualStroke = (fundingBreakdown.annual.share / 100) * circumference;

  // Scenario Simulator calculations
  const simulatedBurn = (metrics.totalAllocated * simulatedRate) / 100;
  const simulatedRemaining = metrics.totalAllocated - simulatedBurn;

  // Dynamic SVG S-Curve path strings
  const planPath = useMemo(() => {
    const pts = quarterlyTrend.list;
    if (pts.length === 0) return '';
    return `M 15 88 ` + pts.map((p) => `L ${p.x} ${p.yPlan.toFixed(1)}`).join(' ');
  }, [quarterlyTrend.list]);

  const planAreaPath = useMemo(() => {
    const pts = quarterlyTrend.list;
    if (pts.length === 0) return '';
    const last = pts[pts.length - 1];
    return `${planPath} L ${last.x} 88 L 15 88 Z`;
  }, [planPath, quarterlyTrend.list]);

  const actualPath = useMemo(() => {
    const pts = quarterlyTrend.list;
    if (pts.length === 0) return '';
    return `M 15 88 ` + pts.map((p) => `L ${p.x} ${p.yActual.toFixed(1)}`).join(' ');
  }, [quarterlyTrend.list]);

  const annualCountTotal = projects.filter((p) => p.fundingSource === 'budget_annual').length;
  const fundCountTotal = projects.filter((p) => p.fundingSource === 'budget_fund').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Executive Official Report Header & Quick Filters */}
      <div className="relative overflow-hidden rounded-2xl bg-[#091122] border border-cyan-900/40 p-5 sm:p-6 shadow-[0_10px_40px_rgba(4,10,24,0.6)]">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div className="space-y-2 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-cyan-300/90">
              <span>สถาบันพัฒนาการตรวจเงินแผ่นดิน (SADI)</span>
              <span className="text-cyan-700" aria-hidden="true">·</span>
              <span className="font-mono text-cyan-400">ปีงบประมาณ 2570</span>
              <span className="text-cyan-700" aria-hidden="true">·</span>
              <span className="text-slate-300">{projects.length} โครงการ</span>
            </div>
            <h1 className="text-base sm:text-xl lg:text-[22px] font-extrabold text-white tracking-tight leading-snug text-balance">
              รายงานความก้าวหน้าการดำเนินแผนพัฒนาศักยภาพบุคลากรของสำนักงานการตรวจเงินแผ่นดิน ประจำปีงบประมาณ พ.ศ. 2570 ตามงบประมาณรายจ่ายประจำปีงบประมาณ พ.ศ. 2570
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-1">
            <button
              onClick={exportDataToCSV}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-cyan-800/60 bg-[#0A1730] text-cyan-200 hover:bg-[#0E2248] hover:text-white flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              <span>ส่งออก CSV</span>
            </button>
            <button
              onClick={() => onNavigateToProjects({ funding: selectedFundingFilter, quarter: selectedQuarterFilter, status: 'all', category: 'all' })}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>ดูข้อมูลโครงการทั้งหมด</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Single Smart Search + Filter Toolbar */}
        <div className="mt-4 pt-4 border-t border-cyan-950/80 space-y-3">
          <ProjectSearchAutocomplete
            onSelectProject={(project) => onOpenProjectDetail(project.id)}
            onViewAllMatches={() =>
              onNavigateToProjects({
                funding: selectedFundingFilter,
                quarter: selectedQuarterFilter,
                status: 'all',
                category: 'all',
              })
            }
            placeholder="พิมพ์คีย์เวิร์ดเพื่อค้นหาหรือเสนอรายการโครงการ (เช่น การเงิน, AI, Q1, GOV-70-01)..."
            className="w-full"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-cyan-200/80 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-cyan-400" /> แหล่งงบ:
              </span>
              <div className="inline-flex p-1 bg-[#060B16] rounded-xl border border-cyan-950 text-xs">
                <button
                  onClick={() => setSelectedFundingFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    selectedFundingFilter === 'all'
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-700/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ทั้งหมด ({projects.length})
                </button>
                <button
                  onClick={() => setSelectedFundingFilter('budget_annual')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    selectedFundingFilter === 'budget_annual'
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-700/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  งบประมาณประจำปี ({annualCountTotal})
                </button>
                <button
                  onClick={() => setSelectedFundingFilter('budget_fund')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    selectedFundingFilter === 'budget_fund'
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-700/50'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  เงินกองทุน สตง. ({fundCountTotal})
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-cyan-200/80">ไตรมาส:</span>
              <div className="inline-flex p-1 bg-[#060B16] rounded-xl border border-cyan-950 font-mono">
                {(['all', 'Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setSelectedQuarterFilter(q)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      selectedQuarterFilter === q
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
        </div>
      </div>

      {/* 4 Primary Non-Duplicative KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Allocated (Clickable -> drill down) */}
        <button
          type="button"
          onClick={() => onNavigateToProjects({ funding: selectedFundingFilter, quarter: selectedQuarterFilter, status: 'all', category: 'all' })}
          className="text-left bg-[#0A1326] border border-cyan-900/50 hover:border-cyan-500/70 rounded-2xl p-5 shadow-lg transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 group-hover:text-cyan-300 transition-colors">งบประมาณจัดสรรรวม</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-white tabular-nums">
              ฿{metrics.totalAllocated.toLocaleString()}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
              <span className="group-hover:text-white transition-colors">{metrics.totalCount} โครงการ →</span>
              <span className="font-mono text-cyan-400 font-semibold tabular-nums">เป้าหมาย {metrics.targetPersonnel.toLocaleString()} คน</span>
            </div>
          </div>
        </button>

        {/* KPI 2: Actual Spent */}
        <div className="bg-[#0A1326] border border-cyan-900/50 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">เบิกจ่ายจริง (ปี 2570)</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-slate-200 tabular-nums">
              ฿{metrics.totalActual.toLocaleString()}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-400">อัตราเบิกจ่าย:</span>
              <span className="font-mono font-semibold text-cyan-300 tabular-nums">
                {metrics.disbursementRate.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="w-full bg-[#060C18] h-1.5 rounded-full mt-2.5 overflow-hidden border border-cyan-950">
            <div
              className="bg-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(metrics.disbursementRate, 100)}%` }}
            />
          </div>
        </div>

        {/* KPI 3: Remaining Budget */}
        <div className="bg-[#0A1326] border border-cyan-900/50 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">งบประมาณคงเหลือพร้อมใช้</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black font-mono text-emerald-400 tabular-nums">
              ฿{metrics.totalRemaining.toLocaleString()}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
              <span>สัดส่วนคงเหลือ:</span>
              <span className="font-mono font-bold text-emerald-400 tabular-nums">
                {(100 - metrics.disbursementRate).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="w-full bg-[#060C18] h-1.5 rounded-full mt-2.5 overflow-hidden border border-cyan-950">
            <div
              className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100 - metrics.disbursementRate, 100)}%` }}
            />
          </div>
        </div>

        {/* KPI 4: Interactive Status Breakdown */}
        <div className="bg-[#0A1326] border border-cyan-900/50 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">คลิกดูตามสถานะโครงการ</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-3 text-center">
            <button
              type="button"
              onClick={() => onNavigateToProjects({ funding: selectedFundingFilter, quarter: selectedQuarterFilter, status: 'in_progress', category: 'all' })}
              className="p-1.5 rounded-lg bg-cyan-950/50 border border-cyan-800/50 hover:border-cyan-400 hover:bg-cyan-900/40 transition-colors cursor-pointer"
            >
              <div className="text-base font-bold font-mono text-cyan-300 tabular-nums">{metrics.inProgressCount}</div>
              <div className="text-[10px] text-slate-300">กำลังทำ</div>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToProjects({ funding: selectedFundingFilter, quarter: selectedQuarterFilter, status: 'not_started', category: 'all' })}
              className="p-1.5 rounded-lg bg-amber-950/40 border border-amber-800/40 hover:border-amber-400 hover:bg-amber-900/30 transition-colors cursor-pointer"
            >
              <div className="text-base font-bold font-mono text-amber-300 tabular-nums">{metrics.notStartedCount}</div>
              <div className="text-[10px] text-slate-300">ยังไม่เริ่ม</div>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToProjects({ funding: selectedFundingFilter, quarter: selectedQuarterFilter, status: 'completed', category: 'all' })}
              className="p-1.5 rounded-lg bg-emerald-950/30 border border-emerald-800/30 hover:border-emerald-400 hover:bg-emerald-900/30 transition-colors cursor-pointer"
            >
              <div className="text-base font-bold font-mono text-emerald-300 tabular-nums">{metrics.completedCount}</div>
              <div className="text-[10px] text-slate-300">เสร็จแล้ว</div>
            </button>
          </div>
        </div>
      </div>

      {/* Charts Row 1: Interactive Quarterly Bar & S-Curve + Clickable Dual Funding Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Interactive Quarterly Allocation Bars + Status-by-Quarter Drilldown + Dynamic S-Curve */}
        <div className="lg:col-span-2 bg-[#091224] border border-cyan-900/40 rounded-2xl p-6 shadow-md space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>แผนงบประมาณรายไตรมาสและสถานะโครงการ (คลิกดูรายละเอียดรายไตรมาสได้)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>กดที่แท่งไตรมาส (เช่น Q1 {quarterlyTrend.list[0]?.count || 0} โครงการ) หรือกดปุ่มสถานะในแต่ละไตรมาสเพื่อเปิดดูรายละเอียดทุกโครงการ</span>
              </p>
            </div>
          </div>

          {/* Interactive Colorful Quarterly Cards with Embedded Status Drilldown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {quarterlyTrend.list.map((q) => {
              const barHeight = Math.max(14, Math.round((q.allocated / quarterlyTrend.maxAllocated) * 100));
              const isSelectedQuarter = selectedQuarterFilter === q.quarter;
              return (
                <div
                  key={q.quarter}
                  className={`flex flex-col justify-between bg-[#060D1A] p-3 rounded-xl border transition-all ${
                    isSelectedQuarter
                      ? 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                      : 'border-cyan-950 hover:border-cyan-600/70'
                  }`}
                >
                  {/* Clickable top bar & project count trigger */}
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateToProjects({
                        quarter: q.quarter,
                        funding: selectedFundingFilter,
                        status: 'all',
                        category: 'all',
                      })
                    }
                    className="w-full flex flex-col items-center space-y-2 cursor-pointer group focus-visible:outline-2 focus-visible:outline-cyan-400 rounded-lg"
                    title={`คลิกเพื่อดูรายละเอียดโครงการใน ${q.quarter} ทั้งหมด ${q.count} โครงการ`}
                  >
                    <div className="text-[11px] font-mono font-bold text-white tabular-nums">
                      ฿{(q.allocated / 1000000).toFixed(2)}M
                    </div>
                    <div className="w-full h-24 flex items-end justify-center px-3">
                      <div
                        className="w-full max-w-[44px] rounded-t-lg transition-all duration-300 group-hover:scale-105 group-hover:brightness-110 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                        style={{
                          height: `${barHeight}%`,
                          background: `linear-gradient(180deg, ${q.color}, ${q.color}66)`,
                        }}
                      />
                    </div>
                    <div className="text-center w-full">
                      <div className="text-xs font-mono font-bold flex items-center justify-center gap-1" style={{ color: q.color }}>
                        <span>{q.quarter}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({q.label})</span>
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-950/70 border border-cyan-800/60 group-hover:border-cyan-400 text-[11px] text-cyan-200 font-mono font-semibold tabular-nums transition-colors">
                        <span>{q.count} โครงการ</span>
                        <ArrowRight className="w-3 h-3 text-cyan-400" />
                      </div>
                    </div>
                  </button>

                  {/* Quarter Status Drilldown Buttons */}
                  <div className="mt-2.5 pt-2 border-t border-cyan-950/80 grid grid-cols-3 gap-1 text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateToProjects({
                          quarter: q.quarter,
                          funding: selectedFundingFilter,
                          status: 'in_progress',
                          category: 'all',
                        })
                      }
                      title={`${q.quarter}: กำลังทำ ${q.inProgress} โครงการ`}
                      className="py-1 px-1 rounded bg-cyan-950/50 hover:bg-cyan-500/25 border border-cyan-900/50 hover:border-cyan-400 text-cyan-300 text-center cursor-pointer transition-colors tabular-nums"
                    >
                      <span className="block font-bold">{q.inProgress}</span>
                      <span className="text-[9px] text-slate-400 block">กำลังทำ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateToProjects({
                          quarter: q.quarter,
                          funding: selectedFundingFilter,
                          status: 'not_started',
                          category: 'all',
                        })
                      }
                      title={`${q.quarter}: ยังไม่เริ่ม ${q.notStarted} โครงการ`}
                      className="py-1 px-1 rounded bg-amber-950/35 hover:bg-amber-500/25 border border-amber-900/40 hover:border-amber-400 text-amber-300 text-center cursor-pointer transition-colors tabular-nums"
                    >
                      <span className="block font-bold">{q.notStarted}</span>
                      <span className="text-[9px] text-slate-400 block">ยังไม่เริ่ม</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateToProjects({
                          quarter: q.quarter,
                          funding: selectedFundingFilter,
                          status: 'completed',
                          category: 'all',
                        })
                      }
                      title={`${q.quarter}: เสร็จแล้ว ${q.completed} โครงการ`}
                      className="py-1 px-1 rounded bg-emerald-950/30 hover:bg-emerald-500/25 border border-emerald-900/40 hover:border-emerald-400 text-emerald-300 text-center cursor-pointer transition-colors tabular-nums"
                    >
                      <span className="block font-bold">{q.completed}</span>
                      <span className="text-[9px] text-slate-400 block">เสร็จแล้ว</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dynamic Clickable S-Curve Cumulative Trajectory SVG */}
          <div className="pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 mb-1.5">
              <span>เส้นทางแผนงบสะสมรายไตรมาส (S-Curve Trajectory) — คลิกจุดไตรมาสเพื่อดูโครงการ</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-cyan-400">
                  <span className="w-2.5 h-1 bg-cyan-400 rounded-full" /> แผนสะสม
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2.5 h-1 bg-emerald-400 rounded-full" /> เบิกจ่ายจริง ({metrics.disbursementRate.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div className="h-32 w-full bg-[#050B17] rounded-xl p-3 relative border border-cyan-950/80">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="scurveArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="scurveLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#06B6D4" />
                    <stop offset="50%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>
                </defs>
                <line x1="0" y1="25" x2="500" y2="25" stroke="#1E293B" strokeDasharray="3 3" />
                <line x1="0" y1="58" x2="500" y2="58" stroke="#1E293B" strokeDasharray="3 3" />
                <path d={planAreaPath} fill="url(#scurveArea)" />
                <path d={planPath} fill="none" stroke="url(#scurveLine)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d={actualPath} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 2" />
                {quarterlyTrend.list.map((q) => (
                  <g
                    key={q.quarter}
                    onClick={() =>
                      onNavigateToProjects({
                        quarter: q.quarter,
                        funding: selectedFundingFilter,
                        status: 'all',
                        category: 'all',
                      })
                    }
                    className="cursor-pointer group"
                  >
                    <circle cx={q.x} cy={q.yPlan} r="12" fill="transparent" />
                    <circle cx={q.x} cy={q.yPlan} r="4.5" fill={q.color} stroke="#050B17" strokeWidth="1.5" />
                    <text
                      x={q.x}
                      y={Math.max(12, q.yPlan - 8)}
                      textAnchor="middle"
                      fill="#E2E8F0"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {q.quarter} ({q.count})
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* Chart 2: Clickable Dual Funding Sources Donut Ring Chart */}
        <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-6 shadow-md flex flex-col justify-between space-y-4">
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <PieChart className="w-4 h-4 text-cyan-400" />
              <span>สัดส่วน 2 แหล่งงบประมาณ</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              คลิกที่วงแหวนหรือรายการด้านล่างเพื่อดูรายละเอียดโครงการตามแหล่งงบ
            </p>
          </div>

          {/* Interactive SVG Donut Chart */}
          <div className="flex items-center justify-center py-2">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
                {/* State Audit Fund Segment (Electric Blue) */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke="#3B82F6"
                  strokeWidth="18"
                  onClick={() =>
                    onNavigateToProjects({
                      funding: 'budget_fund',
                      quarter: selectedQuarterFilter,
                      status: 'all',
                      category: 'all',
                    })
                  }
                  className="cursor-pointer hover:opacity-85 transition-opacity"
                >
                  <title>เงินกองทุน สตง. ({fundingBreakdown.fund.count} โครงการ) - คลิกเพื่อดูรายละเอียด</title>
                </circle>
                {/* Annual Budget Segment (Luminous Cyan) */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="transparent"
                  stroke="#06B6D4"
                  strokeWidth="18"
                  strokeDasharray={`${annualStroke} ${circumference}`}
                  strokeLinecap="butt"
                  onClick={() =>
                    onNavigateToProjects({
                      funding: 'budget_annual',
                      quarter: selectedQuarterFilter,
                      status: 'all',
                      category: 'all',
                    })
                  }
                  className="cursor-pointer hover:opacity-85 transition-opacity"
                >
                  <title>งบประมาณประจำปี ({fundingBreakdown.annual.count} โครงการ) - คลิกเพื่อดูรายละเอียด</title>
                </circle>
              </svg>
              <button
                type="button"
                onClick={() =>
                  onNavigateToProjects({
                    funding: 'all',
                    quarter: selectedQuarterFilter,
                    status: 'all',
                    category: 'all',
                  })
                }
                className="absolute inset-4 rounded-full flex flex-col items-center justify-center text-center cursor-pointer hover:bg-cyan-950/30 transition-colors"
                title="คลิกดูโครงการทั้งหมด"
              >
                <span className="text-[10px] text-slate-400">งบประมาณรวม</span>
                <span className="text-sm font-black font-mono text-white tabular-nums">
                  ฿{(fundingBreakdown.combined / 1000000).toFixed(2)}M
                </span>
                <span className="text-[10px] font-mono text-cyan-400 tabular-nums">
                  {fundingBreakdown.totalCount} โครงการ
                </span>
              </button>
            </div>
          </div>

          {/* Clickable Legend Cards */}
          <div className="space-y-2.5 text-xs">
            <button
              type="button"
              onClick={() =>
                onNavigateToProjects({
                  funding: 'budget_annual',
                  quarter: selectedQuarterFilter,
                  status: 'all',
                  category: 'all',
                })
              }
              className="w-full text-left p-3 rounded-xl border border-cyan-900/50 hover:border-cyan-400 bg-[#060D1A] hover:bg-[#0A1730] flex items-center justify-between transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#06B6D4] shrink-0" />
                <div>
                  <div className="font-semibold text-white group-hover:text-cyan-200">
                    งบประมาณประจำปี →
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {fundingBreakdown.annual.count} โครงการ ({fundingBreakdown.annual.share.toFixed(1)}%)
                  </div>
                </div>
              </div>
              <span className="font-mono font-bold text-cyan-300 tabular-nums">
                ฿{fundingBreakdown.annual.allocated.toLocaleString()}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onNavigateToProjects({
                  funding: 'budget_fund',
                  quarter: selectedQuarterFilter,
                  status: 'all',
                  category: 'all',
                })
              }
              className="w-full text-left p-3 rounded-xl border border-blue-900/50 hover:border-blue-400 bg-[#060D1A] hover:bg-[#0A1730] flex items-center justify-between transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#3B82F6] shrink-0" />
                <div>
                  <div className="font-semibold text-white group-hover:text-blue-200">
                    เงินกองทุน สตง. →
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    {fundingBreakdown.fund.count} โครงการ ({fundingBreakdown.fund.share.toFixed(1)}%)
                  </div>
                </div>
              </div>
              <span className="font-mono font-bold text-blue-300 tabular-nums">
                ฿{fundingBreakdown.fund.allocated.toLocaleString()}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Clickable Competency Breakdown + Executive Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Competency Colorful Bars (2 Cols, Clickable Drilldown) */}
        <div className="lg:col-span-2 bg-[#091224] border border-cyan-900/40 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>สัดส่วนงบประมาณตามหมวดหมู่สมรรถนะ (คลิกเพื่อดูโครงการในหมวด)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                จำแนกกรอบวงเงินและจำนวนโครงการในแต่ละสายงานประจำปี 2570
              </p>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {categoryBreakdown.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() =>
                  onNavigateToProjects({
                    category: cat.filterKey,
                    funding: selectedFundingFilter,
                    quarter: selectedQuarterFilter,
                    status: 'all',
                  })
                }
                className="w-full text-left p-2.5 rounded-xl bg-[#060D1A]/60 hover:bg-[#0B1933] border border-transparent hover:border-cyan-700/60 transition-all space-y-1.5 cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-medium text-slate-200 group-hover:text-cyan-200 truncate">
                      {cat.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 font-mono shrink-0 tabular-nums">
                    <span className="text-[11px] hidden sm:inline text-cyan-300/90">
                      {cat.count} โครงการ →
                    </span>
                    <span className="font-semibold text-white">฿{cat.allocated.toLocaleString()}</span>
                    <span className="font-bold text-cyan-400 w-11 text-right">{cat.share.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full bg-[#050B16] h-2.5 rounded-full overflow-hidden border border-cyan-950">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: cat.color,
                      width: `${Math.min(cat.share, 100)}%`,
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Executive Disbursement Simulator (1 Col) */}
        <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-6 shadow-md flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>ตัวจำลองการเบิกจ่ายงบประมาณ</span>
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              เลื่อนแถบจำลองเพื่อวิเคราะห์งบประมาณคงเหลือตามอัตราการเบิกจ่าย
            </p>
          </div>

          <div className="space-y-4 bg-[#060D1A] p-4 rounded-xl border border-cyan-950">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">จำลองอัตราการเบิกจ่าย:</span>
              <span className="font-mono font-bold text-cyan-400 text-sm tabular-nums">{simulatedRate}%</span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={simulatedRate}
              onChange={(e) => setSimulatedRate(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />

            <div className="flex justify-between text-[10px] font-mono text-slate-400 tabular-nums">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>

            <div className="pt-2 border-t border-cyan-950 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">ยอดเบิกจ่ายจำลอง:</span>
                <span className="font-mono font-bold text-white tabular-nums">
                  ฿{simulatedBurn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">คงเหลือจำลอง:</span>
                <span className="font-mono font-bold text-emerald-400 tabular-nums">
                  ฿{simulatedRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-900/40 text-xs text-cyan-200/90 flex items-start gap-2">
            <Zap className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              {simulatedRate === 0
                ? 'สถานะปัจจุบัน: ยังไม่มีการเบิกจ่ายจริง (งบคงเหลือ 100%)'
                : `ที่อัตราเบิกจ่าย ${simulatedRate}% จะมีงบคงเหลือ ฿${(simulatedRemaining / 1000000).toFixed(2)}M`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
