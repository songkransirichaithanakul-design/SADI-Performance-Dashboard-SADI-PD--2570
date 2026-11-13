import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Project, AuthorizedUser, AuditLog, AppNotification, FundingSource, ProjectStatus, Quarter } from '../types';
import { INITIAL_PROJECTS } from '../data/initialProjects';
import { INITIAL_AUTHORIZED_USERS, GUEST_USER } from '../data/authorizedUsers';

export interface DatabaseHealthStatus {
  healthy: boolean;
  engine: string;
  integrityVerified: boolean;
  projectCount: number;
  userCount: number;
  auditLogCount: number;
  backupCount: number;
  totalBudgetAllocated: number;
  totalBudgetActual: number;
  updatedAt: string;
}

interface AppContextType {
  projects: Project[];
  currentUser: AuthorizedUser;
  authorizedUsers: AuthorizedUser[];
  auditLogs: AuditLog[];
  notifications: AppNotification[];
  darkMode: boolean;
  language: 'th' | 'en';
  searchQuery: string;
  selectedFundingFilter: FundingSource | 'all';
  selectedQuarterFilter: Quarter | 'all';
  selectedStatusFilter: ProjectStatus | 'all';
  selectedCategoryFilter: string | 'all';
  isBulkEditMode: boolean;
  offlineStatus: boolean;
  dbSyncState: 'synced' | 'syncing' | 'cached';
  dbHealth: DatabaseHealthStatus | null;

  // Actions
  setDarkMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  setLanguage: (lang: 'th' | 'en') => void;
  setCurrentUser: (user: AuthorizedUser) => void;
  setSearchQuery: (query: string) => void;
  setSelectedFundingFilter: (filter: FundingSource | 'all') => void;
  setSelectedQuarterFilter: (filter: Quarter | 'all') => void;
  setSelectedStatusFilter: (filter: ProjectStatus | 'all') => void;
  setSelectedCategoryFilter: (filter: string | 'all') => void;
  setIsBulkEditMode: (value: boolean) => void;

  // Data mutations (synced to Atomic File-Based DB + localStorage cache)
  refreshFromDatabase: () => Promise<void>;
  updateProject: (project: Project, changeNotes?: string) => void;
  bulkUpdateProjects: (updatedProjects: Project[], auditNote?: string) => void;
  importProjectsFromFile: (importedProjects: Project[], summaryNote: string) => void;
  addProject: (newProject: Omit<Project, 'id'>) => void;
  deleteProject: (projectId: string) => void;
  resetAllData: () => void;

