import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  CalendarRange,
  TableProperties,
  Edit3,
  History,
  Share2,
  PlusCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export type NavTab = 'dashboard' | 'timeline' | 'projects' | 'update' | 'admin';

interface LeftSidebarProps {
  currentTab: NavTab;
  setCurrentTab: (tab: NavTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenShareModal: () => void;
  onOpenAddModal: () => void;
  isPublicView?: boolean;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  currentTab,
  setCurrentTab,
  collapsed,
  onToggleCollapse,
  onOpenShareModal,
  onOpenAddModal,
  isPublicView = false,
}) => {
  const { projects, currentUser } = useApp();

  const isAdmin = currentUser.role === 'admin' && !isPublicView;

  const stats = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter((p) => p.status === 'completed').length;
    const inProgress = projects.filter((p) => p.status === 'in_progress').length;
    const totalBudget = projects.reduce((sum, p) => sum + (p.budgetAllocated || 0), 0);
    const totalDisbursed = projects.reduce((sum, p) => sum + (p.budgetActual || 0), 0);
    const disbursePct = totalBudget > 0 ? Math.min(100, (totalDisbursed / totalBudget) * 100) : 0;
    return { total, completed, inProgress, disbursePct };
  }, [projects]);

  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    count?: number;
    visible: boolean;
  }> = [
    {
      id: 'dashboard',
      label: 'ภาพรวม',
      icon: LayoutDashboard,
      visible: true,
    },
    {
      id: 'timeline',
      label: 'ไทม์ไลน์ (Gantt)',
      icon: CalendarRange,
      visible: true,
    },
    {
      id: 'projects',
      label: 'ข้อมูลโครงการ',
      icon: TableProperties,
      count: stats.total,
      visible: true,
    },
    {
      id: 'update',
      label: 'ปรับปรุงข้อมูล',
      icon: Edit3,
      visible: !isPublicView,
    },
    {
      id: 'admin',
      label: 'จัดการระบบ (Admin)',
      icon: History,
      visible: isAdmin,
    },
  ];

  return (
    <aside
      aria-label="แถบเครื่องมือด้านซ้าย"
      className={`hidden lg:flex flex-col shrink-0 sticky top-16 h-[calc(100vh-4rem)] bg-[#060D1A] border-r border-cyan-950/80 text-slate-100 shadow-[4px_0_24px_rgba(4,9,20,0.45)] z-30 ${
        collapsed ? 'w-[74px]' : 'w-60'
      }`}
    >
      {/* Header & Collapse Toggle */}
      <div
        className={`flex items-center border-b border-cyan-950/70 px-3 py-3 ${
          collapsed ? 'justify-center' : 'justify-between'
        }`}
      >
        {!collapsed && (
          <span className="text-[11px] font-semibold tracking-wider text-cyan-400/90 pl-1 whitespace-nowrap">
            แถบเครื่องมือหลัก
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'ขยายแถบเครื่องมือ' : 'ย่อแถบเครื่องมือ'}
          aria-label={collapsed ? 'ขยายแถบเครื่องมือ' : 'ย่อแถบเครื่องมือ'}
          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-[#0A1630] border border-transparent hover:border-cyan-800/60 transition-colors cursor-pointer"
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-cyan-400" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-cyan-400" />
          )}
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        {navItems
          .filter((item) => item.visible)
          .map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                  collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2.5 gap-2.5'
                } ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold shadow-[0_0_15px_rgba(6,182,212,0.16)]'
                    : 'text-slate-300 hover:text-white hover:bg-[#0A1730] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-cyan-300' : 'text-cyan-400/90'
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!collapsed && typeof item.count === 'number' && (
                  <span
                    className={`text-[11px] font-mono tabular-nums ${
                      isActive ? 'text-cyan-200' : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

        {/* Divider */}
        <div className="my-3 border-t border-cyan-950/80" />

        {/* Quick Tools Section */}
        {!collapsed && (
          <div className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-slate-400">
            เครื่องมือด่วน
          </div>
        )}

        <button
          onClick={onOpenShareModal}
          title={collapsed ? 'สร้างลิงก์สาธารณะ' : undefined}
          className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border border-cyan-600/50 bg-[#0A1730] hover:bg-cyan-500/20 text-cyan-200 hover:text-white ${
            collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5 gap-2.5'
          }`}
        >
          <Share2 className="w-4 h-4 text-cyan-400 shrink-0" />
          {!collapsed && <span className="truncate">สร้างลิงก์สาธารณะ</span>}
        </button>

        {!isPublicView && (
          <button
            onClick={onOpenAddModal}
            title={collapsed ? 'เพิ่มโครงการใหม่' : undefined}
            className={`w-full flex items-center rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap border border-cyan-900/60 bg-[#070F20] hover:bg-[#0A1730] hover:border-cyan-600/50 text-slate-200 hover:text-cyan-200 ${
              collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5 gap-2.5'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            {!collapsed && <span className="truncate">เพิ่มโครงการใหม่</span>}
          </button>
        )}
      </nav>

      {/* Bottom Live Plan Summary */}
      {!collapsed && (
        <div className="p-3 border-t border-cyan-950/80 bg-[#070F20]/90">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span>สรุปแผน ปีงบฯ 2570</span>
            <span className="font-mono tabular-nums text-cyan-300 font-semibold">
              {stats.total} โครงการ
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
            <span>เสร็จแล้ว / กำลังทำ</span>
            <span className="font-mono tabular-nums text-slate-200">
              <span className="text-emerald-400 font-semibold">{stats.completed}</span>
              {' / '}
              <span className="text-amber-300 font-semibold">{stats.inProgress}</span>
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">เบิกจ่ายสะสม</span>
              <span className="font-mono tabular-nums text-cyan-300 font-semibold">
                {stats.disbursePct.toFixed(1)}%
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
      )}
    </aside>
  );
};
