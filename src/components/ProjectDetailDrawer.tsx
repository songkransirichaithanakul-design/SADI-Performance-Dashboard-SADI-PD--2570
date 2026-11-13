import React from 'react';
import { Project } from '../types';
import { X, CheckCircle2, Clock, AlertCircle, Edit, DollarSign, Users, Calendar, Award, Building, FileText, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface ProjectDetailDrawerProps {
  project: Project | null;
  onClose: () => void;
  onEdit: (project: Project) => void;
}

export const ProjectDetailDrawer: React.FC<ProjectDetailDrawerProps> = ({
  project,
  onClose,
  onEdit,
}) => {
  const { currentUser } = useApp();

  if (!project) return null;

  const canEdit = currentUser.role === 'admin' || currentUser.role === 'editor';
  const remainingBudget = project.budgetAllocated - project.budgetActual;
  const disbursementRate = project.budgetAllocated > 0 ? (project.budgetActual / project.budgetAllocated) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end">
      <div className="bg-[#091224] border-l border-cyan-900/50 w-full max-w-2xl h-full flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.15)] animate-in slide-in-from-right duration-200 text-slate-100">
        {/* Drawer Header */}
        <div className="p-6 border-b border-cyan-950 flex items-start justify-between gap-4 bg-[#060D1A]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded">
                {project.code}
              </span>
              <span className="text-xs text-slate-400">{project.fundingSourceNameTh}</span>
            </div>
            <h2 className="text-lg font-bold text-white leading-snug">
              {project.name}
            </h2>
            <div className="text-xs text-cyan-400/80">
              {project.category} {project.subCategory ? `› ${project.subCategory}` : ''}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(project);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>แก้ไขโครงการ</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status & Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#060D1A] p-3 rounded-xl border border-cyan-950">
              <span className="text-[11px] text-slate-400 block">สถานะโครงการ</span>
              <div className="mt-1 font-semibold text-xs flex items-center gap-1.5">
                {project.status === 'completed' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">เสร็จแล้ว</span>
                  </>
                ) : project.status === 'in_progress' ? (
                  <>
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span className="text-cyan-300">อยู่ระหว่างดำเนินการ</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-300">ยังไม่ได้ดำเนินการ</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-[#060D1A] p-3 rounded-xl border border-cyan-950">
              <span className="text-[11px] text-slate-400 block">งบประมาณจัดสรร</span>
              <span className="mt-1 font-mono font-bold text-xs text-white block">
                ฿{project.budgetAllocated.toLocaleString()}
              </span>
            </div>

            <div className="bg-[#060D1A] p-3 rounded-xl border border-cyan-950">
              <span className="text-[11px] text-slate-400 block">เบิกจ่ายจริง (ปี 2570)</span>
              <span className="mt-1 font-mono font-bold text-xs text-slate-300 block">
                ฿{project.budgetActual.toLocaleString()} ({disbursementRate.toFixed(1)}%)
              </span>
            </div>

            <div className="bg-[#060D1A] p-3 rounded-xl border border-cyan-950">
              <span className="text-[11px] text-slate-400 block">คงเหลือ</span>
              <span className="mt-1 font-mono font-bold text-xs text-emerald-400 block">
                ฿{remainingBudget.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Operational Details */}
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-white text-sm border-b border-cyan-950 pb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>กำหนดการและการดำเนินงาน (ตัวเลขอาราบิก)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-[#060D1A] rounded-xl border border-cyan-950">
                <span className="text-slate-400 block mb-0.5">กำหนดการดำเนินการ (ไตรมาสตามแผน)</span>
                <span className="font-semibold text-cyan-300 font-mono">
                  {project.quarters.join(', ')}
                </span>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  กำหนดการ: {project.executionDateSchedule}
                </div>
              </div>

              <div className="p-3 bg-[#060D1A] rounded-xl border border-cyan-950">
                <span className="text-slate-400 block mb-0.5">การดำเนินการจริง</span>
                <span className="font-semibold text-slate-200">
                  {project.actualDateOrQuarter || 'ตามแผนงาน'}
                </span>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">
                  รุ่นที่ดำเนินการแล้ว: {project.batchesActual} / {project.batchesPlanned} รุ่น
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-[#060D1A] rounded-xl border border-cyan-950">
                <span className="text-slate-400 block mb-0.5">กลุ่มเป้าหมาย</span>
                <span className="font-semibold text-slate-200">
                  {project.targetGroup}
                </span>
              </div>

              <div className="p-3 bg-[#060D1A] rounded-xl border border-cyan-950">
                <span className="text-slate-400 block mb-0.5">จำนวนผู้เข้าอบรม</span>
                <span className="font-semibold text-cyan-300 font-mono">
                  {project.participantsActual} คน (แผน: {project.participantsPlanned} คน, {project.participantsPerBatch} คน/รุ่น)
                </span>
              </div>
            </div>
          </div>

          {/* Objectives & Expected Benefits */}
          {(project.objectives || project.expectedBenefits) && (
            <div className="space-y-4 text-xs">
              <h3 className="font-bold text-white text-sm border-b border-cyan-950 pb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>วัตถุประสงค์และผลประโยชน์ที่คาดว่าจะได้รับ</span>
              </h3>

              {project.objectives && (
                <div>
                  <span className="font-semibold text-cyan-300 block mb-1">
                    วัตถุประสงค์โครงการ:
                  </span>
                  <p className="text-slate-300 bg-[#060D1A] p-3 rounded-xl leading-relaxed border border-cyan-950">
                    {project.objectives}
                  </p>
                </div>
              )}

              {project.expectedBenefits && (
                <div>
                  <span className="font-semibold text-cyan-300 block mb-1">
                    ผลประโยชน์ที่จะได้รับ:
                  </span>
                  <p className="text-slate-300 bg-[#060D1A] p-3 rounded-xl leading-relaxed border border-cyan-950">
                    {project.expectedBenefits}
                  </p>
                </div>
              )}

              {project.evaluationMethod && (
                <div>
                  <span className="font-semibold text-cyan-300 block mb-1">
                    วิธีการวัดผลโครงการ:
                  </span>
                  <p className="text-slate-300 bg-[#060D1A] p-3 rounded-xl leading-relaxed border border-cyan-950">
                    {project.evaluationMethod}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Detailed Expense Items Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-cyan-950 pb-2">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-cyan-400" />
                <span>รายละเอียดประมาณการค่าใช้จ่ายย่อย (ตามเอกสารทางการ)</span>
              </h3>
              <span className="text-[11px] font-mono text-cyan-400/80">หน่วย : บาท</span>
            </div>

            {project.expenseItems && project.expenseItems.length > 0 ? (
              <div className="border border-cyan-950 rounded-xl overflow-hidden bg-[#060D1A]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0A1630] text-cyan-200 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">รายการค่าใช้จ่าย</th>
                      <th className="py-2.5 px-2 text-right font-mono">จำนวน</th>
                      <th className="py-2.5 px-2 text-right font-mono">อัตรา/หน่วย</th>
                      <th className="py-2.5 px-3 text-right font-mono">รวมเงิน (บาท)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-950/60">
                    {project.expenseItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#0E2042]">
                        <td className="py-2.5 px-3 text-slate-300">
                          {item.name}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-400 font-mono">
                          {item.quantity ? `${item.quantity} ${item.unitName || ''}` : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-400 font-mono">
                          {item.ratePerUnit ? `฿${item.ratePerUnit.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-white">
                          ฿{item.totalAmount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#0A1630] font-semibold border-t border-cyan-950">
                      <td colSpan={3} className="py-2.5 px-3 text-right text-cyan-200">
                        รวมงบประมาณโครงการ:
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-cyan-300 font-bold">
                        ฿{project.budgetAllocated.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-[#060D1A] rounded-xl text-center text-xs text-slate-500 border border-cyan-950">
                ไม่มีรายการค่าใช้จ่ายย่อยแยกรายละเอียด
              </div>
            )}
          </div>

          {/* Last Modified Footer */}
          {project.lastModifiedBy && (
            <div className="pt-2 text-[11px] text-slate-500 border-t border-cyan-950 flex items-center justify-between font-mono">
              <span>แก้ไขล่าสุดโดย: {project.lastModifiedBy}</span>
              <span>{project.lastModifiedAt}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
