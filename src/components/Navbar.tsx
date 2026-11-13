import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  TableProperties,
  History,
  Sun,
  Moon,
  Bell,
  Globe,
  Menu,
  X,
  Lock,
  ShieldCheck,
  UserCheck,
  Share2,
  Edit3,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'dashboard' | 'projects' | 'update' | 'admin';
  setCurrentTab: (tab: 'dashboard' | 'projects' | 'update' | 'admin') => void;
  onOpenUserModal: () => void;
  onOpenNotifications: () => void;
  onOpenShareModal: () => void;
  isPublicView?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenUserModal,
  onOpenNotifications,
  onOpenShareModal,
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const isAdmin = currentUser.role === 'admin' && !isPublicView;
  const isEditor = currentUser.role === 'editor';

  return (
    <header className="sticky top-0 z-40 bg-[#060D1A]/95 backdrop-blur-md border-b border-cyan-950/80 transition-colors text-slate-100 shadow-[0_4px_25px_rgba(4,9,20,0.7)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 md:gap-6 h-16">
          {/* Zone 1: Brand title */}
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="text-left flex items-center gap-3 cursor-pointer group min-w-0"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center font-mono font-black text-xs text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)] group-hover:border-cyan-400 transition-colors shrink-0">
                SADI
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-white text-xs sm:text-sm tracking-tight whitespace-nowrap truncate max-w-[210px] sm:max-w-[300px] lg:max-w-[340px] group-hover:text-cyan-200 transition-colors">
                  รายงานความก้าวหน้าแผนพัฒนาศักยภาพบุคลากร สตง. 2570
                </span>
                <span className="text-[10px] sm:text-[11px] font-medium text-cyan-400/80 whitespace-nowrap truncate font-mono">
                  ตามงบประมาณรายจ่ายประจำปีงบประมาณ พ.ศ. 2570
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Nav links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`px-3 py-1.5 rounded-xl text-xs lg:text-sm font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-cyan-400" />
              <span>ภาพรวม Dashboard</span>
            </button>

            <button
              onClick={() => setCurrentTab('projects')}
              className={`px-3 py-1.5 rounded-xl text-xs lg:text-sm font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-xl text-xs lg:text-sm font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-xl text-xs lg:text-sm font-medium transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  currentTab === 'admin'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <History className="w-4 h-4 text-cyan-400" />
                <span>จัดการระบบ (Admin)</span>
              </button>
            )}
          </nav>

          {/* Zone 3: Single Public Share Link Button & Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Single Share Public Link Button */}
            <button
              onClick={onOpenShareModal}
              title="สร้างลิงก์เผยแพร่สาธารณะ"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-600/60 bg-[#0A1730] hover:bg-cyan-500/20 text-cyan-200 hover:text-white text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">สร้างลิงก์สาธารณะ</span>
            </button>

            {/* Notifications Button */}
            <button
              onClick={onOpenNotifications}
              title="การแจ้งเตือน"
              className="relative p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-[#0A1630] transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06B6D4]" />
              )}
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}
              title="เปลี่ยนภาษา TH/EN"
              className="p-1.5 px-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#0A1630] border border-cyan-900/60 hidden sm:flex items-center gap-1 cursor-pointer"
            >
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>{language === 'th' ? 'EN' : 'ไทย'}</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              title="สลับโหมด"
              className="p-2 rounded-xl text-slate-400 hover:text-cyan-300 hover:bg-[#0A1630] transition-colors cursor-pointer hidden sm:block"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-300" />}
            </button>

            {/* Selected Staff Updater Indicator */}
            {isEditor && (
              <button
                onClick={() => setCurrentTab('update')}
                title="ไปยังหน้าปรับปรุงข้อมูล"
                className="hidden sm:flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-cyan-800/60 bg-[#0A1730] text-cyan-200 text-xs cursor-pointer hover:border-cyan-500/60 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-medium truncate max-w-[120px]">{currentUser.name}</span>
              </button>
            )}

            {/* Discreet Admin Sign-In Button (hidden in strict ?view=public mode) */}
            {!isPublicView && (
              <button
                onClick={onOpenUserModal}
                title={isAdmin ? 'จัดการเซสชัน Admin' : 'เข้าสู่ระบบผู้ดูแลระบบ (Admin)'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                  isAdmin
                    ? 'border-cyan-500/60 bg-cyan-950/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                    : 'border-cyan-900/50 bg-[#070F20] text-slate-400 hover:text-cyan-300 hover:border-cyan-700/60'
                }`}
              >
                {isAdmin ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-mono font-semibold hidden sm:inline">Admin</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span className="font-mono hidden sm:inline">Admin</span>
                  </>
                )}
              </button>
            )}

            {/* Mobile hamburger menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-cyan-950 bg-[#060D1A] px-4 py-3 space-y-2">
          <button
            onClick={() => {
              setCurrentTab('dashboard');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${
              currentTab === 'dashboard'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-cyan-400" />
            <span>ภาพรวม Dashboard</span>
          </button>
          <button
            onClick={() => {
              setCurrentTab('projects');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${
              currentTab === 'projects'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                : 'text-slate-400'
            }`}
          >
            <TableProperties className="w-4 h-4 text-cyan-400" />
            <span>ข้อมูลโครงการ</span>
          </button>
          {!isPublicView && (
            <button
              onClick={() => {
                setCurrentTab('update');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${
                currentTab === 'update'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                  : 'text-slate-400'
              }`}
            >
              <Edit3 className="w-4 h-4 text-cyan-400" />
              <span>ปรับปรุงข้อมูล</span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => {
                setCurrentTab('admin');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${
                currentTab === 'admin'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                  : 'text-slate-400'
              }`}
            >
              <History className="w-4 h-4 text-cyan-400" />
              <span>จัดการระบบ (Admin)</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
};