  // User & Audit
  loginWithCredentials: (email: string, password: string) => { success: boolean; message: string; user?: AuthorizedUser };
  selectUpdater: (user: AuthorizedUser) => void;
  clearUpdater: () => void;
  logout: () => void;
  addAuthorizedUser: (newUser: Omit<AuthorizedUser, 'id'>) => void;
  removeAuthorizedUser: (userId: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  exportDataToJSON: () => void;
  exportDataToCSV: () => void;
  exportServerDatabaseSnapshot: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PROJECTS: 'sadi_sao_projects_v4',
  USERS: 'sadi_sao_authorized_users_v4',
  AUDIT_LOGS: 'sadi_sao_audit_logs_v4',
  CURRENT_USER: 'sadi_sao_current_user_v4',
  DARK_MODE: 'sadi_sao_dark_mode_v4',
  LANGUAGE: 'sadi_sao_lang_v4',
  NOTIFICATIONS: 'sadi_sao_notifications_v4',
};

const PRIVATE_ADMIN_USER: AuthorizedUser = {
  id: 'admin-private',
  name: 'ผู้ดูแลระบบ (Admin)',
  position: 'ผู้ดูแลระบบสูงสุด (Administrator)',
  department: 'สถาบันพัฒนาการตรวจเงินแผ่นดิน (SADI)',
  role: 'admin',
  email: 'songkran.sirichaithanakul@gmail.com',
  avatarText: 'AD',
};

const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-01',
    timestamp: '2026-11-11 08:30:00',
    userName: 'ระบบกลาง (System)',
    userRole: 'admin',
    projectId: 'all',
    projectName: 'ระบบแผนพัฒนาศักยภาพบุคลากร สตง. ประจำปีงบประมาณ 2570',
    actionType: 'create',
    fieldChanged: 'นำเข้ากรอบงบประมาณตามแผนปี 2570',
    oldValue: '-',
    newValue: '39 โครงการ กรอบวงเงินรวม 74,691,450.00 บาท (ยังไม่มีการใช้จ่ายจริง)',
    notes: 'นำเข้าข้อมูลตามงบประมาณรายจ่ายประจำปี 13 โครงการ (13.13M) และเงินกองทุน 26 โครงการ (61.56M)',
  },
];

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'เริ่มต้นปีงบประมาณ 2570',
    message: 'กรอบงบประมาณรวม 39 โครงการ วงเงิน 74,691,450.00 บาท พร้อมสำหรับการติดตามผลและการปรับปรุงข้อมูล',
    timestamp: '10 นาทีที่แล้ว',
    type: 'info',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'สถานะการดำเนินงานโครงการ',
    message: 'โครงการทั้งหมดอยู่ในสถานะ "อยู่ระหว่างดำเนินการ" และ "ยังไม่ได้ดำเนินการ" และยังไม่มีการใช้จ่ายงบประมาณจริง',
    timestamp: '30 นาทีที่แล้ว',
    type: 'success',
    read: false,
  },
  {
    id: 'notif-3',
    title: 'เชื่อมโยงฐานข้อมูลและระบบไฟล์เสถียร',
    message: 'ระบบเชื่อมต่อฐานข้อมูลไฟล์เซิร์ฟเวอร์ (Atomic File DB + Auto-Backup) เพื่อป้องกันข้อมูลสูญหายหรือคลาดเคลื่อน',
    timestamp: 'เมื่อสักครู่',
    type: 'info',
    read: false,
  },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DARK_MODE);
    if (saved !== null) return saved === 'true';
    return true;
  });

  const [language, setLanguage] = useState<'th' | 'en'>(() => {
    return (localStorage.getItem(STORAGE_KEYS.LANGUAGE) as 'th' | 'en') || 'th';
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse cached projects', e);
      }
    }
    return INITIAL_PROJECTS;
  });

  const [authorizedUsers, setAuthorizedUsers] = useState<AuthorizedUser[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse cached users', e);
      }
    }
    return INITIAL_AUTHORIZED_USERS;
  });

  const [currentUser, setCurrentUser] = useState<AuthorizedUser>(() => {
    // If opened via public share link (?view=public), always view cleanly as Guest viewer without exposing Admin
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'public') {
        return GUEST_USER;
      }
    }
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse current user', e);
      }
    }
    return GUEST_USER;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse audit logs', e);
      }
    }
    return INITIAL_AUDIT_LOGS;
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse notifications', e);
      }
    }
    return INITIAL_NOTIFICATIONS;
  });

  // Filters & Search (hydrated from URL parameters if present)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFundingFilter, setSelectedFundingFilter] = useState<FundingSource | 'all'>(() => {
    if (typeof window === 'undefined') return 'all';
    const f = new URLSearchParams(window.location.search).get('funding');
    return f === 'budget_annual' || f === 'budget_fund' ? f : 'all';
  });
  const [selectedQuarterFilter, setSelectedQuarterFilter] = useState<Quarter | 'all'>(() => {
    if (typeof window === 'undefined') return 'all';
    const q = new URLSearchParams(window.location.search).get('quarter');
    return q === 'Q1' || q === 'Q2' || q === 'Q3' || q === 'Q4' ? q : 'all';
  });
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<ProjectStatus | 'all'>(() => {
    if (typeof window === 'undefined') return 'all';
    const s = new URLSearchParams(window.location.search).get('status');
    return s === 'completed' || s === 'in_progress' || s === 'not_started' ? s : 'all';
  });
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | 'all'>(() => {
    if (typeof window === 'undefined') return 'all';
    return new URLSearchParams(window.location.search).get('category') || 'all';
  });

  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [offlineStatus, setOfflineStatus] = useState(!navigator.onLine);
  const [dbSyncState, setDbSyncState] = useState<'synced' | 'syncing' | 'cached'>('syncing');
  const [dbHealth, setDbHealth] = useState<DatabaseHealthStatus | null>(null);

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: 'เมื่อสักครู่',
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev].slice(0, 50));
  }, []);

  // Load authoritative state from File-Based Database on mount
  const refreshFromDatabase = useCallback(async () => {
    setDbSyncState('syncing');
    try {
      const response = await fetch('/api/bootstrap', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (Array.isArray(payload.projects) && payload.projects.length > 0) {
        setProjects(payload.projects);
      }
      if (Array.isArray(payload.authorizedUsers) && payload.authorizedUsers.length > 0) {
        setAuthorizedUsers(payload.authorizedUsers);
      }
      if (Array.isArray(payload.auditLogs)) {
        setAuditLogs(payload.auditLogs);
      }
      if (payload.health) {
        setDbHealth(payload.health);
      }
      setDbSyncState('synced');
    } catch {
      setDbSyncState('cached');
    }
  }, []);

  useEffect(() => {
    void refreshFromDatabase();
  }, [refreshFromDatabase]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setOfflineStatus(false);
      void refreshFromDatabase();
    };
    const handleOffline = () => {
      setOfflineStatus(true);
      setDbSyncState('cached');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshFromDatabase]);

  // Sync darkMode with <html> class
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, String(darkMode));
  }, [darkMode]);

  // Sync localStorage offline backup cache
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(authorizedUsers));
  }, [authorizedUsers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
  }, [language]);

  const getFormattedNow = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  };

  // Update a single project + persist atomically to File-Based DB
  const updateProject = (updatedProject: Project, changeNotes?: string) => {
    const oldProject = projects.find((p) => p.id === updatedProject.id);
    if (!oldProject) return;

    const changedFields: string[] = [];
    if (oldProject.status !== updatedProject.status) {
      changedFields.push(`สถานะ: ${oldProject.status} -> ${updatedProject.status}`);
    }
    if (oldProject.budgetActual !== updatedProject.budgetActual) {
      changedFields.push(`งบใช้จริง: ฿${oldProject.budgetActual.toLocaleString()} -> ฿${updatedProject.budgetActual.toLocaleString()}`);
    }
    if (oldProject.batchesActual !== updatedProject.batchesActual) {
      changedFields.push(`จำนวนรุ่นจริง: ${oldProject.batchesActual} -> ${updatedProject.batchesActual}`);
    }
    if (oldProject.participantsActual !== updatedProject.participantsActual) {
      changedFields.push(`ผู้เข้าอบรมจริง: ${oldProject.participantsActual} -> ${updatedProject.participantsActual}`);
    }
    if (oldProject.actualDateOrQuarter !== updatedProject.actualDateOrQuarter) {
      changedFields.push(`กำหนดการจัดจริง: ${oldProject.actualDateOrQuarter || '-'} -> ${updatedProject.actualDateOrQuarter || '-'}`);
    }

    const modifiedProject: Project = {
      ...updatedProject,
      lastModifiedBy: currentUser.name,
      lastModifiedAt: getFormattedNow(),
    };

    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? modifiedProject : p)));

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: getFormattedNow(),
      userName: currentUser.name,
      userRole: currentUser.role,
      projectId: updatedProject.id,
      projectName: updatedProject.name,
      actionType: 'update',
      fieldChanged: changedFields.length > 0 ? changedFields.join(' | ') : 'ปรับปรุงข้อมูลทั่วไป',
      oldValue: `สถานะ: ${oldProject.status}, เบิกจ่าย: ฿${oldProject.budgetActual.toLocaleString()}`,
      newValue: `สถานะ: ${updatedProject.status}, เบิกจ่าย: ฿${updatedProject.budgetActual.toLocaleString()}`,
      notes: changeNotes || 'แก้ไขโดยผู้มีสิทธิ์ในระบบ',
    };

    setAuditLogs((prev) => [newLog, ...prev]);
    setDbSyncState('syncing');

    fetch(`/api/projects/${encodeURIComponent(updatedProject.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: modifiedProject,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        changeNotes,
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Sync failed'))))
      .then((data) => {
        if (Array.isArray(data.projects)) setProjects(data.projects);
        if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
        if (data.health) setDbHealth(data.health);
        setDbSyncState('synced');
      })
      .catch(() => {
        setDbSyncState('cached');
      });

    addNotification({
      title: 'ปรับปรุงข้อมูลสำเร็จ',
      message: `${currentUser.name} ได้บันทึก "${updatedProject.name.slice(0, 40)}..." ลงฐานข้อมูลแล้ว`,
      type: 'info',
      projectId: updatedProject.id,
    });
  };

  // Bulk update projects + persist atomically to File-Based DB
  const bulkUpdateProjects = (updatedProjects: Project[], auditNote?: string) => {
    const stamped = updatedProjects.map((p) => ({
      ...p,
      lastModifiedBy: p.lastModifiedBy || currentUser.name,
      lastModifiedAt: p.lastModifiedAt || getFormattedNow(),
    }));
    setProjects(stamped);
    setIsBulkEditMode(false);

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: getFormattedNow(),
      userName: currentUser.name,
      userRole: currentUser.role,
      projectId: 'bulk',
      projectName: auditNote ? 'นำเข้าข้อมูลโครงการจากไฟล์ (Excel / CSV)' : 'บันทึกแก้ไขรายการแบบกลุ่ม (Bulk Edit)',
      actionType: 'bulk_update',
      fieldChanged: auditNote || 'แก้ไขรายการหลายรายการพร้อมกัน',
      oldValue: '-',
      newValue: `ปรับปรุงข้อมูล ${stamped.length} โครงการ`,
      notes: auditNote || 'บันทึกการแก้ไขปรับปรุงรายการทั้งหมด',
    };

    setAuditLogs((prev) => [newLog, ...prev]);
    setDbSyncState('syncing');

    fetch('/api/projects/bulk', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projects: stamped,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        auditNote,
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Sync failed'))))
      .then((data) => {
        if (Array.isArray(data.projects)) setProjects(data.projects);
        if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
        if (data.health) setDbHealth(data.health);
        setDbSyncState('synced');
      })
      .catch(() => {
        setDbSyncState('cached');
      });

    addNotification({
      title: auditNote ? 'นำเข้าไฟล์ข้อมูลสำเร็จ' : 'บันทึกข้อมูลแบบกลุ่มสำเร็จ',
      message: auditNote || 'บันทึกการแก้ไขรายการทั้งหมดลงฐานข้อมูลไฟล์เรียบร้อยแล้ว',
      type: 'success',
    });
  };

  // Dedicated import helper wrapping bulkUpdateProjects with clear import audit trail
  const importProjectsFromFile = (importedProjects: Project[], summaryNote: string) => {
    const stamped = importedProjects.map((p) => ({
      ...p,
      lastModifiedBy: currentUser.name,
      lastModifiedAt: getFormattedNow(),
    }));
    bulkUpdateProjects(stamped, summaryNote);
  };

  // Add new project
  const addProject = (newProjectData: Omit<Project, 'id'>) => {
    const newId = `custom-${Date.now()}`;
    const newProj: Project = {
      ...newProjectData,
      id: newId,
      lastModifiedBy: currentUser.name,
      lastModifiedAt: getFormattedNow(),
    };

    setProjects((prev) => [newProj, ...prev]);
    setDbSyncState('syncing');

    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: newProjectData,
        actorName: currentUser.name,
        actorRole: currentUser.role,
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Sync failed'))))
      .then((data) => {
        if (Array.isArray(data.projects)) setProjects(data.projects);
        if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
        if (data.health) setDbHealth(data.health);
        setDbSyncState('synced');
      })
      .catch(() => {
        setDbSyncState('cached');
      });

    addNotification({
      title: 'เพิ่มโครงการใหม่สำเร็จ',
      message: `โครงการ "${newProj.name.slice(0, 40)}..." ถูกบันทึกเรียบร้อย`,
      type: 'success',
      projectId: newId,
    });
  };

  // Delete project
  const deleteProject = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;

    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setDbSyncState('syncing');

    fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorName: currentUser.name,
        actorRole: currentUser.role,
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Sync failed'))))
      .then((data) => {
        if (Array.isArray(data.projects)) setProjects(data.projects);
        if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
        if (data.health) setDbHealth(data.health);
        setDbSyncState('synced');
      })
      .catch(() => {
        setDbSyncState('cached');
      });

    addNotification({
      title: 'ลบโครงการสำเร็จ',
      message: `ลบโครงการ "${proj.name.slice(0, 35)}..." แล้ว`,
      type: 'warning',
    });
  };

  // Reset all data to PDF initial state
  const resetAllData = () => {
    setProjects(INITIAL_PROJECTS);
    setAuthorizedUsers(INITIAL_AUTHORIZED_USERS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setNotifications(INITIAL_NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.PROJECTS);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    setDbSyncState('syncing');

    fetch('/api/reset', { method: 'POST' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Reset sync failed'))))
      .then((data) => {
        if (Array.isArray(data.projects)) setProjects(data.projects);
        if (Array.isArray(data.authorizedUsers)) setAuthorizedUsers(data.authorizedUsers);
        if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
        if (data.health) setDbHealth(data.health);
        setDbSyncState('synced');
      })
      .catch(() => {
        setDbSyncState('cached');
      });

    addNotification({
      title: 'รีเซ็ตข้อมูลสู่ค่าเริ่มต้นสำเร็จ',
      message: 'ข้อมูลทั้งหมดถูกคืนค่ากลับเป็นชุดข้อมูลทางการตามเอกสาร PDF พ.ศ. 2570',
      type: 'info',
    });
  };

  // Select staff updater from the 39 SADI staff list
  const selectUpdater = (user: AuthorizedUser) => {
    setCurrentUser({ ...user, role: 'editor' });
    addNotification({
      title: 'เลือกผู้ปรับปรุงข้อมูลสำเร็จ',
      message: `ผู้ปรับปรุงข้อมูลปัจจุบัน: ${user.name}`,
      type: 'info',
    });
  };

  // Clear selected updater (return to selector box or viewer mode)
  const clearUpdater = () => {
    setIsBulkEditMode(false);
    setCurrentUser(GUEST_USER);
  };

  // Private Admin Login verification
  const loginWithCredentials = (email: string, pass: string): { success: boolean; message: string; user?: AuthorizedUser } => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (cleanEmail === 'songkran.sirichaithanakul@gmail.com' && cleanPass === 'songkran8192') {
      setCurrentUser(PRIVATE_ADMIN_USER);

      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        timestamp: getFormattedNow(),
        userName: PRIVATE_ADMIN_USER.name,
        userRole: 'admin',
        projectId: 'auth',
        projectName: 'การเข้าสู่ระบบผู้ดูแลระบบ',
        actionType: 'update',
        fieldChanged: 'Admin Sign-In',
        oldValue: '-',
        newValue: 'เข้าสู่ระบบสิทธิ Admin สำเร็จ',
        notes: 'ยืนยันตัวตนผู้ดูแลระบบสำเร็จ',
      };
      setAuditLogs((prev) => [newLog, ...prev]);

      fetch('/api/audit/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: PRIVATE_ADMIN_USER.name,
          userRole: 'admin',
        }),
      }).catch(() => undefined);

      addNotification({
        title: 'เข้าสู่ระบบสิทธิ Admin สำเร็จ',
        message: 'เปิดใช้งานสิทธิ์การจัดการระดับผู้ดูแลระบบเรียบร้อยแล้ว',
        type: 'success',
      });

      return {
        success: true,
        message: 'เข้าสู่ระบบผู้ดูแลระบบสำเร็จ',
        user: PRIVATE_ADMIN_USER,
      };
    }

    return {
      success: false,
      message: 'รหัสผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
    };
  };

  const logout = () => {
    setIsBulkEditMode(false);
    setCurrentUser(GUEST_USER);
    addNotification({
      title: 'ออกจากระบบแล้ว',
      message: 'ออกจากสถานะผู้ใช้งานเรียบร้อยแล้ว',
      type: 'info',
    });
  };

  const addAuthorizedUser = (userData: Omit<AuthorizedUser, 'id'>) => {
    const newId = `user-${Date.now()}`;
    const initials = userData.name.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'จน';
    const newUser: AuthorizedUser = {
      ...userData,
      id: newId,
      avatarText: initials,
    };
    setAuthorizedUsers((prev) => [...prev, newUser]);
    setDbSyncState('syncing');

    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: userData,
        actorName: currentUser.name,
        actorRole: currentUser.role,
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Sync failed'))))
      .then((data) => {
        if (Array.isArray(data.authorizedUsers)) setAuthorizedUsers(data.authorizedUsers);
        if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
        if (data.health) setDbHealth(data.health);
        setDbSyncState('synced');
      })
      .catch(() => {
        setDbSyncState('cached');
      });
  };

  const removeAuthorizedUser = (userId: string) => {
    const userToRemove = authorizedUsers.find((u) => u.id === userId);
    if (!userToRemove) return;
    setAuthorizedUsers((prev) => prev.filter((u) => u.id !== userId));
    setDbSyncState('syncing');

    fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorName: currentUser.name,
        actorRole: currentUser.role,
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Sync failed'))))
      .then((data) => {
        if (Array.isArray(data.authorizedUsers)) setAuthorizedUsers(data.authorizedUsers);
        if (Array.isArray(data.auditLogs)) setAuditLogs(data.auditLogs);
        if (data.health) setDbHealth(data.health);
        setDbSyncState('synced');
      })
      .catch(() => {
        setDbSyncState('cached');
      });
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const exportDataToJSON = () => {
    const exportPayload = {
      exportDate: getFormattedNow(),
      fiscalYear: '2570',
      totalProjects: projects.length,
      data: projects,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SADI_Personnel_Development_Plan_2570_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportServerDatabaseSnapshot = () => {
    const link = document.createElement('a');
    link.href = '/api/backup/export';
    link.download = `SADI_FileDB_Snapshot_2570_${Date.now()}.json`;
    link.click();
  };

  const exportDataToCSV = () => {
    const headers = [
      'ลำดับ',
      'รหัสโครงการ',
      'ชื่อโครงการ/หลักสูตร',
      'หมวดหมู่',
      'กลุ่มเป้าหมาย',
      'แหล่งงบประมาณ',
      'สถานะ',
      'ไตรมาส',
      'จำนวนรุ่นตามแผน',
      'จำนวนรุ่นจริง',
      'ผู้เข้าอบรมตามแผน (คน)',
      'ผู้เข้าอบรมจริง (คน)',
      'งบประมาณจัดสรร (บาท)',
      'งบประมาณใช้จริง (บาท)',
      'งบประมาณคงเหลือ (บาท)',
      'ร้อยละการเบิกจ่าย (%)',
      'กำหนดการดำเนินการ',
    ];

    const rows = projects.map((p, idx) => {
      const remaining = p.budgetAllocated - p.budgetActual;
      const rate = p.budgetAllocated > 0 ? ((p.budgetActual / p.budgetAllocated) * 100).toFixed(2) : '0.00';
      const statusTh = p.status === 'completed' ? 'ดำเนินการเสร็จแล้ว' : p.status === 'in_progress' ? 'อยู่ระหว่างดำเนินการ' : 'ยังไม่ได้ดำเนินการ';
      return [
        idx + 1,
        `"${p.code}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category}"`,
        `"${p.targetGroup}"`,
        `"${p.fundingSourceNameTh}"`,
        `"${statusTh}"`,
        `"${p.quarters.join(', ')}"`,
        p.batchesPlanned,
        p.batchesActual,
        p.participantsPlanned,
        p.participantsActual,
        p.budgetAllocated,
        p.budgetActual,
        remaining,
        rate,
        `"${p.actualDateOrQuarter || p.executionDateSchedule}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SADI_Project_Progress_Report_2570_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppContext.Provider
      value={{
        projects,
        currentUser,
        authorizedUsers,
        auditLogs,
        notifications,
        darkMode,
        language,
        searchQuery,
        selectedFundingFilter,
        selectedQuarterFilter,
        selectedStatusFilter,
        selectedCategoryFilter,
        isBulkEditMode,
        offlineStatus,
        dbSyncState,
        dbHealth,

        setDarkMode,
        setLanguage,
        setCurrentUser,
        setSearchQuery,
        setSelectedFundingFilter,
        setSelectedQuarterFilter,
        setSelectedStatusFilter,
        setSelectedCategoryFilter,
        setIsBulkEditMode,

        refreshFromDatabase,
        updateProject,
        bulkUpdateProjects,
        importProjectsFromFile,
        addProject,
        deleteProject,
        resetAllData,

        loginWithCredentials,
        selectUpdater,
        clearUpdater,
        logout,
        addAuthorizedUser,
        removeAuthorizedUser,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        addNotification,
        exportDataToJSON,
        exportDataToCSV,
        exportServerDatabaseSnapshot,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
