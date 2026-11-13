import React from 'react';
import { useApp } from '../context/AppContext';
import { Bell, CheckCircle2, AlertCircle, Info, X, Clock, ExternalLink } from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject?: (projectId: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onSelectProject,
}) => {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead, language } = useApp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-black/70 backdrop-blur-sm text-slate-100">
      <div className="bg-[#091224] border border-cyan-900/50 rounded-2xl w-full max-w-md shadow-[0_0_40px_rgba(6,182,212,0.15)] overflow-hidden mt-14 sm:mt-12 animate-in slide-in-from-top-4 duration-200">
        <div className="px-5 py-3.5 border-b border-cyan-950 flex items-center justify-between bg-[#060D1A]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-white text-sm">
              {language === 'th' ? 'การแจ้งเตือนและการรายงานผล (พ.ศ. 2570)' : 'Notifications & Alerts (FY 2570)'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllNotificationsAsRead}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline font-medium cursor-pointer"
            >
              {language === 'th' ? 'อ่านทั้งหมด' : 'Mark all read'}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3 divide-y divide-cyan-950/60 max-h-[70vh] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 font-mono">
              {language === 'th' ? 'ไม่มีการแจ้งเตือนใหม่' : 'No new notifications'}
            </div>
          ) : (
            notifications.map((notif) => {
              const getIcon = () => {
                switch (notif.type) {
                  case 'urgent':
                    return <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
                  case 'success':
                    return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
                  case 'warning':
                    return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
                  default:
                    return <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />;
                }
              };

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    markNotificationAsRead(notif.id);
                    if (notif.projectId && onSelectProject) {
                      onSelectProject(notif.projectId);
                      onClose();
                    }
                  }}
                  className={`p-3 rounded-xl transition-all cursor-pointer flex gap-3 ${
                    notif.read
                      ? 'opacity-70 hover:opacity-100 hover:bg-[#0A1630]'
                      : 'bg-[#060D1A] hover:bg-[#0A1630] border border-cyan-950'
                  }`}
                >
                  {getIcon()}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-white">
                        {notif.title}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-cyan-500/70" />
                        {notif.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {notif.message}
                    </p>
                    {notif.projectId && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300 pt-1 font-medium hover:underline">
                        ดูรายละเอียดโครงการ <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
