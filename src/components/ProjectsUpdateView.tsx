import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Project, ProjectStatus } from '../types';
import {
  Search,
  Plus,
  Edit,
  Save,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  UserCheck,
  Users,
  ArrowRight,
  RefreshCw,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  MousePointerClick,
  Upload,
  FileSpreadsheet,
  Download,
  X,
  FileJson,
  Table2,
  Loader2,
  Lock,
} from 'lucide-react';
import { ProjectSearchAutocomplete } from './ProjectSearchAutocomplete';
import { ImportPreviewConfirmPanel } from './ImportPreviewConfirmPanel';
import {
  IMPORT_TEMPLATE_SCHEMA,
  downloadImportTemplateXLSX,
  downloadImportTemplateCSV,
  downloadImportTemplateJSON,
  parseImportedFile,
  ImportParseResult,
} from '../utils/spreadsheet';

interface ProjectsUpdateViewProps {
  onOpenProjectDetail: (projectId: string) => void;
  onOpenEditModal: (project: Project) => void;
  onOpenAddModal: () => void;
  onGoToCatalogPage: () => void;
  onImportCompleteAndDisplay?: () => void;
  onGoToDashboard?: () => void;
}

export const ProjectsUpdateView: React.FC<ProjectsUpdateViewProps> = ({
  onOpenProjectDetail,
  onOpenEditModal,
  onOpenAddModal,
  onGoToCatalogPage,
  onImportCompleteAndDisplay,
  onGoToDashboard,
}) => {
  const {
    projects,
    currentUser,
    authorizedUsers,
    selectUpdater,
    clearUpdater,
    selectedFundingFilter,
    setSelectedFundingFilter,
    selectedQuarterFilter,
    setSelectedQuarterFilter,
    selectedStatusFilter,
    setSelectedStatusFilter,
    searchQuery,
    isBulkEditMode,
    setIsBulkEditMode,
    updateProject,
    bulkUpdateProjects,
    importProjectsFromFile,
    deleteProject,
  } = useApp();

  // Search filter inside the 39-staff selector box
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');

  // Primary workspace tab: default directly to on-page editing so staff can update immediately
  const [activeWorkspaceMode, setActiveWorkspaceMode] = useState<'direct_edit' | 'file_import'>('direct_edit');

  // Single-row quick inline edit state
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState<Project | null>(null);
  const [recentlySavedId, setRecentlySavedId] = useState<string | null>(null);

  // Panels toggles
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [showSchemaSpec, setShowSchemaSpec] = useState<boolean>(false);

  // Import state (Local Excel / CSV / JSON form files for all named staff)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportParseResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);

  // Refs for synced top & bottom horizontal scrollbars
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(1500);
  const isSyncingScroll = useRef<boolean>(false);

  // Working copy for bulk editing
  const [bulkProjects, setBulkProjects] = useState<Project[]>(projects);

  useEffect(() => {
    if (!isBulkEditMode) {
      setBulkProjects(projects);
    }
  }, [projects, isBulkEditMode]);

  const handleToggleBulkEdit = () => {
    if (!isBulkEditMode) {
      setBulkProjects([...projects]);
      setIsBulkEditMode(true);
    } else {
      setIsBulkEditMode(false);
    }
  };

  const handleBulkChange = (id: string, field: keyof Project, value: unknown) => {
    setBulkProjects((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          return { ...p, [field]: value };
        }
        return p;
      })
    );
  };

  const handleSaveBulkEdit = () => {
    bulkUpdateProjects(bulkProjects);
  };

  const handleStartInlineEdit = (project: Project) => {
    setInlineEditId(project.id);
    setInlineDraft({ ...project });
  };

  const handleCancelInlineEdit = () => {
    setInlineEditId(null);
    setInlineDraft(null);
  };

  const handleSaveInlineEdit = () => {
    if (!inlineDraft) return;
    updateProject(inlineDraft, `ปรับปรุงข้อมูลโดยตรงบนหน้าเว็บโดย ${currentUser.name}`);
    const savedId = inlineDraft.id;
    setInlineEditId(null);
    setInlineDraft(null);
    setRecentlySavedId(savedId);
    window.setTimeout(() => {
      setRecentlySavedId((prev) => (prev === savedId ? null : prev));
    }, 2800);
  };

  const isAdmin = currentUser.role === 'admin';
  const isEditor = currentUser.role === 'editor';
  const canEdit = isAdmin || isEditor;

  // Always show the 39-person updater selector box first on the Update page when no updater/Admin is active
  const needsUpdaterSelection = currentUser.role === 'viewer';

  const filteredStaffList = useMemo(() => {
    const q = staffSearchQuery.trim().toLowerCase();
    return authorizedUsers
      .map((u, idx) => ({ user: u, orderNumber: idx + 1 }))
      .filter(({ user, orderNumber }) => {
        if (!q) return true;
        return user.name.toLowerCase().includes(q) || String(orderNumber) === q;
      });
  }, [authorizedUsers, staffSearchQuery]);

  const filterCounts = useMemo(() => {
    return {
      total: projects.length,
      annual: projects.filter((p) => p.fundingSource === 'budget_annual').length,
      fund: projects.filter((p) => p.fundingSource === 'budget_fund').length,
      completed: projects.filter((p) => p.status === 'completed').length,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const listToFilter = isBulkEditMode ? bulkProjects : projects;

    return listToFilter.filter((p) => {
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

      const matchSearch = tokens.length === 0 || tokens.every((t) => haystack.includes(t));
      const matchFunding = selectedFundingFilter === 'all' || p.fundingSource === selectedFundingFilter;
      const matchQuarter = selectedQuarterFilter === 'all' || p.quarters.includes(selectedQuarterFilter);
      const matchStatus = selectedStatusFilter === 'all' || p.status === selectedStatusFilter;

      return matchSearch && matchFunding && matchQuarter && matchStatus;
    });
  }, [
    projects,
    bulkProjects,
    isBulkEditMode,
    searchQuery,
    selectedFundingFilter,
    selectedQuarterFilter,
    selectedStatusFilter,
  ]);

  const aggregates = useMemo(() => {
    const totalAllocated = filteredProjects.reduce((s, p) => s + p.budgetAllocated, 0);
    const totalActual = filteredProjects.reduce((s, p) => s + p.budgetActual, 0);
    const totalRemaining = totalAllocated - totalActual;
    const totalParticipantsActual = filteredProjects.reduce((s, p) => s + p.participantsActual, 0);
    return { totalAllocated, totalActual, totalRemaining, totalParticipantsActual };
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
  }, [filteredProjects, isBulkEditMode, needsUpdaterSelection]);

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

  // File upload handler (Excel / CSV / JSON)
  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    setImportSuccessMessage(null);
    setIsParsingFile(true);
    try {
      const result = await parseImportedFile(file, projects);
      if (result.errors.length > 0) {
        setImportError(result.errors.join(' '));
        setImportPreview(null);
      } else {
        setImportPreview(result);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ได้ กรุณาใช้ไฟล์ตัวอย่างมาตรฐาน');
      setImportPreview(null);
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      void handleFileSelected(droppedFile);
    }
  };

  const handleConfirmFileImport = async (
    mergedProjects: Project[],
    summaryNote: string,
    meta: { fileName: string; updatedCount: number; newCount: number; affectedIds: string[] },
    navigateToDisplayImmediately: boolean
  ) => {
    setImportError(null);
    try {
      await importProjectsFromFile(mergedProjects, summaryNote, meta);
      setImportPreview(null);

      if (navigateToDisplayImmediately && onImportCompleteAndDisplay) {
        onImportCompleteAndDisplay();
      } else {
        setImportSuccessMessage(
          `ยืนยันส่งและบันทึกข้อมูลจาก "${meta.fileName}" สำเร็จ (${meta.updatedCount} โครงการเดิม${
            meta.newCount > 0 ? ` และเพิ่มใหม่ ${meta.newCount} โครงการ` : ''
          }) แสดงผลในระบบเรียบร้อยแล้ว`
        );
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดระหว่างบันทึกข้อมูลนำเข้า');
    }
  };

  // STEP 1: Display the 39-Person SADI Staff Updater Selector Box BEFORE unlocking edit/import tools
  if (needsUpdaterSelection) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-[#091224] border border-cyan-900/50 rounded-2xl p-6 sm:p-8 shadow-[0_10px_40px_rgba(4,10,24,0.6)] relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-950 pb-5">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    เลือกผู้ปรับปรุงข้อมูลโครงการ (หน้าปรับปรุงข้อมูล)
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    รายชื่อข้าราชการและเจ้าหน้าที่ สถาบันพัฒนาการตรวจเงินแผ่นดิน ({authorizedUsers.length} รายชื่อ) — กรุณาเลือกรายชื่อของท่านก่อนปรับปรุงหรือนำเข้าไฟล์ข้อมูล
                  </p>
                </div>
              </div>

              <div className="relative w-full md:w-72 shrink-0">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
                <input
                  type="text"
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อ - สกุล หรือลำดับ (1-39)..."
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#060D1A]/80 border border-cyan-950 rounded-xl p-4 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  <div className="font-semibold text-white">เลือกรายชื่อของท่าน</div>
                  <p className="text-slate-400 text-[11px] mt-0.5">ค้นหาหรือคลิกที่ชื่อของท่านจากกล่องรายชื่อด้านล่าง (ลำดับที่ 1–39)</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  <div className="font-semibold text-white">แก้ไขบนหน้าเว็บ หรือนำเข้าไฟล์ตามฟอร์มระบบ</div>
                  <p className="text-slate-400 text-[11px] mt-0.5">ปรับปรุงข้อมูลในตารางหน้าเว็บได้ทันที หรือดาวน์โหลด/อัปโหลดไฟล์ Excel, CSV, JSON ตามโครงสร้างมาตรฐาน</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-bold flex items-center justify-center shrink-0">3</span>
                <div>
                  <div className="font-semibold text-white">บันทึกและแสดงผลอัตโนมัติ</div>
                  <p className="text-slate-400 text-[11px] mt-0.5">ข้อมูลถูกบันทึกลงฐานข้อมูลและอัปเดตไปที่หน้าข้อมูลโครงการทันที</p>
                </div>
              </div>
            </div>

            <div className="bg-[#060D1A] border border-cyan-950 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-cyan-300/90 mb-1.5">
                  เลือกรายชื่อของท่าน (ลำดับที่ 1 - {authorizedUsers.length}) เพื่อเข้าปรับปรุงข้อมูลบนหน้าเว็บทันที
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedStaffId(id);
                    const found = authorizedUsers.find((u) => u.id === id);
                    if (found) selectUpdater(found);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-cyan-800/70 bg-[#091326] text-white text-xs font-medium focus:outline-hidden focus:border-cyan-400 cursor-pointer"
                >
                  <option value="">-- เลือกรายชื่อผู้ปรับปรุงข้อมูลเพื่อเริ่มแก้ไขทันที --</option>
                  {authorizedUsers.map((u, idx) => (
                    <option key={u.id} value={u.id}>
                      {idx + 1}. {u.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>หรือคลิกเลือกรายชื่อจากกล่องด้านล่างเพื่อเข้าสู่หน้าปรับปรุงข้อมูลทันที</span>
                <span className="font-mono text-cyan-400 tabular-nums">
                  แสดง {filteredStaffList.length} / {authorizedUsers.length} รายชื่อ
                </span>
              </div>

              {filteredStaffList.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-cyan-950 bg-[#060D1A] text-xs text-slate-500">
                  ไม่พบรายชื่อที่ตรงกับคำค้นหา
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[52vh] overflow-y-auto pr-2 prominent-scrollbar">
                  {filteredStaffList.map(({ user, orderNumber }) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => selectUpdater(user)}
                      className="text-left p-3 rounded-xl border border-cyan-900/40 bg-[#060D1A] hover:bg-[#0B1933] hover:border-cyan-500/70 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-cyan-950/90 border border-cyan-800/70 text-cyan-300 font-mono font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors tabular-nums">
                          {orderNumber}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs sm:text-sm text-white group-hover:text-cyan-200 truncate">
                            {user.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            สถาบันพัฒนาการตรวจเงินแผ่นดิน
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STEP 2: Direct On-Page Update + Google Sheets / File Import Workspace
  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Updater Header Bar with Inline 1-39 Staff Switcher */}
      <div className="p-4 rounded-2xl border bg-[#091326] border-cyan-900/50 text-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">ผู้ปรับปรุงข้อมูล:</span>
              {isEditor ? (
                <select
                  aria-label="เปลี่ยนรายชื่อผู้ปรับปรุงข้อมูล"
                  value={currentUser.id}
                  onChange={(e) => {
                    const found = authorizedUsers.find((u) => u.id === e.target.value);
                    if (found) selectUpdater(found);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-cyan-700/70 bg-[#060D1A] text-white text-xs font-bold focus:outline-hidden focus:border-cyan-400 cursor-pointer"
                >
                  {authorizedUsers.map((u, idx) => (
                    <option key={u.id} value={u.id}>
                      {idx + 1}. {u.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-bold text-sm text-white">{currentUser.name}</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              สามารถเลือกชื่อและปรับปรุงข้อมูลบนหน้าเว็บได้ทันที หรือสลับไปนำเข้าไฟล์ตามฟอร์มมาตรฐาน (Excel / CSV / JSON)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Mode Switcher: Direct Page Edit (Default) vs Local Form File Import */}
          <div className="inline-flex p-1 rounded-xl bg-[#060D1A] border border-cyan-900/60 text-xs">
            <button
              type="button"
              onClick={() => setActiveWorkspaceMode('direct_edit')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeWorkspaceMode === 'direct_edit'
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-200'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Edit className="w-3.5 h-3.5 text-cyan-400" />
              <span>ปรับปรุงในหน้าเว็บทันที</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkspaceMode('file_import')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                activeWorkspaceMode === 'file_import'
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-200'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>นำเข้าไฟล์ตามฟอร์มระบบ</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              showGuide
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                : 'bg-[#0C1B38] border-cyan-800/60 text-cyan-300 hover:bg-[#10244C]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>{showGuide ? 'ซ่อนคู่มือ' : 'คู่มือ'}</span>
            {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {isEditor && (
            <button
              type="button"
              onClick={() => {
                setSelectedStaffId('');
                clearUpdater();
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0C1B38] border border-cyan-800/60 text-cyan-200 hover:bg-[#10244C] hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              <span>เลือกรายชื่อใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* Form File Import Panel (Open for all 39 named staff; Google Sheets link sync is Admin-only) */}
      {activeWorkspaceMode === 'file_import' && (
        <div className="bg-[#091224] border border-emerald-800/50 rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgba(16,185,129,0.08)] space-y-5">
          {/* Top Header + Template Download Buttons */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-cyan-950 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  นำเข้าไฟล์ข้อมูลตามฟอร์มมาตรฐานของระบบ (Excel / CSV / JSON · 16 คอลัมน์)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ผู้มีรายชื่อทุกท่านสามารถดาวน์โหลดฟอร์มไปกรอกและนำเข้าไฟล์ข้อมูลเพื่ออัปเดตแดชบอร์ดได้อย่างสะดวกทันที
                </p>
              </div>
            </div>

            {/* Download Import Template Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => downloadImportTemplateXLSX(projects)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-600/60 bg-emerald-950/40 hover:bg-emerald-500/20 text-emerald-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>ไฟล์โครงสร้าง Excel (.XLSX)</span>
              </button>
              <button
                type="button"
                onClick={() => downloadImportTemplateCSV(projects)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-cyan-800/70 bg-[#060D1A] hover:bg-[#0A1730] text-cyan-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>ไฟล์โครงสร้าง CSV (.CSV)</span>
              </button>
              <button
                type="button"
                onClick={() => downloadImportTemplateJSON(projects)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-cyan-900/70 bg-[#060D1A] hover:bg-[#0A1730] text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FileJson className="w-3.5 h-3.5 text-cyan-400" />
                <span>JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSchemaSpec(!showSchemaSpec)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                  showSchemaSpec
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                    : 'bg-[#060D1A] border-cyan-900/60 text-slate-300 hover:text-white'
                }`}
              >
                <Table2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>{showSchemaSpec ? 'ซ่อนโครงสร้างคอลัมน์' : 'ดูโครงสร้างคอลัมน์ (16)'}</span>
              </button>
            </div>
          </div>

          {/* Collapsible Standard 16-Column Schema Table */}
          {showSchemaSpec && (
            <div className="bg-[#060D1A] border border-cyan-900/60 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-cyan-300">
                    โครงสร้างคอลัมน์มาตรฐานที่ระบบออกแบบไว้ (16 คอลัมน์)
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    รองรับทั้งไฟล์ที่ดาวน์โหลดจากฟอร์มตัวอย่าง หรือไฟล์ที่ส่งออกจากหน้า "ข้อมูลโครงการ" (ระบบแปลงตัวเลขไทยเป็นอาราบิกให้อัตโนมัติ)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSchemaSpec(false)}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto prominent-scrollbar rounded-lg border border-cyan-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#091224] text-cyan-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5 font-mono w-12 text-center">#</th>
                      <th className="py-2 px-2.5">ชื่อคอลัมน์มาตรฐาน</th>
                      <th className="py-2 px-2.5 w-20 text-center">เงื่อนไข</th>
                      <th className="py-2 px-2.5">ตัวอย่างข้อมูล</th>
                      <th className="py-2 px-2.5">คำอธิบาย / รูปแบบที่รองรับ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-950/60">
                    {IMPORT_TEMPLATE_SCHEMA.map((col) => (
                      <tr key={col.order} className="hover:bg-[#0A1730]/60">
                        <td className="py-1.5 px-2.5 text-center font-mono text-slate-500">{col.order}</td>
                        <td className="py-1.5 px-2.5 font-semibold text-white whitespace-nowrap">{col.columnName}</td>
                        <td className="py-1.5 px-2.5 text-center">
                          {col.required ? (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-700/70 text-cyan-300 text-[10px] font-semibold">
                              สำคัญ
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">เพิ่มเติม</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[11px] text-emerald-300/90 whitespace-nowrap">{col.example}</td>
                        <td className="py-1.5 px-2.5 text-[11px] text-slate-300">{col.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3-Step External Form -> Upload -> Confirm & Display Flow */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#060D1A] border border-cyan-950 rounded-xl p-3.5 flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  <div className="font-semibold text-white">ดาวน์โหลดฟอร์มและกรอกข้อมูล</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">ดาวน์โหลดไฟล์โครงสร้าง Excel / CSV / JSON ด้านบน แล้วกรอกหรือแก้ไขข้อมูลในเครื่องของท่าน</p>
                </div>
              </div>
              <div className="bg-[#060D1A] border border-cyan-950 rounded-xl p-3.5 flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  <div className="font-semibold text-white">อัปโหลดไฟล์และตรวจสอบพรีวิว</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">ลากวางหรือเลือกไฟล์ที่บันทึกแล้ว ระบบตรวจสอบโครงสร้าง รหัสโครงการซ้ำ และสรุปยอดงบให้ทันที</p>
                </div>
              </div>
              <div className="bg-[#060D1A] border border-cyan-950 rounded-xl p-3.5 flex items-start gap-2.5">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono font-bold flex items-center justify-center shrink-0">3</span>
                <div>
                  <div className="font-semibold text-white">กดยืนยันส่งและแสดงผลทันที</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">กดปุ่ม "ยืนยันส่งและแสดงผลข้อมูลทันที" ระบบบันทึกลงฐานข้อมูลและอัปเดตหน้าแดชบอร์ดทันที</p>
                </div>
              </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingFile(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingFile(false);
              }}
              onDrop={handleDropFile}
              className={`rounded-xl p-5 border-2 border-dashed flex flex-col sm:flex-row items-center justify-between gap-4 transition-all ${
                isDraggingFile
                  ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.2)]'
                  : 'bg-[#060D1A] border-cyan-700/70 hover:border-cyan-400'
              }`}
            >
              <div className="flex items-center gap-3.5 text-center sm:text-left">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0 hidden sm:flex">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="font-semibold text-sm text-white">
                    {isDraggingFile
                      ? 'ปล่อยไฟล์ที่นี่เพื่อตรวจสอบโครงสร้างและนำเข้าข้อมูล...'
                      : 'ลากไฟล์มาวางที่นี่ หรือเลือกไฟล์ตามฟอร์มมาตรฐาน (.xlsx, .xls, .csv, .json)'}
                  </div>
                  <p className="text-xs text-slate-400">
                    จับคู่ด้วย <span className="text-cyan-300 font-mono">รหัสโครงการ</span> อัตโนมัติ · รองรับทั้งการอัปเดตโครงการเดิมและการเพิ่มโครงการใหม่
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.json"
                  onChange={(e) => void handleFileSelected(e.target.files?.[0])}
                  className="hidden"
                  id="sadi-file-import-input"
                />
                <label
                  htmlFor="sadi-file-import-input"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.25)] cursor-pointer transition-all whitespace-nowrap"
                >
                  {isParsingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>{isParsingFile ? 'กำลังอ่านและตรวจสอบไฟล์...' : 'เลือกไฟล์นำเข้าข้อมูล'}</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                สำหรับการซิงก์ข้อมูลจากลิงก์ Google Sheet หลักของสถาบัน สงวนสิทธิ์ไว้ที่เมนู <strong className="text-slate-200">Admin → ซิงก์ Google Sheets</strong> เพื่อรักษาลิงก์กลางไม่ให้ถูกแก้ไขโดยไม่ตั้งใจ
              </span>
            </div>
          </div>

          <ImportPreviewConfirmPanel
            projects={projects}
            currentUserName={currentUser.name}
            importPreview={importPreview}
            importError={importError}
            importSuccessMessage={importSuccessMessage}
            onClearError={() => setImportError(null)}
            onCancelPreview={() => setImportPreview(null)}
            onConfirmImport={handleConfirmFileImport}
            onGoToDashboard={onGoToDashboard}
            onGoToCatalogPage={onGoToCatalogPage}
          />
        </div>
      )}

      {/* User-Friendly Step-by-Step Guide Panel */}
      {showGuide && (
        <div className="bg-[#071124] border border-cyan-700/50 rounded-2xl p-5 shadow-[0_6px_25px_rgba(6,182,212,0.08)] space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-950 pb-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-sm text-white">
                คู่มือวิธีการปรับปรุงข้อมูลโครงการ (สำหรับผู้มีรายชื่อ)
              </h3>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="text-[11px] text-slate-400 hover:text-cyan-300 cursor-pointer"
            >
              ย่อคู่มือ ▲
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#060D1A] border border-cyan-950 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-cyan-300">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-mono text-[11px]">1</span>
                <span>วิธีที่ 1: แก้ไขทีละโครงการ</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                กดปุ่ม <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-semibold"><Edit className="w-3 h-3" /> แก้ไข</span> ที่คอลัมน์ <strong>"การจัดการ"</strong> ด้านขวาสุดของตาราง
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#060D1A] border border-cyan-950 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-blue-300">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center font-mono text-[11px]">2</span>
                <span>วิธีที่ 2: แก้ไขหลายรายการพร้อมกัน (Bulk Edit)</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                กดปุ่ม <strong>"แก้ไขปรับปรุง รายการทั้งหมด (Bulk Edit)"</strong> เพื่อเปิดช่องกรอกในตาราง จากนั้นกดปุ่มสีเขียว <strong>"บันทึกการแก้ไขทั้งหมด"</strong>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#060D1A] border border-cyan-950 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-mono text-[11px]">3</span>
                <span>วิธีที่ 3: นำเข้าไฟล์ Excel หรือ CSV</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                ดาวน์โหลดไฟล์ตัวอย่างด้านบน แก้ไขข้อมูลใน Excel/CSV แล้วนำเข้าผ่านช่องอัปโหลด ผลลัพธ์จะแสดงที่ <strong>หน้าข้อมูลโครงการ</strong> ทันที
              </p>
            </div>
          </div>
        </div>
      )}

      {activeWorkspaceMode === 'direct_edit' && (
        <>
      {/* Control Bar: Filters, Smart Search, Bulk Edit & Add */}
      <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-5 shadow-md space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <ProjectSearchAutocomplete
            onSelectProject={(project) => onOpenProjectDetail(project.id)}
            placeholder="พิมพ์คีย์เวิร์ดค้นหาโครงการที่ต้องการปรับปรุง (ชื่อ, รหัส, กลุ่มเป้าหมาย)..."
            className="flex-1 max-w-xl"
          />

          <div className="flex flex-wrap items-center gap-2.5">
            {canEdit && (
              <>
                {isBulkEditMode ? (
                  <>
                    <button
                      onClick={handleSaveBulkEdit}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 flex items-center gap-2 shadow-md cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>บันทึกการแก้ไขทั้งหมด</span>
                    </button>
                    <button
                      onClick={handleToggleBulkEdit}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleToggleBulkEdit}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-cyan-800/60 bg-[#0A1730] text-cyan-200 hover:bg-[#0E2248] hover:text-white flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5 text-cyan-400" />
                    <span>แก้ไขปรับปรุง รายการทั้งหมด (Bulk Edit)</span>
                  </button>
                )}
              </>
            )}

            {canEdit && (
              <button
                onClick={onOpenAddModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มโครงการใหม่</span>
              </button>
            )}
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

      {/* Main Editable Table with Synced Top & Bottom Prominent Scrollbars */}
      <div className="bg-[#091224] border border-cyan-900/50 rounded-2xl shadow-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-[#071022] border-b border-cyan-900/60 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-cyan-300 font-medium">
              <MousePointerClick className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>เลื่อนแถบสีฟ้าซ้าย-ขวา หรือใช้ปุ่มลูกศร เพื่อดูคอลัมน์งบประมาณและปุ่มแก้ไข</span>
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
                <th className="py-3.5 px-3 min-w-[160px]">ดำเนินการจริง (เปลี่ยนแปลงได้)</th>
                <th className="py-3.5 px-2 w-20 text-center font-mono">จำนวนรุ่น</th>
                <th className="py-3.5 px-3 w-28 text-center font-mono">คนเข้าอบรม</th>
                <th className="py-3.5 px-3 text-right w-32 font-mono">งบจัดสรร (บาท)</th>
                <th className="py-3.5 px-3 text-right w-36 font-mono">ใช้จ่ายจริง (บาท)</th>
                <th className="py-3.5 px-3 text-right w-32 font-mono">คงเหลือ (บาท)</th>
                <th className="sticky right-0 z-30 bg-[#060D1A] py-3.5 px-3 w-28 text-center border-l border-cyan-900/50 shadow-[-6px_0_12px_rgba(4,9,20,0.6)]">
                  การจัดการ
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-cyan-950/60">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 text-xs">
                    ไม่พบโครงการที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p, idx) => {
                  const isRowInlineEditing = !isBulkEditMode && inlineEditId === p.id && inlineDraft !== null;
                  const row = isRowInlineEditing ? inlineDraft : p;
                  const isEditingCell = (isBulkEditMode || isRowInlineEditing) && canEdit;
                  const remaining = row.budgetAllocated - row.budgetActual;
                  const rate = row.budgetAllocated > 0 ? (row.budgetActual / row.budgetAllocated) * 100 : 0;

                  const handleFieldChange = (field: keyof Project, value: unknown) => {
                    if (isBulkEditMode) {
                      handleBulkChange(p.id, field, value);
                    } else if (isRowInlineEditing && inlineDraft) {
                      setInlineDraft({ ...inlineDraft, [field]: value });
                    }
                  };

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors group ${
                        isRowInlineEditing
                          ? 'bg-cyan-950/35'
                          : recentlySavedId === p.id
                          ? 'bg-emerald-950/30'
                          : 'hover:bg-[#0A1730]'
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-slate-500 font-mono tabular-nums">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-4 whitespace-normal max-w-sm">
                        <button
                          onClick={() => onOpenProjectDetail(p.id)}
                          className="text-left font-semibold text-white hover:text-cyan-300 transition-colors cursor-pointer leading-tight block"
                        >
                          {row.name}
                        </button>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span className="font-mono text-cyan-400">{row.code}</span>
                          <span>·</span>
                          <span className="truncate max-w-[180px]">{row.targetGroup}</span>
                          {recentlySavedId === p.id && (
                            <span className="text-emerald-400 font-semibold">· บันทึกแล้ว ✓</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-xs text-slate-300">
                        {row.fundingSource === 'budget_annual' ? 'งบประมาณแผ่นดิน' : 'เงินกองทุน สตง.'}
                      </td>

                      <td className="py-3 px-3">
                        {isEditingCell ? (
                          <select
                            value={row.status}
                            onChange={(e) => handleFieldChange('status', e.target.value as ProjectStatus)}
                            className="w-full px-2 py-1 text-xs rounded border border-cyan-500 bg-[#060D1A] text-white font-medium"
                          >
                            <option value="in_progress">อยู่ระหว่างดำเนินการ</option>
                            <option value="not_started">ยังไม่ได้ดำเนินการ</option>
                            <option value="completed">ดำเนินการเสร็จแล้ว</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-1.5 font-medium">
                            {row.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> เสร็จแล้ว
                              </span>
                            ) : row.status === 'in_progress' ? (
                              <span className="inline-flex items-center gap-1 text-cyan-300">
                                <Clock className="w-3.5 h-3.5 text-cyan-400" /> อยู่ระหว่างดำเนินการ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-300">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> ยังไม่ได้ดำเนินการ
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-2 text-center font-mono font-medium text-slate-300">
                        {row.quarters.join(', ')}
                      </td>

                      <td className="py-3 px-3 whitespace-normal max-w-xs">
                        {isEditingCell ? (
                          <input
                            type="text"
                            value={row.actualDateOrQuarter || ''}
                            onChange={(e) => handleFieldChange('actualDateOrQuarter', e.target.value)}
                            placeholder="ระบุวันจัดจริง..."
                            className="w-full px-2 py-1 rounded border border-cyan-500 bg-[#060D1A] text-white text-xs font-mono"
                          />
                        ) : (
                          <span className="text-slate-300 font-mono text-[11px]">
                            {row.actualDateOrQuarter || row.executionDateSchedule || '-'}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-2 text-center font-mono tabular-nums">
                        {isEditingCell ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={row.batchesActual}
                              onChange={(e) => handleFieldChange('batchesActual', Number(e.target.value))}
                              className="w-12 px-1 py-1 text-center rounded border border-cyan-500 bg-[#060D1A] text-white font-bold"
                            />
                            <span className="text-slate-500">/{row.batchesPlanned}</span>
                          </div>
                        ) : (
                          <span>
                            <strong className="text-white">{row.batchesActual}</strong> / {row.batchesPlanned}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center font-mono tabular-nums">
                        {isEditingCell ? (
                          <input
                            type="number"
                            min="0"
                            value={row.participantsActual}
                            onChange={(e) => handleFieldChange('participantsActual', Number(e.target.value))}
                            className="w-16 px-1 py-1 text-center rounded border border-cyan-500 bg-[#060D1A] text-white font-bold"
                          />
                        ) : (
                          <div>
                            <span className="font-bold text-white">{row.participantsActual}</span>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              แผน {row.participantsPlanned} คน ({row.participantsPerBatch}/รุ่น)
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-medium text-slate-200 tabular-nums">
                        ฿{row.budgetAllocated.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {isEditingCell ? (
                          <input
                            type="number"
                            min="0"
                            value={row.budgetActual}
                            onChange={(e) => handleFieldChange('budgetActual', Number(e.target.value))}
                            className="w-28 px-1.5 py-1 text-right rounded border border-cyan-500 bg-[#060D1A] text-white font-bold"
                          />
                        ) : (
                          <div>
                            <span className="font-bold text-slate-300">
                              ฿{row.budgetActual.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-cyan-400/80 block font-normal">
                              ({rate.toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-emerald-400 font-bold tabular-nums">
                        ฿{remaining.toLocaleString()}
                      </td>

                      <td className="sticky right-0 z-10 bg-[#091224] group-hover:bg-[#0A1730] py-3 px-3 text-center border-l border-cyan-900/50 shadow-[-6px_0_12px_rgba(4,9,20,0.5)]">
                        <div className="flex items-center justify-center gap-1">
                          {isRowInlineEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={handleSaveInlineEdit}
                                title="บันทึกการแก้ไขแถวนี้ทันที"
                                className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span className="text-[11px]">บันทึก</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelInlineEdit}
                                title="ยกเลิก"
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              {canEdit && !isBulkEditMode && (
                                <button
                                  type="button"
                                  onClick={() => handleStartInlineEdit(p)}
                                  title="แก้ไขด่วนในตารางทันที"
                                  className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-400 hover:text-slate-950 font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  <span className="text-[11px]">แก้ไขด่วน</span>
                                </button>
                              )}

                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => onOpenEditModal(p)}
                                  title="แก้ไขรายละเอียดโครงการทั้งหมด"
                                  className="px-2 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-400 hover:text-slate-950 font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span className="text-[11px]">รายละเอียด</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onOpenProjectDetail(p.id)}
                                title="ดูรายละเอียดโครงการ"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-[#0C1D3D] transition-colors cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm(`ยืนยันการลบโครงการ "${p.name}"?`)) {
                                      deleteProject(p.id);
                                    }
                                  }}
                                  title="ลบโครงการ"
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
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
                <td className="sticky right-0 bg-[#060D1A] border-l border-cyan-900/50"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
