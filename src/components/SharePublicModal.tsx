import React, { useState, useMemo } from 'react';
import { X, Share2, Copy, Check, Globe, Filter, ExternalLink } from 'lucide-react';
import { FundingSource, ProjectStatus, Quarter } from '../types';

interface SharePublicModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'dashboard' | 'projects';
  currentQuarter?: Quarter | 'all';
  currentFunding?: FundingSource | 'all';
  currentStatus?: ProjectStatus | 'all';
  onPreviewPublicLink?: (config: {
    tab: 'dashboard' | 'projects';
    quarter: Quarter | 'all';
    funding: FundingSource | 'all';
    status: ProjectStatus | 'all';
  }) => void;
}

export const SharePublicModal: React.FC<SharePublicModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'dashboard',
  currentQuarter = 'all',
  currentFunding = 'all',
  currentStatus = 'all',
  onPreviewPublicLink,
}) => {
  const [targetTab, setTargetTab] = useState<'dashboard' | 'projects'>(defaultTab);
  const [quarter, setQuarter] = useState<Quarter | 'all'>(currentQuarter);
  const [funding, setFunding] = useState<FundingSource | 'all'>(currentFunding);
  const [status, setStatus] = useState<ProjectStatus | 'all'>(currentStatus);
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams();
    params.set('view', 'public');
    params.set('tab', targetTab);
    if (quarter !== 'all') params.set('quarter', quarter);
    if (funding !== 'all') params.set('funding', funding);
    if (status !== 'all') params.set('status', status);
    return `${origin}/?${params.toString()}`;
  }, [targetTab, quarter, funding, status]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md text-slate-100">
      <div className="bg-[#091224] border border-cyan-900/60 rounded-2xl w-full max-w-xl shadow-[0_0_50px_rgba(6,182,212,0.18)] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-950 flex items-center justify-between bg-[#060D1A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">
                สร้างลิงก์เผยแพร่สาธารณะ (Public Share Link)
              </h3>
              <p className="text-[11px] text-slate-400">
                ลิงก์สาธารณะแสดงข้อมูลรายงานผลสำหรับผู้บริหารและบุคคลทั่วไป โดยไม่เปิดเผยส่วนผู้ดูแลระบบ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Destination Page */}
          <div className="space-y-2">
            <label className="font-semibold text-cyan-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>เลือกหน้าที่ต้องการเปิดเมื่อเข้าชมลิงก์</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTargetTab('dashboard')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  targetTab === 'dashboard'
                    ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                    : 'bg-[#060D1A] border-cyan-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold">หน้าภาพรวม Dashboard</div>
                <div className="text-[11px] text-slate-400 mt-0.5">สรุปงบประมาณและกราฟทั้ง 4 ไตรมาส</div>
              </button>
              <button
                type="button"
                onClick={() => setTargetTab('projects')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  targetTab === 'projects'
                    ? 'bg-cyan-500/20 border-cyan-400 text-white font-semibold'
                    : 'bg-[#060D1A] border-cyan-950 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold">หน้าข้อมูลโครงการทั้งหมด</div>
                <div className="text-[11px] text-slate-400 mt-0.5">เปิดดูรายการโครงการตามตัวกรองทันที</div>
              </button>
            </div>
          </div>

          {/* Filter Presets */}
          <div className="p-4 rounded-xl bg-[#060D1A] border border-cyan-950 space-y-3">
            <div className="font-semibold text-cyan-200 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              <span>กำหนดตัวกรองล่วงหน้าในลิงก์ (ไม่บังคับ)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">ไตรมาส</label>
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(e.target.value as Quarter | 'all')}
                  className="w-full px-2.5 py-2 rounded-lg border border-cyan-900/60 bg-[#091326] text-white font-mono cursor-pointer"
                >
                  <option value="all">ทุกไตรมาส (39)</option>
                  <option value="Q1">Q1 (15 โครงการ)</option>
                  <option value="Q2">Q2 (15 โครงการ)</option>
                  <option value="Q3">Q3 (19 โครงการ)</option>
                  <option value="Q4">Q4 (17 โครงการ)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">แหล่งงบประมาณ</label>
                <select
                  value={funding}
                  onChange={(e) => setFunding(e.target.value as FundingSource | 'all')}
                  className="w-full px-2.5 py-2 rounded-lg border border-cyan-900/60 bg-[#091326] text-white cursor-pointer"
                >
                  <option value="all">ทั้งหมด (39)</option>
                  <option value="budget_annual">งบประมาณแผ่นดิน (13)</option>
                  <option value="budget_fund">เงินกองทุน สตง. (26)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">สถานะโครงการ</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectStatus | 'all')}
                  className="w-full px-2.5 py-2 rounded-lg border border-cyan-900/60 bg-[#091326] text-white cursor-pointer"
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="in_progress">อยู่ระหว่างดำเนินการ</option>
                  <option value="not_started">ยังไม่ได้ดำเนินการ</option>
                  <option value="completed">ดำเนินการเสร็จแล้ว</option>
                </select>
              </div>
            </div>
          </div>

          {/* Generated URL Display + Copy */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-300 block">
              ลิงก์สาธารณะพร้อมเผยแพร่ (Public URL):
            </label>
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 px-3 py-2.5 rounded-xl border border-cyan-800/70 bg-[#050B16] text-cyan-300 font-mono text-[11px] focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer ${
                  copied
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}</span>
              </button>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 border-t border-cyan-950">
            <span className="text-[11px] text-slate-400">
              ผู้รับลิงก์สามารถดูกราฟและรายละเอียดโครงการได้ทันที
            </span>
            {onPreviewPublicLink && (
              <button
                type="button"
                onClick={() => {
                  onPreviewPublicLink({ tab: targetTab, quarter, funding, status });
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg border border-cyan-800/60 bg-[#0A1730] hover:bg-[#0E2248] text-cyan-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                <span>ทดสอบมุมมองลิงก์นี้</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
