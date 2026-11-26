import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  History,
  Shield,
  UserCheck,
  UserPlus,
  Trash2,
  Download,
  RotateCcw,
  Search,
  FileText,
  Cloud,
  Lock,
  FolderKanban,
  Pencil,
  Eye,
  Plus,
  BarChart3,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  X,
} from 'lucide-react';
import { GoogleSheetsSyncPanel } from './GoogleSheetsSyncPanel';
import { ImportPreviewConfirmPanel } from './ImportPreviewConfirmPanel';
import { statusToTh, type ImportParseResult } from '../utils/spreadsheet';
import {
  detectSystemDuplicates,
  getDuplicateReasonLabel,
} from '../utils/duplicateDetection';
import type { FundingSource, Project, ProjectStatus } from '../types';

interface AdminAuditLogsViewProps {
  onImportCompleteAndDisplay?: () => void;
  onGoToDashboard?: () => void;
  onGoToCatalogPage?: () => void;
  onOpenEditModal?: (project: Project) => void;
  onOpenAddModal?: () => void;
  onOpenProjectDetail?: (projectId: string) => void;
}

type AdminSubTab = 'sheets' | 'projects' | 'logs' | 'users' | 'backup';

type ConfirmModalState =
  | { type: 'delete_single_project'; project: Project }
  | { type: 'delete_bulk_projects'; projectsToDelete: Project[] }
  | { type: 'remove_user'; userId: string; userName: string }
  | { type: 'reset_all' }
  | null;

function isPlaceholderName(name: string): boolean {
  const normalized = name.replace(/[\s()[\]（）]/g, '').toLowerCase();
  return (
    !normalized ||
    normalized === 'เพิ่มชื่อโครงการใหม่' ||
    normalized === 'กรอกชื่อโครงการใหม่' ||
    normalized === 'ชื่อโครงการใหม่' ||
    normalized === 'ระบุชื่อโครงการ'
  );
}

