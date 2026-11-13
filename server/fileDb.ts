import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Project, AuthorizedUser, AuditLog, ProjectStatus, FundingSource, Quarter } from '../src/types/index.ts';
import { INITIAL_PROJECTS } from '../src/data/initialProjects.ts';
import { INITIAL_AUTHORIZED_USERS } from '../src/data/authorizedUsers.ts';

export interface DatabasePayload {
  schemaVersion: number;
  fiscalYear: string;
  projects: Project[];
  authorizedUsers: AuthorizedUser[];
  auditLogs: AuditLog[];
  updatedAt: string;
}

export interface StoredDatabase extends DatabasePayload {
  integrityHash: string;
}

export interface DatabaseHealth {
  healthy: boolean;
  engine: string;
  dataDir: string;
  dbFilePath: string;
  integrityVerified: boolean;
  schemaVersion: number;
  fiscalYear: string;
  projectCount: number;
  userCount: number;
  auditLogCount: number;
  backupCount: number;
  totalBudgetAllocated: number;
  totalBudgetActual: number;
  updatedAt: string;
}

const VALID_STATUSES = new Set<ProjectStatus>(['completed', 'in_progress', 'not_started']);
const VALID_FUNDING = new Set<FundingSource>(['budget_annual', 'budget_fund']);
const VALID_QUARTERS = new Set<Quarter>(['Q1', 'Q2', 'Q3', 'Q4']);

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

function computeHash(payload: DatabasePayload): string {
  const canonical = JSON.stringify({
    schemaVersion: payload.schemaVersion,
    fiscalYear: payload.fiscalYear,
    projects: payload.projects,
    authorizedUsers: payload.authorizedUsers,
    auditLogs: payload.auditLogs,
    updatedAt: payload.updatedAt,
  });
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function toSafeNonNegNumber(val: unknown, fallback = 0): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.round(num * 100) / 100;
}

function sanitizeProject(input: Partial<Project>, fallback?: Project): Project {
  const base = fallback || ({} as Project);
  const status: ProjectStatus = VALID_STATUSES.has(input.status as ProjectStatus)
    ? (input.status as ProjectStatus)
    : VALID_STATUSES.has(base.status)
      ? base.status
      : 'not_started';

  const fundingSource: FundingSource = VALID_FUNDING.has(input.fundingSource as FundingSource)
    ? (input.fundingSource as FundingSource)
    : VALID_FUNDING.has(base.fundingSource)
      ? base.fundingSource
      : 'budget_annual';

  const rawQuarters = Array.isArray(input.quarters) ? input.quarters : base.quarters || ['Q1'];
  const quarters = rawQuarters.filter((q): q is Quarter => VALID_QUARTERS.has(q as Quarter));

  return {
    id: String(input.id || base.id || `proj-${Date.now()}`).trim(),
    code: String(input.code ?? base.code ?? 'NEW-70').trim(),
    name: String(input.name ?? base.name ?? 'โครงการใหม่').trim(),
    category: String(input.category ?? base.category ?? '1. การพัฒนาสายวิชาชีพ (Professional Development)').trim(),
    subCategory: input.subCategory !== undefined ? String(input.subCategory) : base.subCategory,
    targetGroup: String(input.targetGroup ?? base.targetGroup ?? '-').trim(),
    batchesPlanned: Math.max(0, Math.round(toSafeNonNegNumber(input.batchesPlanned ?? base.batchesPlanned, 1))),
    batchesActual: Math.max(0, Math.round(toSafeNonNegNumber(input.batchesActual ?? base.batchesActual, 0))),
    participantsPerBatch: Math.max(0, Math.round(toSafeNonNegNumber(input.participantsPerBatch ?? base.participantsPerBatch, 0))),
    participantsPlanned: Math.max(0, Math.round(toSafeNonNegNumber(input.participantsPlanned ?? base.participantsPlanned, 0))),
    participantsActual: Math.max(0, Math.round(toSafeNonNegNumber(input.participantsActual ?? base.participantsActual, 0))),
    budgetAllocated: toSafeNonNegNumber(input.budgetAllocated ?? base.budgetAllocated, 0),
    budgetActual: toSafeNonNegNumber(input.budgetActual ?? base.budgetActual, 0),
    fundingSource,
    fundingSourceNameTh:
      input.fundingSourceNameTh ||
      base.fundingSourceNameTh ||
      (fundingSource === 'budget_annual' ? 'งบประมาณรายจ่ายประจำปี' : 'เงินกองทุนเพื่อการพัฒนาการตรวจเงินแผ่นดิน'),
    status,
    quarters: quarters.length > 0 ? quarters : ['Q1'],
    actualDateOrQuarter: input.actualDateOrQuarter !== undefined ? String(input.actualDateOrQuarter) : base.actualDateOrQuarter,
    executionDateSchedule: String(input.executionDateSchedule ?? base.executionDateSchedule ?? '-'),
    objectives: input.objectives !== undefined ? String(input.objectives) : base.objectives,
    targetAudienceNote: input.targetAudienceNote !== undefined ? String(input.targetAudienceNote) : base.targetAudienceNote,
    expectedBenefits: input.expectedBenefits !== undefined ? String(input.expectedBenefits) : base.expectedBenefits,
    evaluationMethod: input.evaluationMethod !== undefined ? String(input.evaluationMethod) : base.evaluationMethod,
    expenseItems: Array.isArray(input.expenseItems) ? input.expenseItems : base.expenseItems,
    lastModifiedBy: input.lastModifiedBy !== undefined ? String(input.lastModifiedBy) : base.lastModifiedBy,
    lastModifiedAt: input.lastModifiedAt !== undefined ? String(input.lastModifiedAt) : base.lastModifiedAt,
  };
}

