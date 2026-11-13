import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  Shield,
  Lock,
  Mail,
  KeyRound,
  LogOut,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface UserAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    loginWithCredentials,
    logout,
    language,
  } = useApp();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAdmin = currentUser.role === 'admin';

  const handleAdminLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const result = loginWithCredentials(loginEmail, loginPassword);
    if (result.success) {
      setAuthSuccess(language === 'th' ? 'เข้าสู่ระบบผู้ดูแลระบบสำเร็จ' : 'Admin Sign-In Successful');
      setLoginEmail('');
      setLoginPassword('');
      setTimeout(() => {
        setAuthSuccess(null);
        onClose();
      }, 700);
    } else {
      setAuthError(result.message);
    }
  };

  const handleLogout = () => {
    logout();
    setLoginEmail('');
    setLoginPassword('');
    setAuthError(null);
    setAuthSuccess(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md text-slate-100">
      <div className="bg-[#0A1224] border border-cyan-900/50 rounded-2xl w-full max-w-md shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden transition-all">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-cyan-950/80 flex items-center justify-between bg-[#070D18]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">
                {language === 'th' ? 'เข้าสู่ระบบผู้ดูแลระบบ (Admin)' : 'Administrator Sign-In'}
              </h3>
              <p className="text-[11px] text-cyan-400/80 font-mono">
                SADI Management Console
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {isAdmin ? (
            <div className="space-y-4">
              <div className="bg-[#070F1E] p-4 rounded-xl border border-cyan-900/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-bold text-sm text-cyan-300">
                    AD
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-white">
                      {language === 'th' ? 'สถานะ: ผู้ดูแลระบบ (Admin)' : 'Status: Administrator'}
                    </div>
                    <p className="text-xs text-emerald-400 mt-0.5">
                      {language === 'th' ? 'เปิดใช้งานสิทธิ์การจัดการครบถ้วนแล้ว' : 'Full administrative privileges active'}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="w-full py-2.5 px-4 rounded-xl border border-rose-800/60 bg-rose-950/30 hover:bg-rose-950/50 text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{language === 'th' ? 'ออกจากระบบผู้ดูแล (Logout)' : 'Sign Out'}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{language === 'th' ? 'รหัสผู้ใช้งาน (Admin ID)' : 'Admin ID (Email)'}</span>
                </label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder={language === 'th' ? 'ระบุอีเมลผู้ดูแลระบบ' : 'Enter administrator email'}
                  className="w-full px-3 py-2.5 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white text-xs font-mono focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{language === 'th' ? 'รหัสผ่าน (Password)' : 'Password'}</span>
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder={language === 'th' ? 'ระบุรหัสผ่าน' : 'Enter password'}
                  className="w-full px-3 py-2.5 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white text-xs font-mono focus:outline-none focus:border-cyan-400 transition-colors"
                />
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{authError}</span>
                </div>
              )}

              {authSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{authSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{language === 'th' ? 'เข้าสู่ระบบ' : 'Sign In'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
