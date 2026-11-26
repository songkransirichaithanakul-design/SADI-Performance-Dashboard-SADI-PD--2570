import React, { useEffect, useMemo, useState } from 'react';
import {
  FileCheck2,
  Save,
  Send,
  Loader2,
  ArrowRight,
  BarChart3,
  AlertTriangle,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import type { Project } from '../types';
import { ImportParseResult, statusToTh } from '../utils/spreadsheet';
import {
  detectSystemDuplicates,
  getDuplicateReasonLabel,
} from '../utils/duplicateDetection';

interface ImportPreviewConfirmPanelProps {
  projects: Project[];
  currentUserName: string;
  importPreview: ImportParseResult | null;
  importError: string | null;
  importSuccessMessage: string | null;
  defaultRemoveMissing?: boolean;
  onClearError: () => void;
  onCancelPreview: () => void;
  onConfirmImport: (
    mergedProjects: Project[],
    summaryNote: string,
    meta: {
      fileName: string;
      updatedCount: number;
      newCount: number;
      affectedIds: string[];
    },
    navigateToDisplayImmediately: boolean
  ) => Promise<void>;
  onGoToDashboard?: () => void;
  onGoToCatalogPage?: () => void;
}

export const ImportPreviewConfirmPanel: React.FC<ImportPreviewConfirmPanelProps> = ({
  projects,
  currentUserName,
  importPreview,
  importError,
  importSuccessMessage,
  defaultRemoveMissing = false,
  onClearError,
  onCancelPreview,
  onConfirmImport,
  onGoToDashboard,
  onGoToCatalogPage,
}) => {
  const [includeNewProjectsOnImport, setIncludeNewProjectsOnImport] = useState<boolean>(true);
  const [removeMissingProjects, setRemoveMissingProjects] = useState<boolean>(defaultRemoveMissing);
  const [confirmAllowDuplicates, setConfirmAllowDuplicates] = useState<boolean>(false);
  const [isSubmittingImport, setIsSubmittingImport] = useState<boolean>(false);

  // Reset defaults whenever a fresh preview arrives
  useEffect(() => {
    setRemoveMissingProjects(defaultRemoveMissing);
    setConfirmAllowDuplicates(false);
  }, [importPreview, defaultRemoveMissing]);

  // Identify existing projects in DB that are NO LONGER present in the imported sheet/file
  const removedProjects = useMemo(() => {
    if (!importPreview) return [] as Project[];
    const matchedIds = new Set(
      importPreview.rows
        .map((row) => row.matchedProject?.id)
        .filter((id): id is string => Boolean(id))
    );
    return projects.filter((p) => !matchedIds.has(p.id));
  }, [importPreview, projects]);

  const projectedMergedProjects = useMemo(() => {
    if (!importPreview) return [] as Project[];
    const existingMap = new Map(projects.map((p) => [p.id, p]));
    const newAdditions: Project[] = [];

    if (removeMissingProjects) {
      removedProjects.forEach((p) => existingMap.delete(p.id));
    }

    importPreview.rows.forEach((row) => {
      if (row.isNew) {
        if (includeNewProjectsOnImport) {
          newAdditions.push(row.updatedProject);
        }
      } else if (row.matchedProject) {
        existingMap.set(row.matchedProject.id, row.updatedProject);
      }
    });

    return [...newAdditions, ...Array.from(existingMap.values())];
  }, [importPreview, projects, includeNewProjectsOnImport, removeMissingProjects, removedProjects]);

  // Automatic cross-code duplicate & budget overlap detection on projected post-import dataset
  const projectedDuplicates = useMemo(() => {
    if (!importPreview || projectedMergedProjects.length < 2) return [];
    return detectSystemDuplicates(projectedMergedProjects);
  }, [importPreview, projectedMergedProjects]);

  const duplicateProjectIds = useMemo(() => {
    const set = new Set<string>();
    projectedDuplicates.forEach((pair) => {
      set.add(pair.projectA.id);
      set.add(pair.projectB.id);
    });
    return set;
  }, [projectedDuplicates]);

  const hasHighRiskImportDuplicates = projectedDuplicates.some((d) => d.severity === 'high');
  const isBlockedByImportDuplicateGuard = hasHighRiskImportDuplicates && !confirmAllowDuplicates;

  useEffect(() => {
    setConfirmAllowDuplicates(false);
  }, [includeNewProjectsOnImport, removeMissingProjects]);

  const importProjectedSummary = useMemo(() => {
    if (!importPreview) return null;
    const merged = projectedMergedProjects;
    const currentActual = projects.reduce((s, p) => s + p.budgetActual, 0);
    const totalAllocated = merged.reduce((s, p) => s + p.budgetAllocated, 0);
    const totalActual = merged.reduce((s, p) => s + p.budgetActual, 0);
    const disbursementRate = totalAllocated > 0 ? (totalActual / totalAllocated) * 100 : 0;

    return {
      totalProjects: merged.length,
      totalAllocated,
      totalActual,
      deltaActual: totalActual - currentActual,
      disbursementRate,
      effectiveNewCount: includeNewProjectsOnImport ? importPreview.newCount : 0,
      effectiveRemovedCount: removeMissingProjects ? removedProjects.length : 0,
    };
  }, [importPreview, projectedMergedProjects, projects, includeNewProjectsOnImport, removeMissingProjects, removedProjects]);

  const handleConfirm = async (navigateToDisplayImmediately: boolean) => {
    if (!importPreview || isSubmittingImport || isBlockedByImportDuplicateGuard) return;
    setIsSubmittingImport(true);
    try {
      const existingMap = new Map(projects.map((p) => [p.id, p]));
      const newAdditions: Project[] = [];
      const affectedIds: string[] = [];

      if (removeMissingProjects) {
        removedProjects.forEach((p) => existingMap.delete(p.id));
      }

      importPreview.rows.forEach((row) => {
        if (row.isNew) {
          if (includeNewProjectsOnImport) {
            newAdditions.push(row.updatedProject);
            affectedIds.push(row.updatedProject.id);
          }
        } else if (row.matchedProject) {
          existingMap.set(row.matchedProject.id, row.updatedProject);
          if (row.hasChanges) {
            affectedIds.push(row.matchedProject.id);
          }
        }
      });

      const mergedProjects = [...newAdditions, ...Array.from(existingMap.values())];
      const effectiveNewCount = includeNewProjectsOnImport ? importPreview.newCount : 0;
      const effectiveRemovedCount = removeMissingProjects ? removedProjects.length : 0;
      const isGoogleSheetSource = importPreview.fileName.startsWith('Google Sheet');
      const parts = [
        `อัปเดต ${importPreview.updatesCount} โครงการ`,
        ...(effectiveNewCount > 0 ? [`เพิ่มใหม่ ${effectiveNewCount} โครงการ`] : []),
        ...(effectiveRemovedCount > 0 ? [`ลบรายการที่ไม่มีในชีตออก ${effectiveRemovedCount} โครงการ`] : []),
      ];
      const summaryNote = `${isGoogleSheetSource ? 'ซิงก์ข้อมูลจาก' : 'นำเข้าจากไฟล์'} "${importPreview.fileName}" (${parts.join(', ')})`;

      await onConfirmImport(
        mergedProjects,
        summaryNote,
        {
          fileName: importPreview.fileName,
          updatedCount: importPreview.updatesCount,
          newCount: effectiveNewCount,
          affectedIds:
            affectedIds.length > 0 ? affectedIds : importPreview.rows.map((r) => r.updatedProject.id),
        },
        navigateToDisplayImmediately
      );
    } finally {
      setIsSubmittingImport(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Error Alert */}
      {importError && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{importError}</span>
          </div>
          <button
            type="button"
            onClick={onClearError}
            className="text-rose-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Success Alert */}
      {importSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-700 text-emerald-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{importSuccessMessage}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onGoToDashboard && (
              <button
                type="button"
                onClick={onGoToDashboard}
                className="px-3 py-1.5 rounded-lg bg-[#0A1730] border border-cyan-700 text-cyan-200 hover:text-white font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                <span>ดูกราฟ Dashboard</span>
              </button>
            )}
            {onGoToCatalogPage && (
              <button
                type="button"
                onClick={onGoToCatalogPage}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
              >
                <span>เปิดดูหน้าข้อมูลโครงการ</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Preview & Confirm Panel */}
      {importPreview && importProjectedSummary && (
        <div className="p-4 sm:p-5 rounded-xl bg-[#060D1A] border-2 border-cyan-500/70 shadow-[0_0_30px_rgba(6,182,212,0.12)] space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-cyan-950 pb-4">
            <div>
              <div className="font-bold text-sm sm:text-base text-white flex items-center gap-2 flex-wrap">
                <FileCheck2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>พร้อมส่งข้อมูลจาก: {importPreview.fileName}</span>
                <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                  ชีต: {importPreview.sheetName}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1 font-mono tabular-nums">
                ตรวจสอบโครงสร้างผ่านแล้ว · อ่านได้ {importPreview.totalRows} แถว · อัปเดตโครงการเดิม{' '}
                {importPreview.updatesCount} รายการ (มีการเปลี่ยนแปลง {importPreview.changedUpdatesCount}) ·
                โครงการใหม่ {importPreview.newCount} รายการ
                {removedProjects.length > 0 && (
                  <span className="text-rose-300 font-semibold">
                    {' '}
                    · ไม่พบในชีตล่าสุด {removedProjects.length} รายการ
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {importPreview.newCount > 0 && (
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#091224] border border-cyan-900/60 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNewProjectsOnImport}
                    onChange={(e) => setIncludeNewProjectsOnImport(e.target.checked)}
                    className="accent-cyan-400"
                  />
                  <span>รวมโครงการใหม่ ({importPreview.newCount} รายการ)</span>
                </label>
              )}

              {removedProjects.length > 0 && (
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-950/35 border border-rose-700/60 text-xs text-rose-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeMissingProjects}
                    onChange={(e) => setRemoveMissingProjects(e.target.checked)}
                    className="accent-rose-400"
                  />
                  <span>
                    ลบข้อมูลที่ถูกลบออกจากชีต ({removedProjects.length} รายการ) เพื่อให้ระบบเป็นปัจจุบัน
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Highlight Banner when stale/deleted projects will be removed */}
          {removedProjects.length > 0 && removeMissingProjects && (
            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-700/60 text-rose-200 text-xs flex items-start gap-2.5">
              <Trash2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-100">
                  ระบบจะลบข้อมูลที่ไม่ปรากฏในชีตล่าสุดออก {removedProjects.length} รายการ (รวมงบเบิกจ่ายเดิม ฿
                  {removedProjects.reduce((s, p) => s + p.budgetActual, 0).toLocaleString()})
                </div>
                <div className="text-[11px] text-rose-200/85 mt-0.5">
                  รายการที่จะลบออก:{' '}
                  {removedProjects.map((p) => `${p.code} (${p.name})`).join(', ')}
                </div>
              </div>
            </div>
          )}

          {/* Projected Post-Import KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
            <div className="p-3 rounded-xl bg-[#091224] border border-cyan-950">
              <span className="text-[11px] text-slate-400 font-sans block">โครงการรวมหลังนำเข้า</span>
              <span className="text-sm font-bold text-white">
                {importProjectedSummary.totalProjects} โครงการ
                {importProjectedSummary.effectiveNewCount > 0 && (
                  <span className="text-emerald-400 ml-1">
                    (+{importProjectedSummary.effectiveNewCount})
                  </span>
                )}
                {importProjectedSummary.effectiveRemovedCount > 0 && (
                  <span className="text-rose-400 ml-1">
                    (-{importProjectedSummary.effectiveRemovedCount})
                  </span>
                )}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#091224] border border-cyan-950">
              <span className="text-[11px] text-slate-400 font-sans block">งบจัดสรรรวม</span>
              <span className="text-sm font-bold text-white">
                ฿{importProjectedSummary.totalAllocated.toLocaleString()}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#091224] border border-cyan-950">
              <span className="text-[11px] text-slate-400 font-sans block">เบิกจ่ายจริงรวมหลังนำเข้า</span>
              <span className="text-sm font-bold text-cyan-300">
                ฿{importProjectedSummary.totalActual.toLocaleString()}
              </span>
              {importProjectedSummary.deltaActual !== 0 && (
                <span
                  className={`block text-[10px] ${
                    importProjectedSummary.deltaActual > 0 ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {importProjectedSummary.deltaActual > 0 ? '+' : ''}฿
                  {importProjectedSummary.deltaActual.toLocaleString()}
                </span>
              )}
            </div>
            <div className="p-3 rounded-xl bg-[#091224] border border-cyan-950">
              <span className="text-[11px] text-slate-400 font-sans block">อัตราเบิกจ่ายใหม่</span>
              <span className="text-sm font-bold text-emerald-400">
                {importProjectedSummary.disbursementRate.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Automatic Duplicate & Budget Overlap Warning Panel */}
          {projectedDuplicates.length > 0 && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/70 text-amber-100 space-y-3 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-amber-200">
                    ระบบตรวจจับข้อมูลซ้ำซ้อนอัตโนมัติ: พบรายการโครงการหรืองบประมาณที่อาจซ้ำซ้อน {projectedDuplicates.length} คู่ (แม้รหัสโครงการต่างกัน)
                  </div>
                  <p className="text-[11px] text-amber-100/85">
                    กรุณาตรวจสอบรายชื่อโครงการด้านล่างก่อนกดยืนยัน เพื่อป้องกันไม่ให้ยอดงบประมาณถูกนับรวมซ้ำซ้อนบนหน้า Dashboard
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {projectedDuplicates.map((pair) => (
                  <div
                    key={pair.id}
                    className="p-2.5 rounded-lg bg-[#060D1A]/90 border border-amber-800/50 flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5 font-semibold text-white">
                        <span className="font-mono text-cyan-300 px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800">
                          {pair.projectA.code}
                        </span>
                        <span className="truncate max-w-[240px]">{pair.projectA.name}</span>
                        <span className="text-amber-400 font-bold">↔</span>
                        <span className="font-mono text-amber-300 px-1.5 py-0.2 rounded bg-amber-950 border border-amber-700">
                          {pair.projectB.code}
                        </span>
                        <span className="truncate max-w-[240px]">{pair.projectB.name}</span>
                      </div>
                      <div className="text-amber-300">
                        {getDuplicateReasonLabel(pair.reason)} — {pair.explanation}
                      </div>
                    </div>
                    <div className="font-mono tabular-nums text-right shrink-0 text-amber-200">
                      {pair.overlapBudgetActual > 0 ? (
                        <div className="text-rose-300 font-bold">
                          เบิกจ่ายซ้อนเสี่ยง: ฿{pair.overlapBudgetActual.toLocaleString()}
                        </div>
                      ) : (
                        <div>งบจัดสรรทับซ้อน: ฿{pair.overlapBudgetAllocated.toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {hasHighRiskImportDuplicates && (
                <label className="flex items-start gap-2.5 pt-2 border-t border-amber-800/40 cursor-pointer text-[11px] text-amber-100">
                  <input
                    type="checkbox"
                    checked={confirmAllowDuplicates}
                    onChange={(e) => setConfirmAllowDuplicates(e.target.checked)}
                    className="mt-0.5 accent-amber-400 cursor-pointer"
                  />
                  <span className="font-semibold">
                    ตรวจสอบรายการข้างต้นแล้ว ยืนยันนำเข้าข้อมูลชุดนี้เข้าสู่ระบบ (หรือกดยกเลิกเพื่อไปแก้ไขในไฟล์/Google Sheet ก่อน)
                  </span>
                </label>
              )}
            </div>
          )}

          {/* Warnings if any */}
          {importPreview.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-200 text-[11px] space-y-1">
              <div className="font-semibold">
                หมายเหตุการอ่านข้อมูล ({importPreview.warnings.length} รายการ):
              </div>
              <ul className="list-disc list-inside text-amber-300/90 space-y-0.5">
                {importPreview.warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Row-by-Row Verification Table */}
          <div className="max-h-64 overflow-y-auto prominent-scrollbar rounded-lg border border-cyan-950">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#091224] text-cyan-300 sticky top-0">
                <tr>
                  <th className="py-2 px-2.5 font-mono">แถว</th>
                  <th className="py-2 px-2.5 font-mono">รหัส</th>
                  <th className="py-2 px-2.5">ชื่อโครงการ</th>
                  <th className="py-2 px-2.5">สถานะใหม่</th>
                  <th className="py-2 px-2.5">รายละเอียดการเปลี่ยนแปลง</th>
                  <th className="py-2 px-2.5 text-right font-mono">รุ่น / คนจริง</th>
                  <th className="py-2 px-2.5 text-right font-mono">ใช้จ่ายจริงใหม่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-950/60">
                {/* Removed Projects shown first when removal is active */}
                {removeMissingProjects &&
                  removedProjects.map((p) => (
                    <tr key={`removed-${p.id}`} className="bg-rose-950/30">
                      <td className="py-2 px-2.5 font-mono text-rose-400">-</td>
                      <td className="py-2 px-2.5 font-mono text-rose-300 line-through whitespace-nowrap">
                        {p.code}
                      </td>
                      <td className="py-2 px-2.5 text-rose-200 line-through max-w-xs truncate">
                        {p.name}
                      </td>
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        <span className="text-[11px] font-bold text-rose-400">ลบออก</span>
                      </td>
                      <td className="py-2 px-2.5 text-[11px] text-rose-300 font-semibold">
                        - ลบข้อมูลเก่า (ไม่มีในชีตล่าสุดแล้ว)
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-rose-300/80 line-through tabular-nums whitespace-nowrap">
                        {p.batchesActual} รุ่น / {p.participantsActual.toLocaleString()} คน
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-rose-300 line-through tabular-nums whitespace-nowrap">
                        ฿{p.budgetActual.toLocaleString()}
                      </td>
                    </tr>
                  ))}

                {importPreview.rows.map((r) => {
                  const isFlaggedDup = duplicateProjectIds.has(r.updatedProject.id);
                  return (
                    <tr
                      key={r.rowNumber}
                      className={
                        isFlaggedDup
                          ? 'bg-amber-950/30'
                          : r.isNew
                          ? 'bg-emerald-950/20'
                          : r.hasChanges
                          ? 'bg-cyan-950/20'
                          : ''
                      }
                    >
                      <td className="py-2 px-2.5 font-mono text-slate-500">{r.rowNumber}</td>
                      <td className="py-2 px-2.5 font-mono text-cyan-300 whitespace-nowrap">
                        {r.code}
                        {isFlaggedDup && (
                          <span className="ml-1.5 text-[9px] font-sans font-bold px-1.5 py-0.2 rounded bg-amber-500/25 border border-amber-500/60 text-amber-200">
                            พบซ้ำซ้อน
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-white max-w-xs truncate">{r.name}</td>
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        <span
                          className={`text-[11px] font-semibold ${
                            r.updatedProject.status === 'completed'
                              ? 'text-emerald-400'
                              : r.updatedProject.status === 'in_progress'
                              ? 'text-cyan-300'
                              : 'text-amber-300'
                          }`}
                        >
                          {statusToTh(r.updatedProject.status)}
                        </span>
                      </td>
                      <td className="py-2 px-2.5 text-[11px]">
                        {r.isNew ? (
                          <span className="text-emerald-400 font-semibold">+ โครงการใหม่</span>
                        ) : r.changedSummary.length > 0 ? (
                          <span className="text-cyan-300">{r.changedSummary.join(' · ')}</span>
                        ) : (
                          <span className="text-slate-500">ข้อมูลเหมือนเดิม</span>
                        )}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-300 tabular-nums whitespace-nowrap">
                        {r.updatedProject.batchesActual} รุ่น /{' '}
                        {r.updatedProject.participantsActual.toLocaleString()} คน
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-white font-semibold tabular-nums whitespace-nowrap">
                        ฿{r.updatedProject.budgetActual.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action Bar: Confirm Send & Display Immediately */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-cyan-950">
            <div className="text-[11px] text-slate-400">
              {isBlockedByImportDuplicateGuard ? (
                <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  พบข้อมูลอาจซ้ำซ้อน กรุณาตรวจสอบและติ๊กยืนยันด้านบนก่อนกดส่งข้อมูล
                </span>
              ) : (
                <>
                  ผู้ส่งข้อมูล: <span className="text-cyan-300 font-semibold">{currentUserName}</span> ·
                  บันทึกลงฐานข้อมูลพร้อมสำรองอัตโนมัติ
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                disabled={isSubmittingImport}
                onClick={onCancelPreview}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isSubmittingImport || isBlockedByImportDuplicateGuard}
                onClick={() => void handleConfirm(false)}
                className="px-4 py-2 rounded-xl border border-cyan-700/70 bg-[#0A1730] hover:bg-[#0E2248] text-cyan-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5 text-cyan-400" />
                <span>ยืนยันบันทึกและอยู่หน้านี้ต่อ</span>
              </button>
              <button
                type="button"
                disabled={isSubmittingImport || isBlockedByImportDuplicateGuard}
                onClick={() => void handleConfirm(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {isSubmittingImport ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {isSubmittingImport ? 'กำลังบันทึกและอัปเดต...' : 'ยืนยันส่งและแสดงผลข้อมูลทันที'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
