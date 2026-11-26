import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  TableProperties,
  History,
  Sun,
  Moon,
  Bell,
  Globe,
  Lock,
  ShieldCheck,
  UserCheck,
  Edit3,
  CalendarRange,
  SlidersHorizontal,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'dashboard' | 'timeline' | 'projects' | 'update' | 'admin';
  setCurrentTab: (tab: 'dashboard' | 'timeline' | 'projects' | 'update' | 'admin') => void;
  onOpenUserModal: () => void;
  onOpenNotifications: () => void;
  onOpenMobileTools: () => void;
  isPublicView?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenUserModal,
  onOpenNotifications,
  onOpenMobileTools,
  isPublicView = false,
}) => {
  const {
    currentUser,
    darkMode,
    setDarkMode,
    language,
    setLanguage,
    notifications,
  } = useApp();

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isAdmin = currentUser.role === 'admin' && !isPublicView;
  const isEditor = currentUser.role === 'editor';

  return (
    <header className="sticky top-0 z-40 bg-[#060D1A]/95 backdrop-blur-md border-b border-cyan-950/80 transition-colors text-slate-100 shadow-[0_4px_25px_rgba(4,9,20,0.7)]">
      <div className="w-full px-3 sm:px-6 lg:px-6">
        <div className="flex items-center justify-between gap-3 md:gap-6 h-14 md:h-16">
          {/* Zone 1: Brand title */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink min-w-0">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="text-left flex items-center gap-2.5 sm:gap-3 cursor-pointer group min-w-0"
            >
              <div className="h-9 md:h-10 px-2 md:px-2.5 py-1 rounded-xl bg-white/95 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)] group-hover:border-cyan-300 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all shrink-0">
                <img
                  src="/assets/aistudio/Asset_8_300x_0_30a573ad.png"
                  alt="สถาบันพัฒนาการตรวจเงินแผ่นดิน (SADI)"
                  className="h-6 md:h-7 w-auto object-contain select-none"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-white text-xs sm:text-sm tracking-tight whitespace-nowrap truncate max-w-[170px] sm:max-w-[260px] lg:max-w-[340px] group-hover:text-cyan-200 transition-colors">
                  รายงานความก้าวหน้าแผนพัฒนาศักยภาพบุคลากร สตง. 2570
                </span>
                <span className="text-[10px] sm:text-[11px] font-medium text-cyan-400/80 whitespace-nowrap truncate font-mono">
                  ปีงบประมาณ พ.ศ. 2570
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Nav links (tablet md..lg only — mobile uses Bottom Bar, desktop lg+ uses LeftSidebar) */}
          <nav className="hidden md:flex lg:hidden items-center gap-1">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-cyan-400" />
              <span>ภาพรวม</span>
            </button>

            <button
              onClick={() => setCurrentTab('timeline')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'timeline'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <CalendarRange className="w-4 h-4 text-cyan-400" />
              <span>ไทม์ไลน์ (Gantt)</span>
            </button>

            <button
              onClick={() => setCurrentTab('projects')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'projects'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <TableProperties className="w-4 h-4 text-cyan-400" />
              <span>ข้อมูลโครงการ</span>
            </button>

            {!isPublicView && (
              <button
                onClick={() => setCurrentTab('update')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  currentTab === 'update'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <span>ปรับปรุงข้อมูล</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setCurrentTab('admin')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  currentTab === 'admin'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <History className="w-4 h-4 text-cyan-400" />
                <span>Admin</span>
              </button>
            )}
          </nav>

          {/* Zone 3: Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile & Tablet Clear Labeled Tools Trigger (lg:hidden) */}
            <button
              type="button"
              onClick={onOpenMobileTools}
              className="flex lg:hidden items-center gap-1.5 px-3 min-h-[40px] rounded-xl border border-cyan-600/60 bg-[#0A1730] hover:bg-cyan-500/20 text-cyan-200 hover:text-white text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>เครื่องมือ</span>
            </button>

            {/* Notifications Button (Desktop & Tablet md+) */}
            <button
              onClick={onOpenNotifications}
              title="การแจ้งเตือน"
              className="hidden md:flex relative p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-[#0A1630] transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-cyan-400 text-[#060D1A] text-[9px] font-mono font-bold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Language Toggle (Desktop lg+) */}
            <button
              onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}
              title="เปลี่ยนภาษา TH/EN"
              className="p-1.5 px-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#0A1630] border border-cyan-900/60 hidden lg:flex items-center gap-1 cursor-pointer"
            >
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>{language === 'th' ? 'EN' : 'ไทย'}</span>
            </button>

            {/* Dark Mode Toggle (Desktop lg+) */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              title="สลับโหมด"
              className="p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-[#0A1630] transition-colors cursor-pointer hidden lg:block"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-300" />}
            </button>

            {/* Selected Staff Updater Indicator (Desktop md+) */}
            {isEditor && (
              <button
                onClick={() => setCurrentTab('update')}
                title="ไปยังหน้าปรับปรุงข้อมูล"
                className="hidden md:flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-cyan-800/60 bg-[#0A1730] text-cyan-200 text-xs cursor-pointer hover:border-cyan-500/60 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-medium truncate max-w-[110px]">{currentUser.name}</span>
              </button>
            )}

            {/* Discreet Admin Sign-In Button (Desktop lg+ — mobile/tablet access it clearly inside Tools sheet) */}
            {!isPublicView && (
              <button
                onClick={onOpenUserModal}
                title={isAdmin ? 'จัดการเซสชัน Admin' : 'เข้าสู่ระบบผู้ดูแลระบบ (Admin)'}
                className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                  isAdmin
                    ? 'border-cyan-500/60 bg-cyan-950/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    : 'border-cyan-900/50 bg-[#070F20] text-slate-400 hover:text-cyan-300 hover:border-cyan-700/60'
                }`}
              >
                {isAdmin ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-mono font-semibold">Admin</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span className="font-mono">Admin</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