export function getFormattedNow(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

class FileDatabaseManager {
  private dataDir: string;
  private backupsDir: string;
  private dbFilePath: string;
  private writeQueue: Promise<void> = Promise.resolve();
  private initialized = false;
  private integrityVerified = true;

  constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.backupsDir = path.join(this.dataDir, 'backups');
    this.dbFilePath = path.join(this.dataDir, 'sadi_database.json');
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.backupsDir, { recursive: true });
      await fs.access(this.dataDir, fs.constants.W_OK);
    } catch {
      this.dataDir = '/tmp/sadi-data';
      this.backupsDir = path.join(this.dataDir, 'backups');
      this.dbFilePath = path.join(this.dataDir, 'sadi_database.json');
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.backupsDir, { recursive: true });
    }
  }

  private createSeedPayload(): DatabasePayload {
    return {
      schemaVersion: 4,
      fiscalYear: '2570',
      projects: INITIAL_PROJECTS.map((p) => sanitizeProject(p)),
      authorizedUsers: INITIAL_AUTHORIZED_USERS.map((u) => ({ ...u })),
      auditLogs: INITIAL_AUDIT_LOGS.map((l) => ({ ...l })),
      updatedAt: getFormattedNow(),
    };
  }

  private isValidStoredDb(raw: unknown): raw is StoredDatabase {
    if (!raw || typeof raw !== 'object') return false;
    const obj = raw as Partial<StoredDatabase>;
    if (!Array.isArray(obj.projects) || !Array.isArray(obj.authorizedUsers) || !Array.isArray(obj.auditLogs)) {
      return false;
    }
    if (obj.projects.length === 0) return false;
    if (typeof obj.integrityHash !== 'string') return false;
    const expected = computeHash({
      schemaVersion: obj.schemaVersion || 4,
      fiscalYear: obj.fiscalYear || '2570',
      projects: obj.projects,
      authorizedUsers: obj.authorizedUsers,
      auditLogs: obj.auditLogs,
      updatedAt: obj.updatedAt || '',
    });
    return expected === obj.integrityHash;
  }

  private async writeAtomic(payload: DatabasePayload, createBackupSnapshot = true): Promise<StoredDatabase> {
    await this.ensureDirectories();
    const stamped: DatabasePayload = {
      ...payload,
      schemaVersion: 4,
      fiscalYear: '2570',
      updatedAt: getFormattedNow(),
    };
    const stored: StoredDatabase = {
      ...stamped,
      integrityHash: computeHash(stamped),
    };
    const serialized = JSON.stringify(stored, null, 2);
    const tmpPath = `${this.dbFilePath}.${Date.now()}.tmp`;

    await fs.writeFile(tmpPath, serialized, 'utf8');
    await fs.rename(tmpPath, this.dbFilePath);

    if (createBackupSnapshot) {
      const safeStamp = stored.updatedAt.replace(/[: ]/g, '-');
      const backupFile = path.join(this.backupsDir, `sadi_backup_${safeStamp}_${Date.now()}.json`);
      await fs.writeFile(backupFile, serialized, 'utf8');
      await this.pruneOldBackups(15);
    }

    this.integrityVerified = true;
    return stored;
  }

  private async pruneOldBackups(maxKeep: number): Promise<void> {
    try {
      const entries = await fs.readdir(this.backupsDir);
      const jsonBackups = entries.filter((f) => f.endsWith('.json')).sort();
      if (jsonBackups.length > maxKeep) {
        const toDelete = jsonBackups.slice(0, jsonBackups.length - maxKeep);
        await Promise.all(toDelete.map((f) => fs.unlink(path.join(this.backupsDir, f)).catch(() => undefined)));
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private async recoverFromBackups(): Promise<StoredDatabase | null> {
    try {
      const entries = await fs.readdir(this.backupsDir);
      const jsonBackups = entries.filter((f) => f.endsWith('.json')).sort().reverse();
      for (const file of jsonBackups) {
        try {
          const content = await fs.readFile(path.join(this.backupsDir, file), 'utf8');
          const parsed = JSON.parse(content);
          if (this.isValidStoredDb(parsed)) {
            return parsed;
          }
        } catch {
          // Try older backup
        }
      }
    } catch {
      // No backups directory yet
    }
    return null;
  }

  public async ensureInitialized(): Promise<StoredDatabase> {
    await this.ensureDirectories();
    try {
      const content = await fs.readFile(this.dbFilePath, 'utf8');
      const parsed = JSON.parse(content);
      if (this.isValidStoredDb(parsed)) {
        this.initialized = true;
        this.integrityVerified = true;
        return parsed;
      }
      // Checksum or schema mismatch -> attempt auto-recovery from backups
      const recovered = await this.recoverFromBackups();
      if (recovered) {
        await this.writeAtomic(recovered, false);
        this.initialized = true;
        return recovered;
      }
    } catch {
      const recovered = await this.recoverFromBackups();
      if (recovered) {
        await this.writeAtomic(recovered, false);
        this.initialized = true;
        return recovered;
      }
    }

    const seeded = await this.writeAtomic(this.createSeedPayload(), true);
    this.initialized = true;
    return seeded;
  }

  private runSerialized<T>(task: (current: StoredDatabase) => Promise<T>): Promise<T> {
    const next = this.writeQueue.then(async () => {
      const current = await this.ensureInitialized();
      return task(current);
    });
    this.writeQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  public async readAll(): Promise<StoredDatabase> {
    if (!this.initialized) {
      return this.ensureInitialized();
    }
    return this.ensureInitialized();
  }

  public async getHealth(): Promise<DatabaseHealth> {
    const db = await this.readAll();
    let backupCount = 0;
    try {
      const entries = await fs.readdir(this.backupsDir);
      backupCount = entries.filter((f) => f.endsWith('.json')).length;
    } catch {
      backupCount = 0;
    }

    return {
      healthy: true,
      engine: 'Atomic File-Based JSON Database (SHA-256 Verified)',
      dataDir: this.dataDir,
      dbFilePath: this.dbFilePath,
      integrityVerified: this.integrityVerified,
      schemaVersion: db.schemaVersion,
      fiscalYear: db.fiscalYear,
      projectCount: db.projects.length,
      userCount: db.authorizedUsers.length,
      auditLogCount: db.auditLogs.length,
      backupCount,
      totalBudgetAllocated: db.projects.reduce((s, p) => s + p.budgetAllocated, 0),
      totalBudgetActual: db.projects.reduce((s, p) => s + p.budgetActual, 0),
      updatedAt: db.updatedAt,
    };
  }

  public async updateSingleProject(
    id: string,
    incoming: Partial<Project>,
    actorName: string,
    actorRole: string,
    changeNotes?: string
  ): Promise<{ db: StoredDatabase; project: Project; auditLog: AuditLog }> {
    return this.runSerialized(async (current) => {
      const oldProject = current.projects.find((p) => p.id === id);
      if (!oldProject) {
        throw new Error(`Project not found: ${id}`);
      }

      const now = getFormattedNow();
      const updated = sanitizeProject(
        {
          ...incoming,
          id: oldProject.id,
          lastModifiedBy: actorName || 'ผู้ใช้งานระบบ',
          lastModifiedAt: now,
        },
        oldProject
      );

      const changedFields: string[] = [];
      if (oldProject.status !== updated.status) {
        changedFields.push(`สถานะ: ${oldProject.status} -> ${updated.status}`);
      }
      if (oldProject.budgetActual !== updated.budgetActual) {
        changedFields.push(`งบใช้จริง: ฿${oldProject.budgetActual.toLocaleString()} -> ฿${updated.budgetActual.toLocaleString()}`);
      }
      if (oldProject.batchesActual !== updated.batchesActual) {
        changedFields.push(`จำนวนรุ่นจริง: ${oldProject.batchesActual} -> ${updated.batchesActual}`);
      }
      if (oldProject.participantsActual !== updated.participantsActual) {
        changedFields.push(`ผู้เข้าอบรมจริง: ${oldProject.participantsActual} -> ${updated.participantsActual}`);
      }
      if (oldProject.actualDateOrQuarter !== updated.actualDateOrQuarter) {
        changedFields.push(`กำหนดการจัดจริง: ${oldProject.actualDateOrQuarter || '-'} -> ${updated.actualDateOrQuarter || '-'}`);
      }

      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        timestamp: now,
        userName: actorName || 'ผู้ใช้งานระบบ',
        userRole: actorRole || 'editor',
        projectId: updated.id,
        projectName: updated.name,
        actionType: 'update',
        fieldChanged: changedFields.length > 0 ? changedFields.join(' | ') : 'ปรับปรุงข้อมูลทั่วไป',
        oldValue: `สถานะ: ${oldProject.status}, เบิกจ่าย: ฿${oldProject.budgetActual.toLocaleString()}`,
        newValue: `สถานะ: ${updated.status}, เบิกจ่าย: ฿${updated.budgetActual.toLocaleString()}`,
        notes: changeNotes || 'บันทึกผ่านฐานข้อมูลระบบไฟล์อย่างสมบูรณ์',
      };

      const saved = await this.writeAtomic(
        {
          ...current,
          projects: current.projects.map((p) => (p.id === id ? updated : p)),
          auditLogs: [newLog, ...current.auditLogs].slice(0, 500),
        },
        true
      );

      return { db: saved, project: updated, auditLog: newLog };
    });
  }

  public async bulkUpdateProjects(
    incomingList: Partial<Project>[],
    actorName: string,
    actorRole: string,
    auditNote?: string
  ): Promise<{ db: StoredDatabase; auditLog: AuditLog }> {
    return this.runSerialized(async (current) => {
      const now = getFormattedNow();
      const map = new Map(current.projects.map((p) => [p.id, p]));
      const updatedList: Project[] = incomingList.map((item) => {
        const prev = item.id ? map.get(item.id) : undefined;
        return sanitizeProject(
          {
            ...item,
            lastModifiedBy: item.lastModifiedBy || actorName || 'ผู้ใช้งานระบบ',
            lastModifiedAt: item.lastModifiedAt || now,
          },
          prev
        );
      });

      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        timestamp: now,
        userName: actorName || 'ผู้ใช้งานระบบ',
        userRole: actorRole || 'editor',
        projectId: 'bulk',
        projectName: auditNote ? 'นำเข้าข้อมูลโครงการจากไฟล์ (Excel / CSV)' : 'บันทึกแก้ไขรายการแบบกลุ่ม (Bulk Edit)',
        actionType: 'bulk_update',
        fieldChanged: auditNote || 'แก้ไขรายการหลายรายการพร้อมกัน',
        oldValue: `จำนวนเดิม ${current.projects.length} โครงการ`,
        newValue: `ปรับปรุงข้อมูล ${updatedList.length} โครงการ`,
        notes: auditNote || 'บันทึกการแก้ไขปรับปรุงรายการทั้งหมดลงไฟล์ฐานข้อมูล',
      };

      const saved = await this.writeAtomic(
        {
          ...current,
          projects: updatedList,
          auditLogs: [newLog, ...current.auditLogs].slice(0, 500),
        },
        true
      );

      return { db: saved, auditLog: newLog };
    });
  }

  public async createProject(
    incoming: Omit<Project, 'id'>,
    actorName: string,
    actorRole: string
  ): Promise<{ db: StoredDatabase; project: Project; auditLog: AuditLog }> {
    return this.runSerialized(async (current) => {
      const now = getFormattedNow();
      const newProj = sanitizeProject({
        ...incoming,
        id: `custom-${Date.now()}`,
        lastModifiedBy: actorName || 'Admin',
        lastModifiedAt: now,
      });

      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        timestamp: now,
        userName: actorName || 'Admin',
        userRole: actorRole || 'admin',
        projectId: newProj.id,
        projectName: newProj.name,
        actionType: 'create',
        fieldChanged: 'สร้างโครงการใหม่',
        oldValue: '-',
        newValue: `งบประมาณจัดสรร: ฿${newProj.budgetAllocated.toLocaleString()}`,
        notes: 'เพิ่มโครงการใหม่เข้าสู่ฐานข้อมูลระบบแผนพัฒนาฯ',
      };

      const saved = await this.writeAtomic(
        {
          ...current,
          projects: [newProj, ...current.projects],
          auditLogs: [newLog, ...current.auditLogs].slice(0, 500),
        },
        true
      );

      return { db: saved, project: newProj, auditLog: newLog };
    });
  }

  public async removeProject(
    id: string,
    actorName: string,
    actorRole: string
  ): Promise<{ db: StoredDatabase; auditLog: AuditLog }> {
    return this.runSerialized(async (current) => {
      const target = current.projects.find((p) => p.id === id);
      if (!target) {
        throw new Error(`Project not found: ${id}`);
      }

      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        timestamp: getFormattedNow(),
        userName: actorName || 'Admin',
        userRole: actorRole || 'admin',
        projectId: id,
        projectName: target.name,
        actionType: 'delete',
        fieldChanged: 'ลบโครงการ',
        oldValue: `รหัส: ${target.code}, งบ: ฿${target.budgetAllocated.toLocaleString()}`,
        newValue: 'ถูกลบออกจากระบบ',
        notes: 'ลบโครงการโดยผู้มีอำนาจ',
      };

      const saved = await this.writeAtomic(
        {
          ...current,
          projects: current.projects.filter((p) => p.id !== id),
          auditLogs: [newLog, ...current.auditLogs].slice(0, 500),
        },
        true
      );

      return { db: saved, auditLog: newLog };
    });
  }

  public async addAuthorizedUser(
    userData: Omit<AuthorizedUser, 'id'>,
    actorName: string,
    actorRole: string
  ): Promise<{ db: StoredDatabase; user: AuthorizedUser; auditLog: AuditLog }> {
    return this.runSerialized(async (current) => {
      const newId = `user-${Date.now()}`;
      const initials = userData.name.split(' ').map((n) => n[0]).join('').slice(0, 2) || 'จน';
      const newUser: AuthorizedUser = {
        ...userData,
        id: newId,
        avatarText: initials,
      };

      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        timestamp: getFormattedNow(),
        userName: actorName || 'Admin',
        userRole: actorRole || 'admin',
        projectId: 'system',
        projectName: 'การบริหารสิทธิ์ผู้ใช้งาน',
        actionType: 'create',
        fieldChanged: 'เพิ่มรายชื่อผู้มีสิทธิ์แก้ไข',
        oldValue: '-',
        newValue: `${newUser.name} (${newUser.position})`,
        notes: `เพิ่มสิทธิ์ประเภท: ${newUser.role}`,
      };

      const saved = await this.writeAtomic(
        {
          ...current,
          authorizedUsers: [...current.authorizedUsers, newUser],
          auditLogs: [newLog, ...current.auditLogs].slice(0, 500),
        },
        true
      );

      return { db: saved, user: newUser, auditLog: newLog };
    });
  }

  public async removeAuthorizedUser(
    userId: string,
    actorName: string,
    actorRole: string
  ): Promise<{ db: StoredDatabase; auditLog: AuditLog }> {
    return this.runSerialized(async (current) => {
      const target = current.authorizedUsers.find((u) => u.id === userId);
      if (!target) {
        throw new Error(`User not found: ${userId}`);
      }

      const newLog: AuditLog = {
        id: `log-${Date.now()}`,
        timestamp: getFormattedNow(),
        userName: actorName || 'Admin',
        userRole: actorRole || 'admin',
        projectId: 'system',
        projectName: 'การบริหารสิทธิ์ผู้ใช้งาน',
        actionType: 'delete',
        fieldChanged: 'เพิกถอนสิทธิ์ผู้ใช้งาน',
        oldValue: `${target.name} (${target.position})`,
        newValue: 'เพิกถอนสิทธิ์',
        notes: 'ลบออกจากรายชื่อผู้มีสิทธิแก้ไขปรับปรุง',
      };

      const saved = await this.writeAtomic(
        {
          ...current,
          authorizedUsers: current.authorizedUsers.filter((u) => u.id !== userId),
          auditLogs: [newLog, ...current.auditLogs].slice(0, 500),
        },
        true
      );

      return { db: saved, auditLog: newLog };
    });
  }

  public async appendLog(log: AuditLog): Promise<StoredDatabase> {
    return this.runSerialized(async (current) => {
      return this.writeAtomic(
        {
          ...current,
          auditLogs: [log, ...current.auditLogs].slice(0, 500),
        },
        false
      );
    });
  }

  public async resetAll(): Promise<StoredDatabase> {
    return this.runSerialized(async (current) => {
      // Save a snapshot of pre-reset state first so no data is ever lost unexpectedly
      await this.writeAtomic(current, true);
      return this.writeAtomic(this.createSeedPayload(), true);
    });
  }
}

export const fileDb = new FileDatabaseManager();
