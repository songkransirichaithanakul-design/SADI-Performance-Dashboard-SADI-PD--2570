import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MousePointerClick,
  LayoutGrid,
  Table as TableIcon,
  Calendar,
  Tag,
  Download,
  FileJson,
  Edit3,
  Layers,
} from 'lucide-react';
import { ProjectSearchAutocomplete } from './ProjectSearchAutocomplete';
import { exportFullDatasetXLSX } from '../utils/spreadsheet';

interface ProjectsCatalogViewProps {
  onOpenProjectDetail: (projectId: string) => void;
  onGoToUpdatePage: () => void;
  onBackToDashboard: () => void;
  isDrilldownMode?: boolean;
}

export const ProjectsCatalogView: React.FC<ProjectsCatalogViewProps> = ({
  onOpenProjectDetail,
  onGoToUpdatePage,
  onBackToDashboard,
  isDrilldownMode = false,
}) => {
  const {
    projects,
    selectedFundingFilter,
    setSelectedFundingFilter,
    selectedQuarterFilter,
    setSelectedQuarterFilter,
    selectedStatusFilter,
    setSelectedStatusFilter,
    selectedCategoryFilter,
    setSelectedCategoryFilter,
    searchQuery,
    setSearchQuery,
    exportDataToCSV,
    exportDataToJSON,
  } = useApp();

  const [viewMode, setViewMode] = useState<'cards' | 'table'>(isDrilldownMode ? 'cards' : 'table');

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(1500);
  const isSyncingScroll = useRef<boolean>(false);

  const filterCounts = useMemo(() => {
    return {
      total: projects.length,
      annual: projects.filter((p) => p.fundingSource === 'budget_annual').length,
      fund: projects.filter((p) => p.fundingSource === 'budget_fund').length,
      completed: projects.filter((p) => p.status === 'completed').length,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
      const haystack = [
        p.code,
        p.name,
        p.category,
        p.subCategory || '',
        p.targetGroup,
        p.fundingSourceNameTh,
        p.quarters.join(' '),
        p.executionDateSchedule,
        p.actualDateOrQuarter || '',
      ]
        .join(' ')
        .toLowerCase();

      const normalizeCat = (cat: string) => {
        let clean = cat.split('(')[0].replace(/^\d+\.\s*/, '').trim();
        if (clean.includes('ภารกิจตามแผนปฏิบัติราชการ')) {
          clean = 'ภารกิจแผนปฏิบัติราชการ 5 ปี';
        }
        return clean;
      };

      const matchSearch = tokens.length === 0 || tokens.every((t) => haystack.includes(t));
      const matchFunding = selectedFundingFilter === 'all' || p.fundingSource === selectedFundingFilter;
      const matchQuarter = selectedQuarterFilter === 'all' || p.quarters.includes(selectedQuarterFilter);
      const matchStatus = selectedStatusFilter === 'all' || p.status === selectedStatusFilter;
      const matchCategory =
        selectedCategoryFilter === 'all' ||
        p.category === selectedCategoryFilter ||
        normalizeCat(p.category) === normalizeCat(selectedCategoryFilter);

      return matchSearch && matchFunding && matchQuarter && matchStatus && matchCategory;
    });
  }, [
    projects,
    searchQuery,
    selectedFundingFilter,
    selectedQuarterFilter,
    selectedStatusFilter,
    selectedCategoryFilter,
  ]);

  const aggregates = useMemo(() => {
    const totalAllocated = filteredProjects.reduce((s, p) => s + p.budgetAllocated, 0);
    const totalActual = filteredProjects.reduce((s, p) => s + p.budgetActual, 0);
    const totalRemaining = totalAllocated - totalActual;
    const totalParticipantsPlanned = filteredProjects.reduce((s, p) => s + p.participantsPlanned, 0);
    const totalParticipantsActual = filteredProjects.reduce((s, p) => s + p.participantsActual, 0);
    const inProgressCount = filteredProjects.filter((p) => p.status === 'in_progress').length;
    const notStartedCount = filteredProjects.filter((p) => p.status === 'not_started').length;
    const completedCount = filteredProjects.filter((p) => p.status === 'completed').length;
    return {
      totalAllocated,
      totalActual,
      totalRemaining,
      totalParticipantsPlanned,
      totalParticipantsActual,
      inProgressCount,
      notStartedCount,
      completedCount,
    };
  }, [filteredProjects]);

  useEffect(() => {
    const updateWidth = () => {
      if (tableScrollRef.current) {
        setTableScrollWidth(tableScrollRef.current.scrollWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [filteredProjects, viewMode]);

  const handleTopScroll = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const handleTableScroll = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const scrollTableHorizontal = (offset: number) => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const resetAllFilters = () => {
    setSelectedFundingFilter('all');
    setSelectedQuarterFilter('all');
    setSelectedStatusFilter('all');
    setSelectedCategoryFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilter =
    selectedFundingFilter !== 'all' ||
    selectedQuarterFilter !== 'all' ||
    selectedStatusFilter !== 'all' ||
    selectedCategoryFilter !== 'all' ||
    searchQuery.trim() !== '';

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Page 1 Executive Header + Complete Dataset Export Actions */}
      <div className="bg-[#091224] border border-cyan-900/50 rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgba(6,182,212,0.1)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-300 font-medium">
              <button
                type="button"
                onClick={onBackToDashboard}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#060D1A] border border-cyan-800/70 hover:border-cyan-400 text-cyan-300 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>กลับหน้า Dashboard</span>
              </button>
              <span>หน้าข้อมูลโครงการฉบับสมบูรณ์</span>
              <span className="text-cyan-700" aria-hidden="true">·</span>
              <span className="font-mono text-white font-bold tabular-nums">
                แสดง {filteredProjects.length} / {projects.length} โครงการ
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400 shrink-0" />
              <span>ข้อมูลโครงการทั้งหมดที่ปรับปรุงและนำเข้าล่าสุด (ปีงบประมาณ 2570)</span>
            </h1>

            {selectedCategoryFilter !== 'all' && (
              <div className="flex items-center gap-2 text-xs text-cyan-300 pt-1">
                <Tag className="w-3.5 h-3.5" />
                <span>หมวดหมู่: {selectedCategoryFilter}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('all')}
                  className="text-slate-400 hover:text-white underline cursor-pointer"
                >
                  ล้างตัวกรองหมวดหมู่
                </button>
              </div>
            )}
          </div>

          {/* Complete Dataset Export & Navigate to Update Page */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportFullDatasetXLSX(projects)}
              title="ส่งออกข้อมูลโครงการทั้งหมดชุดสมบูรณ์เป็นไฟล์ Excel (.xlsx)"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 flex items-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออกชุดสมบูรณ์ Excel (.XLSX)</span>
            </button>

            <button
              type="button"
              onClick={exportDataToCSV}
              title="ส่งออกไฟล์ CSV สำหรับเปิดใน Excel"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-cyan-800/70 bg-[#0A1730] hover:bg-[#0E2248] text-cyan-200 hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              <span>ส่งออก CSV</span>
            </button>

            <button
              type="button"
              onClick={exportDataToJSON}
              title="ส่งออกข้อมูลชุดสมบูรณ์ JSON"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-cyan-900/70 bg-[#060D1A] hover:bg-[#0A1730] text-slate-200 hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FileJson className="w-3.5 h-3.5 text-cyan-400" />
              <span>ส่งออก JSON</span>
            </button>

            <button
              type="button"
              onClick={onGoToUpdatePage}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.25)] cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>ไปหน้าปรับปรุง / นำเข้าข้อมูล</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-cyan-950 text-xs font-mono tabular-nums">
          <div className="bg-[#060D1A] p-3 rounded-xl border border-cyan-950">
            <span className="text-[11px] text-slate-400 font-sans block">กำลังดำเนินการ / เสร็จสิ้น</span>
            <span className="font-bold text-cyan-300 text-sm">
              {aggregates.inProgressCount} / {aggregates.completedCount} โครงการ
            </span>
          </div>
          <div className="bg-[#060D1A] p-3 rounded-xl border border-cyan-950">
            <span className="text-[11px] text-slate-400 font-sans block">ยังไม่ได้ดำเนินการ</span>
            <span className="font-bold text-amber-300 text-sm">
              {aggregates.notStartedCount} โครงการ
            </span>
          </div>
          <div className="bg-[#060D1A] p-3 rounded-xl border border-cyan-950">
            <span className="text-[11px] text-slate-400 font-sans block">งบจัดสรรรวม</span>
            <span className="font-bold text-white text-sm">
              ฿{aggregates.totalAllocated.toLocaleString()}
            </span>
          </div>
          <div className="bg-[#060D1A] p-3 rounded-xl border border-cyan-950">
            <span className="text-[11px] text-slate-400 font-sans block">ใช้จ่ายจริงสะสม</span>
            <span className="font-bold text-cyan-300 text-sm">
              ฿{aggregates.totalActual.toLocaleString()}
            </span>
          </div>
          <div className="bg-[#060D1A] p-3 rounded-xl border border-cyan-950 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-400 font-sans block">งบคงเหลือสุทธิ</span>
            <span className="font-bold text-emerald-400 text-sm">
              ฿{aggregates.totalRemaining.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Single Smart Search Bar */}
      <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-5 shadow-md space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <ProjectSearchAutocomplete
            onSelectProject={(project) => onOpenProjectDetail(project.id)}
            placeholder="พิมพ์คีย์เวิร์ดเพื่อค้นหาหรือเสนอรายการโครงการ (ชื่อ, รหัส, กลุ่มเป้าหมาย, ไตรมาส)..."
            className="flex-1 max-w-xl"
          />

          <div className="flex flex-wrap items-center gap-2.5">
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-3 py-1.5 rounded-xl border border-cyan-800/60 bg-[#060D1A] hover:bg-[#0A1730] text-cyan-300 text-xs font-medium cursor-pointer"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}

            <div className="inline-flex p-1 bg-[#060D1A] rounded-xl border border-cyan-950 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-cyan-500/25 text-cyan-300 font-semibold border border-cyan-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>การ์ดรายละเอียดเต็ม</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors ${
                  viewMode === 'table'
                    ? 'bg-cyan-500/25 text-cyan-300 font-semibold border border-cyan-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>มุมมองตาราง</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter chips bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-cyan-950 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-400">แหล่งงบ:</span>
            <div className="inline-flex p-1 bg-[#060D1A] rounded-xl border border-cyan-950">
              <button
                onClick={() => setSelectedFundingFilter('all')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  selectedFundingFilter === 'all'
                    ? 'bg-cyan-500/25 text-cyan-300 font-semibold border border-cyan-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ทั้งหมด ({filterCounts.total})
              </button>
              <button
                onClick={() => setSelectedFundingFilter('budget_annual')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  selectedFundingFilter === 'budget_annual'
                    ? 'bg-cyan-500/25 text-cyan-300 font-semibold border border-cyan-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                งบประมาณประจำปี ({filterCounts.annual})
              </button>
              <button
                onClick={() => setSelectedFundingFilter('budget_fund')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  selectedFundingFilter === 'budget_fund'
                    ? 'bg-cyan-500/25 text-cyan-300 font-semibold border border-cyan-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                เงินกองทุน สตง. ({filterCounts.fund})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-400">สถานะ:</span>
            <div className="inline-flex p-1 bg-[#060D1A] rounded-xl border border-cyan-950">
              <button
                onClick={() => setSelectedStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  selectedStatusFilter === 'all'
                    ? 'bg-cyan-500/25 text-cyan-300 font-semibold border border-cyan-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setSelectedStatusFilter('in_progress')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  selectedStatusFilter === 'in_progress'
                    ? 'bg-cyan-500/25 text-cyan-300 font-semibold border border-cyan-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                อยู่ระหว่างดำเนินการ
              </button>
              <button
                onClick={() => setSelectedStatusFilter('not_started')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  selectedStatusFilter === 'not_started'
                    ? 'bg-cyan-500/25 text-cyan-300 font-semibold border border-cyan-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ยังไม่ได้ดำเนินการ
              </button>
              <button
                onClick={() => setSelectedStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  selectedStatusFilter === 'completed'
                    ? 'bg-cyan-500/25 text-cyan-300 font-semibold border border-cyan-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ดำเนินการเสร็จแล้ว ({filterCounts.completed})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-400">ไตรมาส:</span>
            <div className="inline-flex p-1 bg-[#060D1A] rounded-xl font-mono border border-cyan-950">
              {(['all', 'Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setSelectedQuarterFilter(q)}
                  className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                    selectedQuarterFilter === q
                      ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-700/50'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {q === 'all' ? 'ทุก Q' : q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* VIEW MODE A: Detailed Project Cards */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          {filteredProjects.length === 0 ? (
            <div className="bg-[#091224] border border-cyan-900/50 rounded-2xl p-10 text-center space-y-3">
              <p className="text-sm text-slate-400">ไม่พบโครงการที่ตรงกับเงื่อนไขการกรอง</p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/50 text-cyan-200 text-xs font-semibold cursor-pointer"
              >
                แสดงโครงการทั้งหมด
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredProjects.map((p, idx) => {
                const remaining = p.budgetAllocated - p.budgetActual;
                const rate = p.budgetAllocated > 0 ? (p.budgetActual / p.budgetAllocated) * 100 : 0;
                return (
                  <div
                    key={p.id}
                    className="bg-[#091224] border border-cyan-900/50 hover:border-cyan-500/70 rounded-2xl p-5 shadow-md flex flex-col justify-between gap-4 transition-all"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            {idx + 1}. {p.code}
                          </span>
                          <span className="text-slate-400">
                            {p.fundingSource === 'budget_annual' ? 'งบประมาณแผ่นดิน' : 'เงินกองทุน สตง.'}
                          </span>
                          <span className="text-cyan-700" aria-hidden="true">·</span>
                          <span className="font-mono text-cyan-300">{p.quarters.join(', ')}</span>
                        </div>

                        <div className="shrink-0 text-xs font-semibold">
                          {p.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" /> เสร็จแล้ว
                            </span>
                          ) : p.status === 'in_progress' ? (
                            <span className="inline-flex items-center gap-1 text-cyan-300">
                              <Clock className="w-3.5 h-3.5 text-cyan-400" /> กำลังดำเนินการ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-300">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> ยังไม่เริ่ม
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenProjectDetail(p.id)}
                        className="text-left font-bold text-white hover:text-cyan-300 text-sm sm:text-base leading-snug cursor-pointer transition-colors"
                      >
                        {p.name}
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[#060D1A] p-3 rounded-xl border border-cyan-950">
                        <div>
                          <span className="text-[11px] text-slate-400 block">กลุ่มเป้าหมาย</span>
                          <span className="text-slate-200 font-medium">{p.targetGroup}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 block">กำหนดการ / สถานะล่าสุด</span>
                          <span className="text-slate-200 font-mono text-[11px] flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span>{p.actualDateOrQuarter || p.executionDateSchedule}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-cyan-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="grid grid-cols-3 gap-3 text-xs font-mono tabular-nums">
                        <div>
                          <span className="text-[10px] text-slate-400 block">งบจัดสรร</span>
                          <span className="font-bold text-white">฿{p.budgetAllocated.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">ใช้จริง ({rate.toFixed(1)}%)</span>
                          <span className="font-bold text-cyan-300">฿{p.budgetActual.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">คงเหลือ</span>
                          <span className="font-bold text-emerald-400">฿{remaining.toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {p.lastModifiedBy && (
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                            ปรับปรุง: {p.lastModifiedBy}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenProjectDetail(p.id)}
                          className="px-3 py-1.5 rounded-lg border border-cyan-800/70 bg-[#0A1730] hover:bg-cyan-500/20 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          <span>ดูรายละเอียดเต็ม</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE B: Complete Read-Only Table View */}
      {viewMode === 'table' && (
        <div className="bg-[#091224] border border-cyan-900/50 rounded-2xl shadow-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-[#071022] border-b border-cyan-900/60 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-cyan-300 font-medium">
                <MousePointerClick className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>เลื่อนแถบสีฟ้าซ้าย-ขวา หรือใช้ปุ่มลูกศร เพื่อดูข้อมูลงบประมาณและผู้ปรับปรุงล่าสุด</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollTableHorizontal(-320)}
                  className="px-2.5 py-1 rounded-lg border border-cyan-800/70 bg-[#0A1730] hover:bg-cyan-500/20 text-cyan-200 flex items-center gap-1 text-[11px] font-semibold cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>เลื่อนซ้าย</span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollTableHorizontal(320)}
                  className="px-2.5 py-1 rounded-lg border border-cyan-800/70 bg-[#0A1730] hover:bg-cyan-500/20 text-cyan-200 flex items-center gap-1 text-[11px] font-semibold cursor-pointer transition-colors"
                >
                  <span>เลื่อนขวา</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              className="overflow-x-auto prominent-scrollbar pb-1"
              aria-label="แถบเลื่อนตารางแนวนอนด้านบน"
            >
              <div style={{ width: `${tableScrollWidth}px`, height: '2px' }} />
            </div>
          </div>

          <div
            ref={tableScrollRef}
            onScroll={handleTableScroll}
            className="overflow-x-auto overflow-y-auto max-h-[65vh] prominent-scrollbar"
          >
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="sticky top-0 z-20 bg-[#060D1A] text-cyan-200 font-semibold border-b border-cyan-950 shadow-sm">
                <tr>
                  <th className="py-3.5 px-3 w-12 text-center font-mono">ลำดับ</th>
                  <th className="py-3.5 px-4 min-w-[280px]">ชื่อโครงการ / หลักสูตร</th>
                  <th className="py-3.5 px-3 w-32">แหล่งงบประมาณ</th>
                  <th className="py-3.5 px-3 w-36">สถานะโครงการ</th>
                  <th className="py-3.5 px-2 w-20 text-center font-mono">ไตรมาส</th>
                  <th className="py-3.5 px-3 min-w-[160px]">ดำเนินการจริง / กำหนดการ</th>
                  <th className="py-3.5 px-2 w-20 text-center font-mono">จำนวนรุ่น</th>
                  <th className="py-3.5 px-3 w-28 text-center font-mono">คนเข้าอบรม</th>
                  <th className="py-3.5 px-3 text-right w-32 font-mono">งบจัดสรร (บาท)</th>
                  <th className="py-3.5 px-3 text-right w-32 font-mono">ใช้จ่ายจริง (บาท)</th>
                  <th className="py-3.5 px-3 text-right w-32 font-mono">คงเหลือ (บาท)</th>
                  <th className="py-3.5 px-3 w-40">ผู้ปรับปรุงล่าสุด</th>
                  <th className="sticky right-0 z-30 bg-[#060D1A] py-3.5 px-3 w-24 text-center border-l border-cyan-900/50 shadow-[-6px_0_12px_rgba(4,9,20,0.6)]">
                    รายละเอียด
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-cyan-950/60">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-500 text-xs">
                      ไม่พบโครงการที่ตรงกับเงื่อนไขการค้นหา
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((p, idx) => {
                    const remaining = p.budgetAllocated - p.budgetActual;
                    const rate = p.budgetAllocated > 0 ? (p.budgetActual / p.budgetAllocated) * 100 : 0;

                    return (
                      <tr key={p.id} className="hover:bg-[#0A1730] transition-colors group">
                        <td className="py-3 px-3 text-center text-slate-500 font-mono tabular-nums">
                          {idx + 1}
                        </td>

                        <td className="py-3 px-4 whitespace-normal max-w-sm">
                          <button
                            onClick={() => onOpenProjectDetail(p.id)}
                            className="text-left font-semibold text-white hover:text-cyan-300 transition-colors cursor-pointer leading-tight block"
                          >
                            {p.name}
                          </button>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                            <span className="font-mono text-cyan-400">{p.code}</span>
                            <span>·</span>
                            <span className="truncate max-w-[180px]">{p.targetGroup}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-xs text-slate-300">
                          {p.fundingSource === 'budget_annual' ? 'งบประมาณแผ่นดิน' : 'เงินกองทุน สตง.'}
                        </td>

                        <td className="py-3 px-3 font-medium">
                          {p.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> เสร็จแล้ว
                            </span>
                          ) : p.status === 'in_progress' ? (
                            <span className="inline-flex items-center gap-1 text-cyan-300">
                              <Clock className="w-3.5 h-3.5 text-cyan-400" /> อยู่ระหว่างดำเนินการ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-300">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> ยังไม่ได้ดำเนินการ
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-2 text-center font-mono font-medium text-slate-300">
                          {p.quarters.join(', ')}
                        </td>

                        <td className="py-3 px-3 whitespace-normal max-w-xs text-slate-300 font-mono text-[11px]">
                          {p.actualDateOrQuarter || p.executionDateSchedule || '-'}
                        </td>

                        <td className="py-3 px-2 text-center font-mono tabular-nums">
                          <strong className="text-white">{p.batchesActual}</strong> / {p.batchesPlanned}
                        </td>

                        <td className="py-3 px-3 text-center font-mono tabular-nums">
                          <span className="font-bold text-white">{p.participantsActual}</span>
                          <span className="text-[10px] text-slate-400 block font-normal">
                            แผน {p.participantsPlanned} คน ({p.participantsPerBatch}/รุ่น)
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-medium text-slate-200 tabular-nums">
                          ฿{p.budgetAllocated.toLocaleString()}
                        </td>

                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          <span className="font-bold text-slate-300">
                            ฿{p.budgetActual.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-cyan-400/80 block font-normal">
                            ({rate.toFixed(1)}%)
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono text-emerald-400 font-bold tabular-nums">
                          ฿{remaining.toLocaleString()}
                        </td>

                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          <div>{p.lastModifiedBy || 'ข้อมูลตั้งต้น'}</div>
                          {p.lastModifiedAt && (
                            <div className="font-mono text-[10px] text-slate-500">{p.lastModifiedAt}</div>
                          )}
                        </td>

                        <td className="sticky right-0 z-10 bg-[#091224] group-hover:bg-[#0A1730] py-3 px-3 text-center border-l border-cyan-900/50 shadow-[-6px_0_12px_rgba(4,9,20,0.5)]">
                          <button
                            onClick={() => onOpenProjectDetail(p.id)}
                            title="ดูรายละเอียดโครงการ"
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-800/70 text-cyan-300 hover:bg-cyan-500/25 font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="text-[11px]">ดูข้อมูล</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              <tfoot className="bg-[#060D1A] font-semibold border-t-2 border-cyan-900/60 tabular-nums">
                <tr>
                  <td colSpan={7} className="py-3.5 px-4 text-right text-slate-400">
                    รวมทั้งสิ้นในรายการที่แสดง ({filteredProjects.length} โครงการ):
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-white font-bold">
                    {aggregates.totalParticipantsActual.toLocaleString()} คน
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-white font-bold">
                    ฿{aggregates.totalAllocated.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-slate-300 font-bold">
                    ฿{aggregates.totalActual.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-emerald-400 font-bold">
                    ฿{aggregates.totalRemaining.toLocaleString()}
                  </td>
                  <td colSpan={2} className="sticky right-0 bg-[#060D1A] border-l border-cyan-900/50"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
