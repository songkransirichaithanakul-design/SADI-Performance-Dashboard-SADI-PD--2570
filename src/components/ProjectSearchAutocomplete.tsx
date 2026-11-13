import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ArrowRight, CheckCircle2, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Project } from '../types';

interface ProjectSearchAutocompleteProps {
  onSelectProject: (project: Project) => void;
  onViewAllMatches?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

const QUICK_SUGGESTED_KEYWORDS = [
  'การเงิน',
  'Data Analytics',
  'AI',
  'การปฏิบัติตามกฎหมาย',
  'ผลสัมฤทธิ์',
  'Online',
  'ผู้บริหาร',
];

export const ProjectSearchAutocomplete: React.FC<ProjectSearchAutocompleteProps> = ({
  onSelectProject,
  onViewAllMatches,
  placeholder = 'พิมพ์คีย์เวิร์ดค้นหาโครงการ, รหัส, กลุ่มเป้าหมาย, ไตรมาส...',
  className = '',
}) => {
  const { projects, searchQuery, setSearchQuery } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Multi-token relevance search across project fields
  const matchingProjects = useMemo(() => {
    const raw = searchQuery.trim().toLowerCase();
    if (!raw) return [];
    const tokens = raw.split(/\s+/).filter(Boolean);

    return projects
      .map((p) => {
        const haystack = [
          p.code,
          p.name,
          p.category,
          p.subCategory || '',
          p.targetGroup,
          p.fundingSourceNameTh,
          p.quarters.join(' '),
          p.executionDateSchedule,
          p.actualDateOrQuarter || '',
          p.objectives || '',
        ]
          .join(' ')
          .toLowerCase();

        const allMatch = tokens.every((t) => haystack.includes(t));
        if (!allMatch) return null;

        // Rank code/title hits higher than description hits
        let score = 0;
        const nameLower = p.name.toLowerCase();
        const codeLower = p.code.toLowerCase();
        if (codeLower.includes(raw)) score += 100;
        if (nameLower.includes(raw)) score += 60;
        tokens.forEach((t) => {
          if (nameLower.includes(t)) score += 20;
          if (codeLower.includes(t)) score += 30;
        });

        return { project: p, score };
      })
      .filter((item): item is { project: Project; score: number } => item !== null)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.project);
  }, [projects, searchQuery]);

  const topSuggestions = useMemo(() => matchingProjects.slice(0, 8), [matchingProjects]);

  const highlightText = (text: string, query: string) => {
    const tokens = query
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (tokens.length === 0) return text;
    const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, idx) =>
      tokens.some((t) => new RegExp(`^${t}$`, 'i').test(part)) ? (
        <mark key={idx} className="bg-cyan-500/30 text-cyan-200 rounded px-0.5 font-bold">
          {part}
        </mark>
      ) : (
        <React.Fragment key={idx}>{part}</React.Fragment>
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < topSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : topSuggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && topSuggestions[activeIndex]) {
        e.preventDefault();
        onSelectProject(topSuggestions[activeIndex]);
        setIsOpen(false);
      } else if (onViewAllMatches && searchQuery.trim()) {
        e.preventDefault();
        onViewAllMatches(searchQuery.trim());
        setIsOpen(false);
      }
    }
  };

  const handleSelectSuggestion = (project: Project) => {
    onSelectProject(project);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search className="w-4 h-4 absolute left-3.5 text-cyan-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="ค้นหาโครงการ"
          aria-expanded={isOpen}
          className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-cyan-800/70 bg-[#060D1A] text-white placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            title="ล้างคำค้นหา"
            className="absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Live Autocomplete Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-[#071022] border border-cyan-700/60 shadow-[0_20px_50px_rgba(2,8,20,0.9)] overflow-hidden">
          {searchQuery.trim() === '' ? (
            <div className="p-4 space-y-2.5">
              <div className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>คำค้นหายอดนิยม (คลิกเพื่อค้นหาอัตโนมัติ)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SUGGESTED_KEYWORDS.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => {
                      setSearchQuery(kw);
                      setActiveIndex(-1);
                      inputRef.current?.focus();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#0A1730] hover:bg-cyan-500/20 border border-cyan-900/70 hover:border-cyan-400 text-xs text-cyan-200 transition-colors cursor-pointer"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          ) : matchingProjects.length === 0 ? (
            <div className="p-5 text-center space-y-2">
              <p className="text-xs text-slate-400">
                ไม่พบโครงการที่ตรงกับคีย์เวิร์ด "<span className="text-cyan-300 font-semibold">{searchQuery}</span>"
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
              >
                ล้างคำค้นหาเพื่อแสดงทั้งหมด
              </button>
            </div>
          ) : (
            <div>
              <div className="px-4 py-2 bg-[#050B16] border-b border-cyan-950 flex items-center justify-between text-[11px]">
                <span className="text-cyan-300 font-medium">
                  รายการที่เสนอตามคีย์เวิร์ด ({matchingProjects.length} โครงการ)
                </span>
                <span className="text-slate-500 font-mono">
                  คลิกเพื่อดูรายละเอียด
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-cyan-950/60 prominent-scrollbar">
                {topSuggestions.map((project, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(project)}
                      className={`w-full text-left px-4 py-3 transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                        isActive ? 'bg-[#0E2248]' : 'hover:bg-[#0A1730]'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-mono font-bold text-cyan-300">
                            {highlightText(project.code, searchQuery)}
                          </span>
                          <span className="text-slate-500" aria-hidden="true">·</span>
                          <span className="text-slate-400">
                            {project.fundingSource === 'budget_annual' ? 'งบประมาณแผ่นดิน' : 'เงินกองทุน สตง.'}
                          </span>
                          <span className="text-slate-500" aria-hidden="true">·</span>
                          <span className="font-mono text-cyan-400">{project.quarters.join(', ')}</span>
                        </div>
                        <div className="text-xs font-semibold text-white leading-snug line-clamp-2">
                          {highlightText(project.name, searchQuery)}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          กลุ่มเป้าหมาย: {highlightText(project.targetGroup, searchQuery)}
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-1 font-mono tabular-nums">
                        <div className="text-xs font-bold text-emerald-400">
                          ฿{project.budgetAllocated.toLocaleString()}
                        </div>
                        <div className="text-[10px] inline-flex items-center gap-1 justify-end">
                          {project.status === 'completed' ? (
                            <span className="text-emerald-400 inline-flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> เสร็จแล้ว
                            </span>
                          ) : project.status === 'in_progress' ? (
                            <span className="text-cyan-300 inline-flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> กำลังทำ
                            </span>
                          ) : (
                            <span className="text-amber-300 inline-flex items-center gap-0.5">
                              <AlertCircle className="w-3 h-3" /> ยังไม่เริ่ม
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {onViewAllMatches && (
                <div className="p-2.5 bg-[#050B16] border-t border-cyan-950">
                  <button
                    type="button"
                    onClick={() => {
                      onViewAllMatches(searchQuery.trim());
                      setIsOpen(false);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-700/60 text-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span>แสดงผลทั้งหมดที่ตรงกับ "{searchQuery}" ({matchingProjects.length} โครงการ)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
