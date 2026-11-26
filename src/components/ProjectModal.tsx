import React, { useState, useEffect, useMemo } from 'react';
import { Project, FundingSource, ProjectStatus, Quarter, ExpenseItem } from '../types';
import { X, Plus, Trash2, Save, AlertTriangle, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  findDuplicateMatchesForProject,
  getDuplicateReasonLabel,
} from '../utils/duplicateDetection';

function generateNextUniqueCode(projects: Project[], fundingSource: FundingSource): string {
  const prefix = fundingSource === 'budget_annual' ? 'GOV-70-' : 'FUND-70-';
  const existingCodes = new Set(projects.map((p) => p.code.trim().toLowerCase()));
  let maxNum = 0;
  projects.forEach((p) => {
    const trimmed = p.code.trim().toUpperCase();
    if (trimmed.startsWith(prefix)) {
      const tail = Number.parseInt(trimmed.slice(prefix.length), 10);
      if (Number.isFinite(tail) && tail > maxNum) {
        maxNum = tail;
      }
    }
  });
  let nextNum = maxNum + 1;
  while (existingCodes.has(`${prefix}${String(nextNum).padStart(2, '0')}`.toLowerCase())) {
    nextNum += 1;
  }
  return `${prefix}${String(nextNum).padStart(2, '0')}`;
}

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  projectToEdit,
}) => {
  const { projects, addProject, updateProject } = useApp();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('1. การพัฒนาสายวิชาชีพ (Professional Development)');
  const [subCategory, setSubCategory] = useState('');
  const [targetGroup, setTargetGroup] = useState('');
  const [fundingSource, setFundingSource] = useState<FundingSource>('budget_annual');
  const [status, setStatus] = useState<ProjectStatus>('in_progress');
  const [quarters, setQuarters] = useState<Quarter[]>(['Q1']);
  const [executionDateSchedule, setExecutionDateSchedule] = useState('');
  const [actualDateOrQuarter, setActualDateOrQuarter] = useState('');
  const [batchesPlanned, setBatchesPlanned] = useState<number>(1);
  const [batchesActual, setBatchesActual] = useState<number>(0);
  const [participantsPerBatch, setParticipantsPerBatch] = useState<number>(50);
  const [participantsPlanned, setParticipantsPlanned] = useState<number>(50);
  const [participantsActual, setParticipantsActual] = useState<number>(0);
  const [budgetAllocated, setBudgetAllocated] = useState<number>(100000);
  const [budgetActual, setBudgetActual] = useState<number>(0);
  const [objectives, setObjectives] = useState('');
  const [expectedBenefits, setExpectedBenefits] = useState('');
  const [evaluationMethod, setEvaluationMethod] = useState('');
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([]);
  const [editNotes, setEditNotes] = useState('');
  const [confirmNonDuplicate, setConfirmNonDuplicate] = useState(false);

  useEffect(() => {
    if (projectToEdit) {
      setCode(projectToEdit.code);
      setName(projectToEdit.name);
      setCategory(projectToEdit.category);
      setSubCategory(projectToEdit.subCategory || '');
      setTargetGroup(projectToEdit.targetGroup);
      setFundingSource(projectToEdit.fundingSource);
      setStatus(projectToEdit.status);
      setQuarters(projectToEdit.quarters || ['Q1']);
      setExecutionDateSchedule(projectToEdit.executionDateSchedule || '');
      setActualDateOrQuarter(projectToEdit.actualDateOrQuarter || '');
      setBatchesPlanned(projectToEdit.batchesPlanned || 1);
      setBatchesActual(projectToEdit.batchesActual || 0);
      setParticipantsPerBatch(projectToEdit.participantsPerBatch || 50);
      setParticipantsPlanned(projectToEdit.participantsPlanned || 50);
      setParticipantsActual(projectToEdit.participantsActual || 0);
      setBudgetAllocated(projectToEdit.budgetAllocated || 0);
      setBudgetActual(projectToEdit.budgetActual || 0);
      setObjectives(projectToEdit.objectives || '');
      setExpectedBenefits(projectToEdit.expectedBenefits || '');
      setEvaluationMethod(projectToEdit.evaluationMethod || '');
      setExpenseItems(projectToEdit.expenseItems || []);
      setEditNotes('');
    } else {
      setCode(generateNextUniqueCode(projects, 'budget_annual'));
      setName('');
      setCategory('1. การพัฒนาสายวิชาชีพ (Professional Development)');
      setSubCategory('');
      setTargetGroup('');
      setFundingSource('budget_annual');
      setStatus('in_progress');
      setQuarters(['Q1']);
      setExecutionDateSchedule('');
      setActualDateOrQuarter('อยู่ระหว่างดำเนินการตามแผน');
      setBatchesPlanned(1);
      setBatchesActual(0);
      setParticipantsPerBatch(50);
      setParticipantsPlanned(50);
      setParticipantsActual(0);
      setBudgetAllocated(100000);
      setBudgetActual(0);
      setObjectives('');
      setExpectedBenefits('');
      setEvaluationMethod('');
      setExpenseItems([]);
      setEditNotes('สร้างโครงการใหม่');
    }
    setConfirmNonDuplicate(false);
  }, [projectToEdit, isOpen]);

  const normalizedCode = code.trim().toLowerCase();

  const duplicateProject = useMemo(() => {
    if (!normalizedCode) return null;
    return (
      projects.find(
        (p) =>
          p.id !== projectToEdit?.id &&
          p.code.trim().toLowerCase() === normalizedCode
      ) || null
    );
  }, [projects, normalizedCode, projectToEdit?.id]);

  // Automatic cross-code duplicate detection (name similarity + budget overlap)
  const contentDuplicateMatches = useMemo(() => {
    if (!name.trim()) return [];
    return findDuplicateMatchesForProject(
      {
        id: projectToEdit?.id,
        code: code.trim(),
        name: name.trim(),
        category,
        fundingSource,
        budgetAllocated: Number(budgetAllocated) || 0,
        budgetActual: Number(budgetActual) || 0,
        participantsPlanned: Number(participantsPlanned) || 0,
      },
      projects
    ).filter((m) => m.existingProject.id !== duplicateProject?.id);
  }, [
    projectToEdit?.id,
    code,
    name,
    category,
    fundingSource,
    budgetAllocated,
    budgetActual,
    participantsPlanned,
    projects,
    duplicateProject?.id,
  ]);

  const hasHighRiskDuplicate = contentDuplicateMatches.some((m) => m.severity === 'high');
  const isBlockedByDuplicateGuard = hasHighRiskDuplicate && !confirmNonDuplicate;

  useEffect(() => {
    setConfirmNonDuplicate(false);
  }, [name, budgetAllocated, budgetActual, fundingSource]);

  const suggestedUniqueCode = useMemo(
    () => generateNextUniqueCode(projects, fundingSource),
    [projects, fundingSource]
  );

  if (!isOpen) return null;

  const handleToggleQuarter = (q: Quarter) => {
    if (quarters.includes(q)) {
      if (quarters.length > 1) {
        setQuarters(quarters.filter((item) => item !== q));
      }
    } else {
      setQuarters([...quarters, q].sort());
    }
  };

  const handleAddExpenseItem = () => {
    const newItem: ExpenseItem = {
      id: `item-${Date.now()}`,
      name: '',
      quantity: 1,
      unitName: 'รายการ',
      ratePerUnit: 0,
      totalAmount: 0,
    };
    setExpenseItems([...expenseItems, newItem]);
  };

  const handleUpdateExpenseItem = (id: string, field: keyof ExpenseItem, val: any) => {
    setExpenseItems(
      expenseItems.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: val };
          if (field === 'quantity' || field === 'ratePerUnit') {
            const qty = field === 'quantity' ? Number(val) : Number(item.quantity || 1);
            const rate = field === 'ratePerUnit' ? Number(val) : Number(item.ratePerUnit || 0);
            updated.totalAmount = qty * rate;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleRemoveExpenseItem = (id: string) => {
    setExpenseItems(expenseItems.filter((item) => item.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCode = code.trim();
    if (!cleanedCode || !name.trim() || duplicateProject || isBlockedByDuplicateGuard) return;

    const fundingSourceNameTh =
      fundingSource === 'budget_annual'
        ? 'งบประมาณรายจ่ายประจำปี (งบรัฐ 13 โครงการ)'
        : 'เงินกองทุนเพื่อการพัฒนาการตรวจเงินแผ่นดิน (26 โครงการ)';

    if (projectToEdit) {
      updateProject(
        {
          ...projectToEdit,
          code: cleanedCode,
          name: name.trim(),
          category,
          subCategory,
          targetGroup,
          fundingSource,
          fundingSourceNameTh,
          status,
          quarters,
          executionDateSchedule,
          actualDateOrQuarter,
          batchesPlanned: Number(batchesPlanned),
          batchesActual: Number(batchesActual),
          participantsPerBatch: Number(participantsPerBatch),
          participantsPlanned: Number(participantsPlanned),
          participantsActual: Number(participantsActual),
          budgetAllocated: Number(budgetAllocated),
          budgetActual: Number(budgetActual),
          objectives,
          expectedBenefits,
          evaluationMethod,
          expenseItems,
        },
        editNotes.trim()
      );
    } else {
      addProject({
        code: cleanedCode,
        name: name.trim(),
        category,
        subCategory,
        targetGroup,
        fundingSource,
        fundingSourceNameTh,
        status,
        quarters,
        executionDateSchedule,
        actualDateOrQuarter,
        batchesPlanned: Number(batchesPlanned),
        batchesActual: Number(batchesActual),
        participantsPerBatch: Number(participantsPerBatch),
        participantsPlanned: Number(participantsPlanned),
        participantsActual: Number(participantsActual),
        budgetAllocated: Number(budgetAllocated),
        budgetActual: Number(budgetActual),
        objectives,
        expectedBenefits,
        evaluationMethod,
        expenseItems,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#091224] border border-cyan-900/50 rounded-2xl w-full max-w-3xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 text-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-cyan-950 flex items-center justify-between bg-[#060D1A]">
          <div>
            <h3 className="font-bold text-white text-base">
              {projectToEdit ? 'แก้ไขปรับปรุงข้อมูลโครงการ' : 'เพิ่มโครงการ/หลักสูตรใหม่'}
            </h3>
            <p className="text-xs text-slate-400">
              {projectToEdit ? `รหัสโครงการ: ${projectToEdit.code}` : 'สร้างโครงการใหม่ในแผนพัฒนาศักยภาพบุคลากร พ.ศ. 2570'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto text-xs">
          {/* Basic Info */}
          <div className="space-y-3">
            <h4 className="font-bold text-cyan-300 text-xs border-b border-cyan-950 pb-1.5">
              1. ข้อมูลพื้นฐานโครงการ
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-slate-400 font-medium mb-1">รหัสโครงการ *</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  aria-invalid={Boolean(duplicateProject)}
                  className={`w-full px-3 py-2 rounded-xl border bg-[#060D1A] text-white font-mono focus:outline-hidden ${
                    duplicateProject
                      ? 'border-rose-500 text-rose-200 focus:border-rose-400'
                      : 'border-cyan-900/60 focus:border-cyan-400'
                  }`}
                />
                {!duplicateProject && normalizedCode && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>รหัสนี้พร้อมใช้งาน</span>
                  </div>
                )}
              </div>
              <div className="sm:col-span-3">
                <label className="block text-slate-400 font-medium mb-1">ชื่อโครงการ / หลักสูตร *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น โครงการฝึกอบรม หลักสูตร..."
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white"
                />
              </div>
            </div>

            {duplicateProject && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-950/45 border border-rose-500/70 text-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold text-rose-200">
                      ไม่สามารถบันทึกได้: รหัสโครงการ "{code.trim()}" ซ้ำกับโครงการที่มีอยู่แล้ว
                    </div>
                    <p className="text-[11px] text-rose-200/90">
                      ซ้ำกับ: <span className="font-semibold text-white">{duplicateProject.name}</span> ({duplicateProject.code}) — กรุณาแก้ไขรหัสโครงการไม่ให้ซ้ำกันก่อนบันทึก
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCode(suggestedUniqueCode)}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/60 text-white font-mono font-semibold text-[11px] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>ใช้รหัสว่าง {suggestedUniqueCode}</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">แหล่งงบประมาณ *</label>
                <select
                  value={fundingSource}
                  onChange={(e) => setFundingSource(e.target.value as FundingSource)}
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white font-medium"
                >
                  <option value="budget_annual">งบประมาณรายจ่ายประจำปี (งบรัฐ 13,129,200.00 บาท)</option>
                  <option value="budget_fund">เงินกองทุนเพื่อการพัฒนาการตรวจเงินแผ่นดิน (61,562,250.00 บาท)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">กลุ่มเป้าหมาย</label>
                <input
                  type="text"
                  value={targetGroup}
                  onChange={(e) => setTargetGroup(e.target.value)}
                  placeholder="เช่น ชก. 1-3 ปี กลาง/ภาค FA"
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">หมวดหมู่ภารกิจ</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">สายงาน / หมวดหมู่ย่อย</label>
                <input
                  type="text"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  placeholder="เช่น การพัฒนาสายงานการตรวจสอบ (Auditors Development)"
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white"
                />
              </div>
            </div>
          </div>

          {/* Status & Operational execution */}
          <div className="space-y-3">
            <h4 className="font-bold text-cyan-300 text-xs border-b border-cyan-950 pb-1.5">
              2. สถานะโครงการและกำหนดการดำเนินการ
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">สถานะโครงการ *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white font-semibold"
                >
                  <option value="in_progress">อยู่ระหว่างดำเนินการ</option>
                  <option value="not_started">ยังไม่ได้ดำเนินการ</option>
                  <option value="completed">ดำเนินการเสร็จแล้ว</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">กำหนดการตามแผน (ว/ด/ป)</label>
                <input
                  type="text"
                  value={executionDateSchedule}
                  onChange={(e) => setExecutionDateSchedule(e.target.value)}
                  placeholder="เช่น 21-25 มิ.ย. 69"
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">ดำเนินการจริง (เปลี่ยนแปลงได้)</label>
                <input
                  type="text"
                  value={actualDateOrQuarter}
                  onChange={(e) => setActualDateOrQuarter(e.target.value)}
                  placeholder="เช่น อยู่ระหว่างดำเนินการตามแผน"
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">กำหนดการดำเนินการ (ไตรมาส)</label>
              <div className="flex items-center gap-2">
                {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleToggleQuarter(q)}
                    className={`px-3 py-1.5 rounded-xl font-mono font-medium border text-xs cursor-pointer ${
                      quarters.includes(q)
                        ? 'bg-cyan-500/30 text-cyan-300 border-cyan-500 font-bold'
                        : 'bg-[#060D1A] text-slate-400 border-cyan-950'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Batches & Participants */}
          <div className="space-y-3">
            <h4 className="font-bold text-cyan-300 text-xs border-b border-cyan-950 pb-1.5">
              3. จำนวนรุ่นและจำนวนผู้เข้ารับการอบรม (ตัวเลขอาราบิก)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">จำนวนรุ่นตามแผน</label>
                <input
                  type="number"
                  min="1"
                  value={batchesPlanned}
                  onChange={(e) => setBatchesPlanned(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">จำนวนรุ่นดำเนินการจริง</label>
                <input
                  type="number"
                  min="0"
                  value={batchesActual}
                  onChange={(e) => setBatchesActual(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">คนเข้าอบรมตามแผน</label>
                <input
                  type="number"
                  min="1"
                  value={participantsPlanned}
                  onChange={(e) => setParticipantsPlanned(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">คนเข้าอบรมจริง</label>
                <input
                  type="number"
                  min="0"
                  value={participantsActual}
                  onChange={(e) => setParticipantsActual(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white font-mono font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Budget section */}
          <div className="space-y-3">
            <h4 className="font-bold text-cyan-300 text-xs border-b border-cyan-950 pb-1.5">
              4. ประมาณการงบประมาณและการเบิกจ่าย (บาท)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  จำนวนงบประมาณที่ได้รับการจัดสรร (ตามตาราง) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={budgetAllocated}
                  onChange={(e) => setBudgetAllocated(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  จำนวนงบประมาณที่ใช้จ่ายจริง (เปิดให้ระบุเอง) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={budgetActual}
                  onChange={(e) => setBudgetActual(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-emerald-400 font-mono font-bold"
                />
                <div className="text-[11px] text-slate-400 mt-1 flex justify-between font-mono">
                  <span>คงเหลือ: ฿{(budgetAllocated - budgetActual).toLocaleString()}</span>
                  <span>เบิกจ่าย: {budgetAllocated > 0 ? ((budgetActual / budgetAllocated) * 100).toFixed(1) : 0}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Automatic Duplicate & Budget Overlap Alert Panel */}
          {contentDuplicateMatches.length > 0 && (
            <div
              role="alert"
              className={`p-4 rounded-xl border space-y-3 ${
                hasHighRiskDuplicate
                  ? 'bg-amber-950/40 border-amber-500/70 text-amber-100'
                  : 'bg-cyan-950/35 border-amber-500/45 text-amber-100'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="font-bold text-xs sm:text-sm text-amber-200">
                    ระบบตรวจพบข้อมูลโครงการหรืองบประมาณคล้าย/ซ้ำซ้อน ({contentDuplicateMatches.length} รายการ) แม้อยู่คนละรหัสโครงการ
                  </div>
                  <p className="text-[11px] text-amber-100/85 leading-relaxed">
                    กรุณาตรวจสอบรายการด้านล่างก่อนบันทึก เพื่อป้องกันการนับยอดงบประมาณจัดสรรหรือยอดเบิกจ่ายซ้ำซ้อนบนหน้า Dashboard
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {contentDuplicateMatches.slice(0, 5).map((match) => (
                  <div
                    key={match.existingProject.id}
                    className="p-2.5 rounded-lg bg-[#060D1A]/90 border border-amber-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono font-bold text-cyan-300 px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800">
                          {match.existingProject.code}
                        </span>
                        <span className="font-semibold text-white truncate">
                          {match.existingProject.name}
                        </span>
                      </div>
                      <div className="text-amber-300 font-medium">
                        {getDuplicateReasonLabel(match.reason)} — {match.explanation}
                      </div>
                    </div>
                    <div className="font-mono tabular-nums text-right shrink-0 text-slate-300">
                      <div>จัดสรร: ฿{match.existingProject.budgetAllocated.toLocaleString()}</div>
                      <div className={match.existingProject.budgetActual > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                        ใช้จริง: ฿{match.existingProject.budgetActual.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {hasHighRiskDuplicate && (
                <label className="flex items-start gap-2.5 pt-2 border-t border-amber-800/40 cursor-pointer text-[11px] text-amber-100">
                  <input
                    type="checkbox"
                    checked={confirmNonDuplicate}
                    onChange={(e) => setConfirmNonDuplicate(e.target.checked)}
                    className="mt-0.5 accent-amber-400 cursor-pointer"
                  />
                  <span className="font-semibold">
                    ตรวจสอบแล้ว ยืนยันว่ารายการนี้ไม่ใช่ข้อมูลซ้ำซ้อนและต้องการบันทึกแยกเป็นคนละโครงการ
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Audit Note */}
          <div className="space-y-1 bg-[#060D1A] p-3 rounded-xl border border-cyan-950">
            <label className="block text-slate-300 font-medium">
              หมายเหตุการแก้ไข (บันทึกในหน้า Admin Audit Logs)
            </label>
            <input
              type="text"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="ระบุเหตุผล เช่น ปรับปรุงข้อมูลตามแผนงานไตรมาส..."
              className="w-full px-3 py-1.5 rounded-lg border border-cyan-900/60 bg-[#091224] text-white"
            />
          </div>

          {/* Form Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-cyan-950">
            <div className="text-[11px]">
              {duplicateProject ? (
                <span className="text-rose-300 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  กรุณาแก้ไขรหัสโครงการที่ซ้ำกันก่อนกดบันทึก
                </span>
              ) : isBlockedByDuplicateGuard ? (
                <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  พบข้อมูลอาจซ้ำซ้อน กรุณาตรวจสอบหรือติ๊กยืนยันก่อนบันทึก
                </span>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={Boolean(duplicateProject) || isBlockedByDuplicateGuard || !code.trim() || !name.trim()}
                className={`px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all ${
                  duplicateProject || isBlockedByDuplicateGuard || !code.trim() || !name.trim()
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 cursor-pointer'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>บันทึกข้อมูล</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
