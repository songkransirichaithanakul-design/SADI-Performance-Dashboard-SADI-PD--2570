import React, { useState, useEffect } from 'react';
import { Project, FundingSource, ProjectStatus, Quarter, ExpenseItem } from '../types';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { useApp } from '../context/AppContext';

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
  const { addProject, updateProject } = useApp();

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
      setCode(`PRJ-${Date.now().toString().slice(-4)}`);
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
  }, [projectToEdit, isOpen]);

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
    if (!name.trim()) return;

    const fundingSourceNameTh =
      fundingSource === 'budget_annual'
        ? 'งบประมาณรายจ่ายประจำปี (งบรัฐ 13 โครงการ)'
        : 'เงินกองทุนเพื่อการพัฒนาการตรวจเงินแผ่นดิน (26 โครงการ)';

    if (projectToEdit) {
      updateProject(
        {
          ...projectToEdit,
          code,
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
        code,
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
                  className="w-full px-3 py-2 rounded-xl border border-cyan-900/60 bg-[#060D1A] text-white font-mono"
                />
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
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-cyan-950">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-medium cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกข้อมูล</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
