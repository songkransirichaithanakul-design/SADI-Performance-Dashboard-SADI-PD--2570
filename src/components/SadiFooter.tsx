import React from 'react';
import { MapPin, Phone, Mail, ExternalLink, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SadiFooter: React.FC = () => {
  const { language } = useApp();

  return (
    <footer className="border-t border-cyan-950/80 bg-[#060D1A]/95 text-slate-300 transition-colors mt-16 backdrop-blur-md shadow-[0_-10px_30px_rgba(4,9,20,0.5)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Left: System credits & Fiscal Year Info */}
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white text-sm leading-snug">
                {language === 'th'
                  ? 'รายงานความก้าวหน้าการดำเนินแผนพัฒนาศักยภาพบุคลากรของสำนักงานการตรวจเงินแผ่นดิน ประจำปีงบประมาณ พ.ศ. 2570'
                  : 'State Audit Office FY 2570 Personnel Development Progress Report'}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {language === 'th'
                ? 'สำนักงานการตรวจเงินแผ่นดิน (สตง.) ร่วมกับ สถาบันพัฒนาการตรวจเงินแผ่นดิน (SADI) รายงานความก้าวหน้าตามงบประมาณรายจ่ายประจำปีงบประมาณ พ.ศ. 2570 และเงินกองทุนเพื่อการพัฒนาการตรวจเงินแผ่นดิน'
                : 'State Audit Office of the Kingdom of Thailand & State Audit Development Institute (SADI) executive financial and operational reporting.'}
            </p>
            <div className="flex items-center gap-4 text-xs text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1.5 text-cyan-300">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                {language === 'th' ? 'ฐานข้อมูลไฟล์เซิร์ฟเวอร์สำรองข้อมูลอัตโนมัติตามมาตรฐาน สตง.' : 'File-Based Integrity Verified System'}
              </span>
              <span>·</span>
              <a
                href="https://www.sao.go.th"
                target="_blank"
                rel="noreferrer"
                className="hover:text-cyan-300 text-slate-300 inline-flex items-center gap-1 transition-colors"
              >
                sao.go.th <ExternalLink className="w-3 h-3 text-cyan-400" />
              </a>
            </div>
          </div>

          {/* Right: Institutional Contact (Arabic numerals) */}
          <div className="flex flex-col items-start md:items-end text-left md:text-right bg-[#070F20] p-4 rounded-xl border border-cyan-900/40 shadow-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono font-black text-xs bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded">
                SADI
              </span>
              <span className="font-bold text-xs text-white tracking-tight">
                สถาบันพัฒนาการตรวจเงินแผ่นดิน
              </span>
            </div>
            <div className="text-[11px] font-medium text-cyan-400/80 tracking-wider uppercase mb-1 font-mono">
              STATE AUDIT DEVELOPMENT INSTITUTE
            </div>

            <div className="text-xs text-slate-300 leading-snug flex items-start md:items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5 md:mt-0" />
              <span>
                อาคาร 1 ชั้น 7 ซอยอารีย์สัมพันธ์ ถนนพระรามที่ 6 แขวงพญาไท เขตพญาไท กรุงเทพมหานคร 10400
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 font-mono">
              <span className="inline-flex items-center gap-1">
                <Phone className="w-3 h-3 text-cyan-400" /> 0-2271-8000
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3 h-3 text-cyan-400" /> sadi@sao.go.th
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-cyan-950/80 mt-6 pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2 font-mono">
          <div>
            © 2570 สถาบันพัฒนาการตรวจเงินแผ่นดิน (SADI) สำนักงานการตรวจเงินแผ่นดิน
          </div>
          <div>
            ประจำปีงบประมาณ 2570
          </div>
        </div>
      </div>
    </footer>
  );
};