export const AdminAuditLogsView: React.FC<AdminAuditLogsViewProps> = ({
  onImportCompleteAndDisplay,
  onGoToDashboard,
  onGoToCatalogPage,
  onOpenEditModal,
  onOpenAddModal,
  onOpenProjectDetail,
}) => {
  const {
    projects,
    currentUser,
    auditLogs,
    authorizedUsers,
    addAuthorizedUser,
    removeAuthorizedUser,
    importProjectsFromFile,
    bulkUpdateProjects,
    deleteProject,
    resetAllData,
    exportDataToJSON,
    exportDataToCSV,
    exportServerDatabaseSnapshot,
    refreshFromDatabase,
    dbHealth,
    dbSyncState,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>('sheets');
  const [logSearch, setLogSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'create' | 'update' | 'delete' | 'bulk_update'>('all');

  // Admin Project Management State
  const [projectSearch, setProjectSearch] = useState('');
  const [projectFundingFilter, setProjectFundingFilter] = useState<FundingSource | 'all'>('all');
  const [projectStatusFilter, setProjectStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [projectActionBanner, setProjectActionBanner] = useState<string | null>(null);
  const [isDeletingProjects, setIsDeletingProjects] = useState(false);

  // In-app Confirmation Modal State (replaces browser confirm())
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);

  // Admin Google Sheets Sync Preview State
  const [sheetImportPreview, setSheetImportPreview] = useState<ImportParseResult | null>(null);
  const [sheetImportError, setSheetImportError] = useState<string | null>(null);
  const [sheetImportSuccess, setSheetImportSuccess] = useState<string | null>(null);

  const handleConfirmSheetImport = async (
    mergedProjects: Project[],
    summaryNote: string,
    meta: { fileName: string; updatedCount: number; newCount: number; affectedIds: string[] },
    navigateToDisplayImmediately: boolean
  ) => {
    setSheetImportError(null);
    try {
      await importProjectsFromFile(mergedProjects, summaryNote, meta);
      setSheetImportPreview(null);
      if (navigateToDisplayImmediately && onImportCompleteAndDisplay) {
        onImportCompleteAndDisplay();
      } else {
        setSheetImportSuccess(
          `อัปเดตข้อมูลจาก "${meta.fileName}" สำเร็จ (คงเหลือข้อมูลที่ใช้งานจริงทั้งหมด ${mergedProjects.length} โครงการ) และแสดงผลเป็นปัจจุบันแล้ว`
        );
      }
    } catch (err) {
      setSheetImportError(
        err instanceof Error ? err.message : 'เกิดข้อผิดพลาดระหว่างบันทึกข้อมูลจาก Google Sheets'
      );
    }
  };

  // New User Form State
  const [showAddUser, setShowAddUser] = useState(false);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('สถาบันพัฒนาการตรวจเงินแผ่นดิน (SADI)');
  const [role, setRole] = useState<'editor' | 'admin'>('editor');
  const [email, setEmail] = useState('');

  // Project Management Derived Data
  const placeholderProjects = useMemo(
    () => projects.filter((p) => isPlaceholderName(p.name)),
    [projects]
  );

  // Automatic System-Wide Duplicate & Budget Overlap Audit
  const systemDuplicates = useMemo(() => detectSystemDuplicates(projects), [projects]);

  const duplicateIdSet = useMemo(() => {
    const ids = new Set<string>();
    systemDuplicates.forEach((pair) => {
      ids.add(pair.projectA.id);
      ids.add(pair.projectB.id);
    });
    return ids;
  }, [systemDuplicates]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    return projects.filter((p) => {
      const matchSearch =
        !q ||
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.targetGroup.toLowerCase().includes(q);
      const matchFunding = projectFundingFilter === 'all' || p.fundingSource === projectFundingFilter;
      const matchStatus = projectStatusFilter === 'all' || p.status === projectStatusFilter;
      const matchDup = !showOnlyDuplicates || duplicateIdSet.has(p.id);
      return matchSearch && matchFunding && matchStatus && matchDup;
    });
  }, [projects, projectSearch, projectFundingFilter, projectStatusFilter, showOnlyDuplicates, duplicateIdSet]);

  const projectTotals = useMemo(() => {
    const totalAllocated = projects.reduce((s, p) => s + p.budgetAllocated, 0);
    const totalActual = projects.reduce((s, p) => s + p.budgetActual, 0);
    const rate = totalAllocated > 0 ? (totalActual / totalAllocated) * 100 : 0;
    return {
      count: projects.length,
      totalAllocated,
      totalActual,
      rate,
    };
  }, [projects]);

  const selectedSet = useMemo(() => new Set(selectedProjectIds), [selectedProjectIds]);
  const allFilteredSelected =
    filteredProjects.length > 0 && filteredProjects.every((p) => selectedSet.has(p.id));

  const toggleSelectProject = (id: string) => {
    setSelectedProjectIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filteredProjects.map((p) => p.id));
      setSelectedProjectIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const merged = new Set([...selectedProjectIds, ...filteredProjects.map((p) => p.id)]);
      setSelectedProjectIds(Array.from(merged));
    }
  };

  const handleConfirmModalAction = async () => {
    if (!confirmModal) return;

    if (confirmModal.type === 'delete_single_project') {
      const target = confirmModal.project;
      setConfirmModal(null);
      deleteProject(target.id);
      setSelectedProjectIds((prev) => prev.filter((id) => id !== target.id));
      setProjectActionBanner(
        `ลบโครงการ "${target.code} — ${target.name}" ออกจากระบบและอัปเดตหน้า Dashboard เป็นปัจจุบันเรียบร้อยแล้ว`
      );
      return;
    }

    if (confirmModal.type === 'delete_bulk_projects') {
      const targets = confirmModal.projectsToDelete;
      const deleteIdSet = new Set(targets.map((p) => p.id));
      const remaining = projects.filter((p) => !deleteIdSet.has(p.id));
      const codesPreview = targets
        .slice(0, 6)
        .map((p) => p.code)
        .join(', ');
      const suffix = targets.length > 6 ? ` และอีก ${targets.length - 6} รายการ` : '';
      const auditNote = `ผู้ดูแลระบบลบโครงการที่ไม่ใช้งานออก ${targets.length} รายการ (${codesPreview}${suffix}) คงเหลือ ${remaining.length} โครงการ`;

      setIsDeletingProjects(true);
      try {
        await bulkUpdateProjects(remaining, auditNote);
        setSelectedProjectIds([]);
        setConfirmModal(null);
        setProjectActionBanner(
          `ลบโครงการที่เลือกจำนวน ${targets.length} รายการเรียบร้อยแล้ว (คงเหลือ ${remaining.length} โครงการ) หน้า Dashboard แสดงผลเป็นปัจจุบันแล้ว`
        );
      } finally {
        setIsDeletingProjects(false);
      }
      return;
    }

    if (confirmModal.type === 'remove_user') {
      removeAuthorizedUser(confirmModal.userId);
      setConfirmModal(null);
      return;
    }

    if (confirmModal.type === 'reset_all') {
      resetAllData();
      setSelectedProjectIds([]);
      setConfirmModal(null);
    }
  };

  // Filtered audit logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const q = logSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        log.projectName.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.fieldChanged.toLowerCase().includes(q) ||
        (log.notes && log.notes.toLowerCase().includes(q));

      const matchAction = actionFilter === 'all' || log.actionType === actionFilter;

      return matchSearch && matchAction;
    });
  }, [auditLogs, logSearch, actionFilter]);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !position.trim()) return;

    addAuthorizedUser({
      name: name.trim(),
      position: position.trim(),
      department: department.trim(),
      email: email.trim() || `${Date.now()}@sao.go.th`,
      role,
      avatarText: name.slice(0, 2),
    });

    setName('');
    setPosition('');
    setEmail('');
    setShowAddUser(false);
  };

  const renderStatusBadge = (status: ProjectStatus) => {
    if (status === 'completed') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
          {statusToTh(status)}
        </span>
      );
    }
    if (status === 'in_progress') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40">
          {statusToTh(status)}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
        {statusToTh(status)}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-slate-100">
      {/* Admin Header (Carbon Blue Style) */}
      <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-6 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>ศูนย์บริหารจัดการระบบและบันทึกประวัติการเปลี่ยนแปลง (Admin Operations)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              หน้าสำหรับ Admin: ซิงก์ข้อมูล, จัดการโครงการ & บริหารสิทธิ์
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              ควบคุมลิงก์ Google Sheets หลักของสถาบัน แก้ไขหรือลบโครงการที่ไม่ใช้งานแล้วให้หน้า Dashboard แสดงผลเป็นปัจจุบัน พร้อมตรวจสอบประวัติย้อนหลัง
            </p>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex flex-wrap p-1 bg-[#060D1A] rounded-xl border border-cyan-950 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('sheets')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'sheets'
                  ? 'bg-emerald-500/25 text-emerald-200 shadow-xs border border-emerald-600/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>ซิงก์ Google Sheets</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('projects')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'projects'
                  ? 'bg-cyan-500/25 text-cyan-200 shadow-xs border border-cyan-600/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5 text-cyan-400" />
              <span>จัดการโครงการ ({projects.length})</span>
              {placeholderProjects.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded bg-amber-500/25 border border-amber-500/50 text-amber-300 text-[10px] font-mono">
                  !{placeholderProjects.length}
                </span>
              )}
              {systemDuplicates.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded bg-rose-500/25 border border-rose-500/50 text-rose-200 text-[10px] font-semibold">
                  ซ้ำ {systemDuplicates.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('logs')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'logs'
                  ? 'bg-cyan-500/25 text-cyan-300 shadow-xs border border-cyan-700/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>ประวัติ ({auditLogs.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('users')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'users'
                  ? 'bg-cyan-500/25 text-cyan-300 shadow-xs border border-cyan-700/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>ผู้มีสิทธิ์ ({authorizedUsers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('backup')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'backup'
                  ? 'bg-cyan-500/25 text-cyan-300 shadow-xs border border-cyan-700/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>สำรอง & คืนค่า</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 0: ADMIN-ONLY GOOGLE SHEETS LINK SYNC */}
      {activeSubTab === 'sheets' && (
        <div className="bg-[#091224] border border-emerald-800/50 rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgba(16,185,129,0.08)] space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-cyan-950 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-sm sm:text-base text-white flex flex-wrap items-center gap-2">
                  <span>นำเข้าและซิงก์ข้อมูลจากลิงก์ Google Sheet หลัก (สิทธิ์เฉพาะ Admin)</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                    Active Sync · ตรงตามชีตล่าสุด
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  ระบบจะอัปเดตตามข้อมูลใน Google Sheet ล่าสุดแบบ Active: แถวที่ถูกลบหรือเคลียร์ค่าออกในชีตจะถูกลบออกจากระบบโดยอัตโนมัติ (ไม่เก็บยอดค้างเดิม) เพื่อให้หน้า Dashboard ตรงกับข้อมูลปัจจุบัน 100%
                </p>
              </div>
            </div>

            {placeholderProjects.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveSubTab('projects')}
                className="px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 text-amber-200 text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>พบข้อมูลค้าง/ไม่สมบูรณ์ {placeholderProjects.length} รายการ · ไปจัดการ</span>
              </button>
            )}
          </div>

          <GoogleSheetsSyncPanel
            projects={projects}
            onParsedResult={(result) => {
              setSheetImportError(null);
              setSheetImportSuccess(null);
              setSheetImportPreview(result);
            }}
            onError={(msg) => {
              if (msg) setSheetImportPreview(null);
              setSheetImportError(msg);
            }}
          />

          <ImportPreviewConfirmPanel
            projects={projects}
            currentUserName={currentUser.name}
            importPreview={sheetImportPreview}
            importError={sheetImportError}
            importSuccessMessage={sheetImportSuccess}
            defaultRemoveMissing={true}
            onClearError={() => setSheetImportError(null)}
            onCancelPreview={() => setSheetImportPreview(null)}
            onConfirmImport={handleConfirmSheetImport}
            onGoToDashboard={onGoToDashboard}
            onGoToCatalogPage={onGoToCatalogPage}
          />
        </div>
      )}

      {/* SUB-TAB 1: ADMIN PROJECT MANAGEMENT (EDIT / ADD / DELETE) */}
      {activeSubTab === 'projects' && (
        <div className="space-y-4">
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-4">
              <div className="text-[11px] text-slate-400">จำนวนโครงการที่แสดงผลปัจจุบัน</div>
              <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
                {projectTotals.count} <span className="text-xs font-sans font-normal text-slate-400">โครงการ</span>
              </div>
            </div>
            <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-4">
              <div className="text-[11px] text-slate-400">กรอบงบประมาณจัดสรรรวม</div>
              <div className="text-xl font-bold font-mono tabular-nums text-cyan-300 mt-1">
                ฿{projectTotals.totalAllocated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-4">
              <div className="text-[11px] text-slate-400">ยอดเบิกจ่ายจริงสะสมปัจจุบัน</div>
              <div className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                ฿{projectTotals.totalActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-4">
              <div className="text-[11px] text-slate-400">ร้อยละการเบิกจ่ายรวม</div>
              <div className="text-xl font-bold font-mono tabular-nums text-white mt-1">
                {projectTotals.rate.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Automatic Duplicate & Budget Overlap Audit Panel */}
          {systemDuplicates.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-950/35 border border-rose-500/60 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-200">
                      ระบบตรวจจับข้อมูลซ้ำซ้อนอัตโนมัติ: พบโครงการหรืองบประมาณอาจซ้ำซ้อน {systemDuplicates.length} คู่ (แม้อยู่คนละรหัส)
                    </div>
                    <p className="text-rose-100/80 text-[11px] mt-0.5">
                      สามารถตรวจสอบ แก้ไข หรือลบรายการซ้ำซ้อนออกได้ทันทีเพื่อให้ยอดรวมบน Dashboard ถูกต้องเป็นปัจจุบัน
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOnlyDuplicates((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-xl font-semibold text-xs shrink-0 cursor-pointer border ${
                    showOnlyDuplicates
                      ? 'bg-rose-500 text-white border-rose-400'
                      : 'bg-rose-950/60 text-rose-200 border-rose-600/60 hover:bg-rose-900/60'
                  }`}
                >
                  {showOnlyDuplicates ? 'แสดงโครงการทั้งหมด' : `กรองเฉพาะรายการที่ซ้ำซ้อน (${duplicateIdSet.size})`}
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {systemDuplicates.map((pair) => (
                  <div
                    key={pair.id}
                    className="p-2.5 rounded-xl bg-[#060D1A]/90 border border-rose-900/60 flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 font-semibold text-white">
                        <span className="font-mono text-cyan-300 px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800">
                          {pair.projectA.code}
                        </span>
                        <span className="truncate max-w-[230px]">{pair.projectA.name}</span>
                        <span className="text-rose-400 font-bold">↔</span>
                        <span className="font-mono text-rose-300 px-1.5 py-0.2 rounded bg-rose-950 border border-rose-700">
                          {pair.projectB.code}
                        </span>
                        <span className="truncate max-w-[230px]">{pair.projectB.name}</span>
                      </div>
                      <div className="text-amber-300">
                        {getDuplicateReasonLabel(pair.reason)} — {pair.explanation}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onOpenEditModal && (
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(pair.projectB)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-700/60 text-cyan-200 font-semibold cursor-pointer"
                        >
                          แก้ไข {pair.projectB.code}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmModal({
                            type: 'delete_single_project',
                            project: pair.projectB,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-rose-600/85 hover:bg-rose-500 text-white font-semibold cursor-pointer"
                      >
                        ลบ {pair.projectB.code}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Placeholder / Stale Row Warning Callout */}
          {placeholderProjects.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/35 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-200">
                    ตรวจพบข้อมูลแถวตัวอย่าง/ไม่สมบูรณ์ค้างในระบบ {placeholderProjects.length} รายการ
                  </div>
                  <p className="text-amber-100/80 mt-0.5">
                    รายการเช่น{' '}
                    <span className="font-mono font-semibold text-white">
                      {placeholderProjects.map((p) => `${p.code} (เบิกจ่าย ฿${p.budgetActual.toLocaleString()})`).join(', ')}
                    </span>{' '}
                    อาจเป็นข้อมูลค้างจากการนำเข้าก่อนหน้า สามารถกดลบออกทันทีเพื่อให้หน้า Dashboard แสดงยอดที่ถูกต้องเป็นปัจจุบัน
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setConfirmModal({
                    type: 'delete_bulk_projects',
                    projectsToDelete: placeholderProjects,
                  })
                }
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ลบรายการค้างออกทันที ({placeholderProjects.length})</span>
              </button>
            </div>
          )}

          {/* Action Success Banner */}
          {projectActionBanner && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-200 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{projectActionBanner}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onGoToDashboard && (
                  <button
                    type="button"
                    onClick={onGoToDashboard}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>ดูผลบน Dashboard ปัจจุบัน</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setProjectActionBanner(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                  aria-label="ปิดข้อความแจ้งเตือน"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Filter & Action Toolbar */}
          <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-4 shadow-sm space-y-3 text-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="ค้นหารหัส, ชื่อโครงการ, หมวดหมู่..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-400"
                  />
                </div>

                <select
                  value={projectFundingFilter}
                  onChange={(e) => setProjectFundingFilter(e.target.value as FundingSource | 'all')}
                  className="px-2.5 py-1.5 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-slate-200"
                >
                  <option value="all">ทุกแหล่งงบประมาณ</option>
                  <option value="budget_annual">งบประมาณรายจ่ายประจำปี</option>
                  <option value="budget_fund">เงินกองทุน สตง.</option>
                </select>

                <select
                  value={projectStatusFilter}
                  onChange={(e) => setProjectStatusFilter(e.target.value as ProjectStatus | 'all')}
                  className="px-2.5 py-1.5 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-slate-200"
                >
                  <option value="all">ทุกสถานะโครงการ</option>
                  <option value="completed">ดำเนินการเสร็จแล้ว</option>
                  <option value="in_progress">อยู่ระหว่างดำเนินการ</option>
                  <option value="not_started">ยังไม่ได้ดำเนินการ</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onOpenAddModal && (
                  <button
                    type="button"
                    onClick={onOpenAddModal}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มโครงการใหม่</span>
                  </button>
                )}
                {onGoToDashboard && (
                  <button
                    type="button"
                    onClick={onGoToDashboard}
                    className="px-3.5 py-1.5 rounded-xl border border-cyan-800/70 bg-[#0A1730] hover:bg-cyan-500/20 text-cyan-200 font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ดูผลบน Dashboard ปัจจุบัน</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bulk Selection Action Bar */}
            {selectedProjectIds.length > 0 && (
              <div className="pt-3 border-t border-cyan-950 flex flex-wrap items-center justify-between gap-2">
                <span className="text-rose-200 font-semibold">
                  เลือกอยู่ {selectedProjectIds.length} โครงการ
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProjectIds([])}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                  >
                    ยกเลิกการเลือก
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targets = projects.filter((p) => selectedSet.has(p.id));
                      if (targets.length > 0) {
                        setConfirmModal({
                          type: 'delete_bulk_projects',
                          projectsToDelete: targets,
                        });
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ลบโครงการที่เลือก ({selectedProjectIds.length} รายการ)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Projects Management Table */}
          <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#060D1A] text-cyan-200 font-semibold border-b border-cyan-950">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        aria-label="เลือกทั้งหมด"
                        className="rounded border-cyan-800 bg-[#060D1A] accent-cyan-400 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-2.5 w-12 text-center font-mono">ลำดับ</th>
                    <th className="py-3 px-3 font-mono">รหัสโครงการ</th>
                    <th className="py-3 px-3 min-w-[260px]">ชื่อโครงการ / หลักสูตร</th>
                    <th className="py-3 px-3">แหล่งงบประมาณ</th>
                    <th className="py-3 px-3">สถานะ</th>
                    <th className="py-3 px-3 text-right font-mono">งบจัดสรร (บาท)</th>
                    <th className="py-3 px-3 text-right font-mono">เบิกจ่ายจริง (บาท)</th>
                    <th className="py-3 px-3 text-center">เครื่องมือ Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-950/60">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-500">
                        ไม่พบข้อมูลโครงการที่ตรงกับเงื่อนไขการค้นหา
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project, idx) => {
                      const isPlaceholder = isPlaceholderName(project.name);
                      const isSuspectedDuplicate = duplicateIdSet.has(project.id);
                      const isChecked = selectedSet.has(project.id);
                      return (
                        <tr
                          key={project.id}
                          className={`transition-colors ${
                            isSuspectedDuplicate
                              ? 'bg-rose-950/20 hover:bg-rose-950/35'
                              : isPlaceholder
                              ? 'bg-amber-950/20 hover:bg-amber-950/35'
                              : isChecked
                              ? 'bg-cyan-950/30 hover:bg-cyan-950/45'
                              : 'hover:bg-[#0A1730]'
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectProject(project.id)}
                              aria-label={`เลือก ${project.code}`}
                              className="rounded border-cyan-800 bg-[#060D1A] accent-cyan-400 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-2.5 text-center font-mono text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded-md">
                              {project.code}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-normal max-w-md">
                            <div className="font-semibold text-white flex flex-wrap items-center gap-1.5">
                              <span>{project.name}</span>
                              {isSuspectedDuplicate && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/50 text-rose-200">
                                  อาจซ้ำซ้อน
                                </span>
                              )}
                              {isPlaceholder && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300">
                                  แถวตัวอย่าง/ค้างระบบ
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-md">
                              {project.category}
                              {project.lastModifiedAt ? ` · แก้ไขล่าสุด ${project.lastModifiedAt}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            {project.fundingSource === 'budget_annual' ? 'งบประจำปี' : 'เงินกองทุน สตง.'}
                          </td>
                          <td className="py-3 px-3">{renderStatusBadge(project.status)}</td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                            {project.budgetAllocated.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-mono tabular-nums font-bold ${
                              project.budgetActual > 0 ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                          >
                            {project.budgetActual.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1.5">
                              {onOpenProjectDetail && (
                                <button
                                  type="button"
                                  onClick={() => onOpenProjectDetail(project.id)}
                                  title="ดูรายละเอียดโครงการ"
                                  className="p-1.5 rounded-lg border border-cyan-900/60 bg-[#060D1A] text-slate-300 hover:text-cyan-300 hover:border-cyan-500/60 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {onOpenEditModal && (
                                <button
                                  type="button"
                                  onClick={() => onOpenEditModal(project)}
                                  title="แก้ไขข้อมูลโครงการ"
                                  className="px-2.5 py-1.5 rounded-lg border border-cyan-700/60 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>แก้ไข</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmModal({
                                    type: 'delete_single_project',
                                    project,
                                  })
                                }
                                title="ลบโครงการนี้"
                                className="px-2.5 py-1.5 rounded-lg border border-rose-800/70 bg-rose-950/40 hover:bg-rose-600 text-rose-300 hover:text-white font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>ลบ</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: AUDIT LOGS */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="ค้นหาชื่อผู้แก้ไข, โครงการ, ฟิลด์..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-slate-400 font-medium">ประเภทการกระทำ:</span>
              <select
                value={actionFilter}
                onChange={(e) =>
                  setActionFilter(e.target.value as 'all' | 'create' | 'update' | 'delete' | 'bulk_update')
                }
                className="px-2.5 py-1.5 rounded-lg border border-cyan-900/60 bg-[#060D1A] text-slate-200 font-mono"
              >
                <option value="all">ทั้งหมด</option>
                <option value="update">การปรับปรุง (Update)</option>
                <option value="create">การสร้างใหม่ (Create)</option>
                <option value="bulk_update">การแก้ไขกลุ่ม (Bulk)</option>
                <option value="delete">การลบ (Delete)</option>
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#060D1A] text-cyan-200 font-semibold border-b border-cyan-950">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center font-mono">ลำดับ</th>
                    <th className="py-3 px-3 w-40 font-mono">วัน-เวลา (Timestamp)</th>
                    <th className="py-3 px-3 w-44">ผู้ดำเนินการ (Authorized User)</th>
                    <th className="py-3 px-4 min-w-[220px]">ชื่อโครงการที่ถูกปรับปรุง</th>
                    <th className="py-3 px-3 min-w-[180px]">ฟิลด์ที่มีการเปลี่ยนแปลง</th>
                    <th className="py-3 px-3 min-w-[180px]">ค่าเดิม (Before)</th>
                    <th className="py-3 px-3 min-w-[180px]">ค่าใหม่ (After)</th>
                    <th className="py-3 px-4 min-w-[160px]">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-950/60">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500 font-mono">
                        ไม่พบบันทึกประวัติที่ตรงกับเงื่อนไข
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, idx) => (
                      <tr key={log.id} className="hover:bg-[#0A1730]">
                        <td className="py-3 px-3 text-center text-slate-500 font-mono">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                          {log.timestamp}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <span>{log.userName}</span>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                                log.userRole === 'admin'
                                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                  : 'bg-blue-950 text-blue-300 border border-blue-800'
                              }`}
                            >
                              {log.userRole}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-normal max-w-xs text-white font-medium">
                          {log.projectName}
                        </td>
                        <td className="py-3 px-3 text-cyan-300 font-mono">
                          {log.fieldChanged}
                        </td>
                        <td className="py-3 px-3 text-slate-400 font-mono truncate max-w-[200px]">
                          {log.oldValue}
                        </td>
                        <td className="py-3 px-3 text-emerald-400 font-mono font-semibold truncate max-w-[200px]">
                          {log.newValue}
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-normal max-w-[180px]">
                          {log.notes || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: AUTHORIZED USERS */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-base">
                รายชื่อบุคลากรผู้ได้รับสิทธิ์เข้าใช้งานตามเกณฑ์ สตง. 2570
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                เฉพาะผู้มีรายชื่อเท่านั้นจึงจะสามารถเข้าสู่ระบบและบันทึกผลการดำเนินงานจริงได้
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddUser(!showAddUser)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>{showAddUser ? 'ยกเลิก' : '+ เพิ่มรายชื่อผู้ได้รับสิทธิ์'}</span>
            </button>
          </div>

          {/* Form to add user */}
          {showAddUser && (
            <form onSubmit={handleCreateUser} className="bg-[#091224] border border-cyan-900/60 rounded-2xl p-5 shadow-md space-y-4 text-xs">
              <h4 className="font-bold text-cyan-300 text-sm">
                บันทึกรายชื่อผู้ได้รับสิทธิ์ใหม่เข้าสู่ระบบ
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    ชื่อ-นามสกุล *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น นายเอกชัย ภักดี"
                    className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    ตำแหน่ง *
                  </label>
                  <input
                    type="text"
                    required
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="เช่น นักวิชาการตรวจเงินแผ่นดินชำนาญการ"
                    className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    อีเมลประจำตำแหน่ง
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@sao.go.th"
                    className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    หน่วยงาน
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    ระดับสิทธิ์ (Role)
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'editor' | 'admin')}
                    className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white font-semibold"
                  >
                    <option value="editor">Editor (มีสิทธิ์ปรับปรุงข้อมูลโครงการ)</option>
                    <option value="admin">Admin (ผู้ดูแลระบบ + จัดการรายชื่อสิทธิ์)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-3.5 py-1.5 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold shadow-xs cursor-pointer"
                >
                  บันทึกสิทธิ์
                </button>
              </div>
            </form>
          )}

          {/* Authorized Users Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {authorizedUsers.map((user, idx) => (
              <div
                key={user.id}
                className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs border bg-[#060D1A] text-cyan-300 border-cyan-900/60">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white flex items-center gap-2">
                      <span>{user.name}</span>
                      <span className="text-[9px] font-mono px-2 py-0.2 rounded font-semibold border bg-slate-900 text-slate-300 border-slate-800">
                        {user.role.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{user.position}</p>
                    <p className="text-[11px] text-slate-500">{user.department}</p>
                  </div>
                </div>

                {authorizedUsers.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmModal({
                        type: 'remove_user',
                        userId: user.id,
                        userName: user.name,
                      })
                    }
                    title="เพิกถอนสิทธิ์"
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: BACKUP & SYSTEM RECOVERY */}
      {activeSubTab === 'backup' && (
        <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-6 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-white text-base">
                การสำรองข้อมูลและตรวจสอบความเสถียรฐานข้อมูล (Database & File Base)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                ระบบจัดเก็บข้อมูลลงไฟล์ JSON แบบ Atomic Write พร้อมตรวจสอบความถูกต้องด้วย SHA-256 Checksum และสำรองอัตโนมัติทุกครั้งที่มีการแก้ไข
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshFromDatabase()}
              className="px-3.5 py-2 rounded-xl border border-cyan-800/70 bg-[#0A1730] hover:bg-cyan-500/20 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>ตรวจสอบและซิงค์ฐานข้อมูล</span>
            </button>
          </div>

          {/* Verified File-Based DB Health Card */}
          <div className="p-4 rounded-2xl border border-cyan-800/50 bg-[#060D1A] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono tabular-nums">
            <div>
              <span className="text-[11px] text-slate-400 block font-sans">สถานะการเชื่อมต่อฐานข้อมูล</span>
              <span className="font-bold text-emerald-400 mt-0.5 block">
                {dbSyncState === 'synced' ? 'เชื่อมต่อเสถียร (File DB Synced)' : dbSyncState === 'syncing' ? 'กำลังซิงค์ข้อมูล...' : 'แคชออฟไลน์ (Offline Fallback)'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-sans">ความถูกต้องข้อมูล (SHA-256)</span>
              <span className="font-bold text-cyan-300 mt-0.5 block">
                {dbHealth?.integrityVerified ? 'Verified (ไม่ผิดเพี้ยน)' : 'ตรวจสอบพร้อมใช้'}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-sans">ไฟล์สำรองอัตโนมัติ (Snapshots)</span>
              <span className="font-bold text-white mt-0.5 block">
                {dbHealth?.backupCount ?? 1} ไฟล์ ({dbHealth?.projectCount ?? projects.length} โครงการ)
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-sans">บันทึกล่าสุดในฐานข้อมูล</span>
              <span className="font-bold text-slate-300 mt-0.5 block">
                {dbHealth?.updatedAt || '-'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl border border-cyan-950 bg-[#060D1A] space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <Download className="w-4 h-4 text-cyan-400" />
                <span>ส่งออกข้อมูลระบบ (Export JSON/CSV/DB)</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                ดาวน์โหลดข้อมูลโครงการทั้งหมด (ตัวเลขอาราบิก) หรือไฟล์ฐานข้อมูลหลักพร้อม Hash ตรวจสอบความถูกต้องจากเซิร์ฟเวอร์
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={exportServerDatabaseSnapshot}
                  className="px-3.5 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลด File DB (.JSON)</span>
                </button>
                <button
                  type="button"
                  onClick={exportDataToJSON}
                  className="px-3.5 py-2 bg-[#0C1B38] hover:bg-[#10244C] border border-cyan-800/60 text-cyan-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export โครงการ JSON</span>
                </button>
                <button
                  type="button"
                  onClick={exportDataToCSV}
                  className="px-3.5 py-2 border border-cyan-900/60 bg-[#060D1A] hover:bg-[#0A1630] text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ดาวน์โหลด CSV</span>
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-cyan-950 bg-[#060D1A] space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-200">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>คืนค่าสู่ชุดข้อมูลทางการตามเอกสาร PDF พ.ศ. 2570</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                รีเซ็ตข้อมูลทั้ง 39 โครงการ (งบประมาณ 13,129,200.00 บาท + กองทุน 61,562,250.00 บาท รวม 74,691,450.00 บาท) กลับสู่สถานะตั้งต้นปี 2570 (โดยระบบจะสำรองไฟล์ก่อนรีเซ็ตให้อัตโนมัติ)
              </p>
              <button
                type="button"
                onClick={() => setConfirmModal({ type: 'reset_all' })}
                className="px-4 py-2 bg-amber-950/40 hover:bg-amber-950/60 border border-amber-800 text-amber-300 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                ยืนยันการคืนค่าระบบ (Reset All Data)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRMATION MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#091224] border border-cyan-800/60 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  {confirmModal.type === 'delete_single_project' && 'ยืนยันการลบโครงการ'}
                  {confirmModal.type === 'delete_bulk_projects' &&
                    `ยืนยันการลบโครงการที่เลือก (${confirmModal.projectsToDelete.length} รายการ)`}
                  {confirmModal.type === 'remove_user' && 'ยืนยันการเพิกถอนสิทธิ์ผู้ใช้งาน'}
                  {confirmModal.type === 'reset_all' && 'ยืนยันการคืนค่าข้อมูลทั้งหมด'}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {confirmModal.type === 'delete_single_project' && (
                    <>
                      ต้องการลบโครงการ{' '}
                      <span className="font-mono font-bold text-cyan-300">{confirmModal.project.code}</span>{' '}
                      ({confirmModal.project.name}) ออกจากระบบใช่หรือไม่? ยอดงบประมาณและหน้า Dashboard จะปรับปรุงเป็นปัจจุบันทันที
                    </>
                  )}
                  {confirmModal.type === 'delete_bulk_projects' && (
                    <>
                      ต้องการลบโครงการทั้ง {confirmModal.projectsToDelete.length} รายการออกจากระบบใช่หรือไม่?
                      ระบบจะคำนวณงบประมาณรวมและแสดงผลบนหน้า Dashboard เป็นปัจจุบันทันที (พร้อมสำรองไฟล์อัตโนมัติก่อนลบ)
                    </>
                  )}
                  {confirmModal.type === 'remove_user' && (
                    <>ต้องการเพิกถอนสิทธิ์ผู้ปรับปรุงข้อมูลของ &ldquo;{confirmModal.userName}&rdquo; ใช่หรือไม่?</>
                  )}
                  {confirmModal.type === 'reset_all' && (
                    <>
                      ต้องการรีเซ็ตข้อมูลทั้งหมดกลับสู่ค่าเริ่มต้น 39 โครงการตามเอกสาร PDF ปี 2570 ใช่หรือไม่?
                      (ระบบจะสำรองไฟล์ฐานข้อมูลเดิมไว้ให้อัตโนมัติ)
                    </>
                  )}
                </p>

                {confirmModal.type === 'delete_bulk_projects' && (
                  <div className="mt-2 max-h-32 overflow-y-auto rounded-xl bg-[#060D1A] border border-cyan-950 p-2.5 space-y-1 text-[11px]">
                    {confirmModal.projectsToDelete.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 text-slate-300">
                        <span className="truncate">
                          <span className="font-mono text-rose-300 mr-1.5">{p.code}</span>
                          {p.name}
                        </span>
                        {p.budgetActual > 0 && (
                          <span className="font-mono text-rose-400 shrink-0">
                            ฿{p.budgetActual.toLocaleString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-cyan-950">
              <button
                type="button"
                disabled={isDeletingProjects}
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isDeletingProjects}
                onClick={() => void handleConfirmModalAction()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isDeletingProjects ? 'กำลังดำเนินการ...' : 'ยืนยันดำเนินการ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
