import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { NavTab } from './LeftSidebar';
import {
  LayoutDashboard,
  CalendarRange,
  TableProperties,
  Edit3,
  LayoutGrid,
  X,
  Share2,
  PlusCircle,
  FileSpreadsheet,
  Bell,
  Globe,
  Sun,
  Moon,
  ShieldCheck,
  Lock,
  History,
  UserCheck,
  ChevronRight,
} from 'lucide-react';

interface MobileBottomNavProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  isToolsOpen: boolean;
  onOpenTools: () => void;
  onCloseTools: () => void;
  onOpenShareModal: () => void;
  onOpenAddModal: () => void;
  onOpenNotifications: () => void;
  onOpenUserModal: () => void;
  isPublicView?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  setCurrentTab,
  isToolsOpen,
  onOpenTools,
  onCloseTools,
  onOpenShareModal,
  onOpenAddModal,
  onOpenNotifications,
  onOpenUserModal,
  isPublicView = false,
}) => {
  const {
    projects,
    currentUser,
    authorizedUsers,
    selectUpdater,
    darkMode,
    setDarkMode,
    language,
    setLanguage,
    notifications,
    exportDataToCSV,
  } = useApp();

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isAdmin = currentUser.role === 'admin' && !isPublicView;
  const isEditor = currentUser.role === 'editor';

  const stats = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter((p) => p.status === 'completed').length;
    const totalBudget = projects.reduce((sum, p) => sum + (p.budgetAllocated || 0), 0);
    const totalDisbursed = projects.reduce((sum, p) => sum + (p.budgetActual || 0), 0);
    const disbursePct = totalBudget > 0 ? Math.min(100, (totalDisbursed / totalBudget) * 100) : 0;
    return { total, completed, disbursePct };
  }, [projects]);

  const tabs: Array<{
    id: NavTab | 'tools';
    label: string;
    icon: React.FC<{ className?: string }>;
    visible: boolean;
  }> = [
    { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard, visible: true },
    { id: 'timeline', label: 'ไทม์ไลน์', icon: CalendarRange, visible: true },
    { id: 'projects', label: 'โครงการ', icon: TableProperties, visible: true },
    { id: 'update', label: 'ปรับปรุง', icon: Edit3, visible: !isPublicView },
    { id: 'tools', label: 'เครื่องมือ', icon: LayoutGrid, visible: true },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <>
      {/* Fixed Thumb-Zone Bottom Tab Bar (Mobile < md only) */}
      <nav
        aria-label="เมนูนำทางมือถือ"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#060D1A]/95 backdrop-blur-md border-t border-cyan-900/70 shadow-[0_-8px_24px_rgba(4,9,20,0.7)]"
      >
        <div
          className={`grid h-16 items-center px-1 ${
            visibleTabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4'
          }`}
        >
          {visibleTabs.map((item) => {
            const Icon = item.icon;
            const isTools = item.id === 'tools';
            const isActive = isTools ? isToolsOpen : currentTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (isTools) {
                    if (isToolsOpen) {
                      onCloseTools();
                    } else {
                      onOpenTools();
                    }
                  } else {
                    onCloseTools();
                    setCurrentTab(item.id as NavTab);
                  }
                }}
                className={`relative flex flex-col items-center justify-center min-h-[48px] rounded-xl mx-0.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-cyan-300 bg-cyan-500/15'
                    : 'text-slate-400 active:bg-slate-800/60'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`}
                />
                <span
                  className={`text-[10px] mt-1 leading-none whitespace-nowrap ${
                    isActive ? 'font-bold text-cyan-200' : 'font-medium text-slate-400'
                  }`}
                >
                  {item.label}
                </span>
                {isTools && unreadCount > 0 && (
                  <span className="absolute top-1.5 right-3 min-w-[16px] h-4 px-1 rounded-full bg-cyan-400 text-[#060D1A] text-[9px] font-mono font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile & Tablet Tools Bottom Sheet Drawer (lg:hidden) */}
      {isToolsOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/65 backdrop-blur-xs"
          onClick={onCloseTools}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="เครื่องมือและเมนูทั้งหมด"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl mx-auto bg-[#091224] border-t border-x border-cyan-800/60 rounded-t-3xl text-slate-100 shadow-[0_-16px_45px_rgba(4,9,20,0.85)] max-h-[85vh] flex flex-col"
          >
            {/* Drag Handle & Header */}
            <div className="pt-3 pb-3 px-5 border-b border-cyan-950/80 shrink-0">
              <div className="w-10 h-1.5 bg-cyan-900/90 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">เครื่องมือและเมนูทั้งหมด</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    เข้าถึงฟังก์ชันจัดการข้อมูล รายงาน และการตั้งค่าทั้งหมดได้จากที่นี่
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCloseTools}
                  aria-label="ปิดหน้าต่างเครื่องมือ"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-[#0A1730] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Tools Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Section 1: Quick Staff Selector (1-39) */}
              {!isPublicView && (
                <div className="p-3.5 rounded-2xl bg-[#060D1A] border border-cyan-900/60 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                      <UserCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>ผู้ปรับปรุงข้อมูล (1–{authorizedUsers.length} รายชื่อ)</span>
                    </div>
                    {isEditor && (
                      <span className="text-[11px] text-emerald-400 font-semibold">พร้อมแก้ไข</span>
                    )}
                  </div>
                  <select
                    aria-label="เลือกชื่อผู้ปรับปรุงข้อมูล"
                    value={isEditor ? currentUser.id : ''}
                    onChange={(e) => {
                      const found = authorizedUsers.find((u) => u.id === e.target.value);
                      if (found) {
                        selectUpdater(found);
                        onCloseTools();
                        setCurrentTab('update');
                      }
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-cyan-800/70 bg-[#0A1730] text-white text-xs font-medium focus:outline-hidden focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="">
                      {isAdmin
                        ? `ผู้ดูแลระบบ: ${currentUser.name}`
                        : '-- เลือกชื่อของท่านเพื่อเริ่มปรับปรุงข้อมูลทันที --'}
                    </option>
                    {authorizedUsers.map((u, idx) => (
                      <option key={u.id} value={u.id}>
                        {idx + 1}. {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Section 2: Primary Action Tools Grid (Large Touch Targets) */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 px-1">
                  เครื่องมือจัดการข้อมูลและรายงาน
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {!isPublicView && (
                    <button
                      type="button"
                      onClick={() => {
                        onCloseTools();
                        onOpenAddModal();
                      }}
                      className="min-h-[68px] p-3.5 rounded-2xl bg-[#060D1A] border border-emerald-700/50 active:bg-emerald-950/40 text-left flex flex-col justify-between gap-2 cursor-pointer"
                    >
                      <PlusCircle className="w-5 h-5 text-emerald-400" />
                      <span className="text-xs font-semibold text-white">เพิ่มโครงการใหม่</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onCloseTools();
                      onOpenShareModal();
                    }}
                    className="min-h-[68px] p-3.5 rounded-2xl bg-[#060D1A] border border-cyan-700/60 active:bg-cyan-950/40 text-left flex flex-col justify-between gap-2 cursor-pointer"
                  >
                    <Share2 className="w-5 h-5 text-cyan-400" />
                    <span className="text-xs font-semibold text-white">สร้างลิงก์สาธารณะ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onCloseTools();
                      exportDataToCSV();
                    }}
                    className="min-h-[68px] p-3.5 rounded-2xl bg-[#060D1A] border border-cyan-900/60 active:bg-[#0A1730] text-left flex flex-col justify-between gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                    <span className="text-xs font-semibold text-white">ส่งออกไฟล์ CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onCloseTools();
                      onOpenNotifications();
                    }}
                    className="min-h-[68px] p-3.5 rounded-2xl bg-[#060D1A] border border-cyan-900/60 active:bg-[#0A1730] text-left flex flex-col justify-between gap-2 cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <Bell className="w-5 h-5 text-cyan-400" />
                      {unreadCount > 0 && (
                        <span className="font-mono tabular-nums text-xs font-bold text-cyan-300">
                          {unreadCount} ใหม่
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white">การแจ้งเตือน</span>
                  </button>
                </div>
              </div>

              {/* Section 3: Settings & Admin Rows */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-slate-400 px-1">
                  การตั้งค่าและผู้ดูแลระบบ
                </div>
                <div className="rounded-2xl bg-[#060D1A] border border-cyan-950 divide-y divide-cyan-950/80 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}
                    className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between text-left active:bg-[#0A1730] cursor-pointer"
                  >
                    <span className="flex items-center gap-3 text-xs font-medium text-slate-200">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <span>ภาษาแสดงผล</span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-cyan-300">
                      {language === 'th' ? 'ภาษาไทย → EN' : 'English → ไทย'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDarkMode(!darkMode)}
                    className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between text-left active:bg-[#0A1730] cursor-pointer"
                  >
                    <span className="flex items-center gap-3 text-xs font-medium text-slate-200">
                      {darkMode ? (
                        <Sun className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Moon className="w-4 h-4 text-cyan-300" />
                      )}
                      <span>โหมดหน้าจอ</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-300">
                      {darkMode ? 'โหมดมืด' : 'โหมดมาตรฐาน'}
                    </span>
                  </button>

                  {!isPublicView && (
                    <button
                      type="button"
                      onClick={() => {
                        onCloseTools();
                        onOpenUserModal();
                      }}
                      className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between text-left active:bg-[#0A1730] cursor-pointer"
                    >
                      <span className="flex items-center gap-3 text-xs font-medium text-slate-200">
                        {isAdmin ? (
                          <ShieldCheck className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Lock className="w-4 h-4 text-slate-400" />
                        )}
                        <span>{isAdmin ? 'จัดการเซสชันผู้ดูแลระบบ (Admin)' : 'เข้าสู่ระบบผู้ดูแลระบบ (Admin)'}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        onCloseTools();
                        setCurrentTab('admin');
                      }}
                      className="w-full min-h-[52px] px-4 py-3 flex items-center justify-between text-left active:bg-[#0A1730] cursor-pointer"
                    >
                      <span className="flex items-center gap-3 text-xs font-medium text-cyan-300">
                        <History className="w-4 h-4 text-cyan-400" />
                        <span>ประวัติการแก้ไขและจัดการระบบ (Audit Logs)</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-cyan-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Section 4: Compact Plan Summary */}
              <div className="p-3.5 rounded-2xl bg-[#060D1A] border border-cyan-950/90 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">สรุปแผน ปีงบฯ 2570</span>
                  <span className="font-mono tabular-nums text-cyan-300 font-semibold">
                    {stats.completed}/{stats.total} โครงการเสร็จแล้ว · เบิกจ่าย {stats.disbursePct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-400"
                    style={{ width: `${stats.disbursePct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
