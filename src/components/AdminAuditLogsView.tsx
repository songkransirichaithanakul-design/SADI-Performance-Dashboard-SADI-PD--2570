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
  Filter,
  FileText,
  KeyRound,
  Sparkles,
} from 'lucide-react';

export const AdminAuditLogsView: React.FC = () => {
  const {
    auditLogs,
    authorizedUsers,
    addAuthorizedUser,
    removeAuthorizedUser,
    resetAllData,
    exportDataToJSON,
    exportDataToCSV,
    exportServerDatabaseSnapshot,
    refreshFromDatabase,
    dbHealth,
    dbSyncState,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'logs' | 'users' | 'backup'>('logs');
  const [logSearch, setLogSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'create' | 'update' | 'delete' | 'bulk_update'>('all');

  // New User Form State
  const [showAddUser, setShowAddUser] = useState(false);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('สถาบันพัฒนาการตรวจเงินแผ่นดิน (SADI)');
  const [role, setRole] = useState<'editor' | 'admin'>('editor');
  const [email, setEmail] = useState('');

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

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-slate-100">
      {/* Admin Header (Carbon Blue Style) */}
      <div className="bg-[#091224] border border-cyan-900/40 rounded-2xl p-6 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>ศูนย์บริหารจัดการระบบและบันทึกประวัติการเปลี่ยนแปลง (Admin Operations)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              หน้าสำหรับ Admin: บันทึกประวัติการเปลี่ยนแปลง & การบริหารสิทธิ์
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              ระบบบันทึก Audit Logs ทุกรายการแก้ไขปรับปรุงโครงการ พร้อมระบบจัดการรายชื่อผู้ได้รับสิทธิ์เข้าใช้งานตามเกณฑ์ที่กำหนด (ตัวเลขอาราบิกทั้งหมด)
            </p>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="inline-flex p-1 bg-[#060D1A] rounded-xl border border-cyan-950 shrink-0">
            <button
              onClick={() => setActiveSubTab('logs')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'logs'
                  ? 'bg-cyan-500/25 text-cyan-300 shadow-xs border border-cyan-700/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>ประวัติการเปลี่ยนแปลง ({auditLogs.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('users')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'users'
                  ? 'bg-cyan-500/25 text-cyan-300 shadow-xs border border-cyan-700/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>รายชื่อผู้มีสิทธิ์ ({authorizedUsers.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('backup')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'backup'
                  ? 'bg-cyan-500/25 text-cyan-300 shadow-xs border border-cyan-700/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>สำรอง & คืนค่าข้อมูล</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: AUDIT LOGS */}
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
                onChange={(e) => setActionFilter(e.target.value as any)}
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

      {/* SUB-TAB 2: AUTHORIZED USERS */}
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
                    onClick={() => {
                      if (confirm(`เพิกถอนสิทธิ์ของ "${user.name}"?`)) {
                        removeAuthorizedUser(user.id);
                      }
                    }}
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

      {/* SUB-TAB 3: BACKUP & SYSTEM RECOVERY */}
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
                {dbHealth?.backupCount ?? 1} ไฟล์ ({dbHealth?.projectCount ?? 39} โครงการ)
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
                  onClick={exportServerDatabaseSnapshot}
                  className="px-3.5 py-2 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>ดาวน์โหลด File DB (.JSON)</span>
                </button>
                <button
                  onClick={exportDataToJSON}
                  className="px-3.5 py-2 bg-[#0C1B38] hover:bg-[#10244C] border border-cyan-800/60 text-cyan-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export โครงการ JSON</span>
                </button>
                <button
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
                onClick={() => {
                  if (confirm('คุณต้องการรีเซ็ตข้อมูลทั้งหมดกลับสู่ค่าเริ่มต้นปี 2570 ใช่หรือไม่?')) {
                    resetAllData();
                  }
                }}
                className="px-4 py-2 bg-amber-950/40 hover:bg-amber-950/60 border border-amber-800 text-amber-300 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                ยืนยันการคืนค่าระบบ (Reset All Data)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
