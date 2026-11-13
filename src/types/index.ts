export type FundingSource = 'budget_annual' | 'budget_fund';

export type ProjectStatus = 'completed' | 'in_progress' | 'not_started';

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface ExpenseItem {
  id: string;
  name: string;
  ratePerUnit?: number;
  unitName?: string;
  quantity?: number;
  totalAmount: number;
  note?: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  category: string; // e.g. '1. การพัฒนาสายวิชาชีพ (Professional Development)'
  subCategory?: string; // e.g. 'การพัฒนาสายงานการตรวจสอบ (Auditors Development)'
  targetGroup: string; // e.g. 'ชก. 1-3 ปี กลาง/ภาค FA'
  batchesPlanned: number; // จำนวนรุ่นตามแผน
  batchesActual: number; // จำนวนรุ่นดำเนินการจริง
  participantsPerBatch: number; // จำนวนคน/รุ่น
  participantsPlanned: number; // จำนวนคนเข้าอบรมตามแผน
  participantsActual: number; // จำนวนคนเข้าอบรมจริง
  budgetAllocated: number; // จำนวนงบประมาณที่ได้รับการจัดสรร
  budgetActual: number; // จำนวนงบประมาณที่ใช้จ่ายจริง (เปิดให้ระบุเอง)
  fundingSource: FundingSource; // แหล่งงบประมาณ
  fundingSourceNameTh: string;
  status: ProjectStatus;
  quarters: Quarter[]; // กำหนดการดำเนินการ (ไตรมาส)
  actualDateOrQuarter?: string; // ดำเนินการจริง (ให้เลือก เปลี่ยนแปลงได้)
  executionDateSchedule: string; // ว/ด/ป ตามแผน
  objectives?: string; // วัตถุประสงค์
  targetAudienceNote?: string; // กลุ่มเป้าหมาย
  expectedBenefits?: string; // ผลประโยชน์ที่จะได้รับ
  evaluationMethod?: string; // วิธีการวัดผลโครงการ
  expenseItems?: ExpenseItem[]; // รายการค่าใช้จ่ายย่อย
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export interface AuthorizedUser {
  id: string;
  name: string;
  position: string;
  department: string;
  role: 'editor' | 'admin' | 'viewer';
  email: string;
  avatarText: string;
  password?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  projectId: string;
  projectName: string;
  actionType: 'create' | 'update' | 'delete' | 'bulk_update';
  fieldChanged: string;
  oldValue: string;
  newValue: string;
  notes?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'urgent';
  read: boolean;
  projectId?: string;
}
