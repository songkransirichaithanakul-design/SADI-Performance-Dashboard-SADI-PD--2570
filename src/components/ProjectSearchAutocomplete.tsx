import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ArrowRight, CheckCircle2, Clock, AlertCircle, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Project } from '../types';

interface ProjectSearchAutocompleteProps {
  onSelectProject: (project: Project) => void;
  onViewAllMatches?: (query: string) => void;
  placeholder?: string;
  className?: string;
  variant?: 'dark' | 'light';
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
  variant = 'dark',
}) => {
  const { projects, searchQuery, setSearchQuery } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLight = variant === 'light';

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
        <mark
          key={idx}
          className={
            isLight
              ? 'bg-blue-100 text-blue-900 rounded px-0.5 font-bold'
              : 'bg-cyan-500/30 text-cyan-200 rounded px-0.5 font-bold'
          }
        >
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
        <Search
          className={`w-4 h-4 absolute left-3.5 pointer-events-none ${
            isLight ? 'text-slate-400' : 'text-cyan-400'
          }`}
        />
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
          className={
            isLight
              ? 'w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white focus:bg-white text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all'
              : 'w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm rounded-xl border border-cyan-800/70 bg-[#060D1A] text-white placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all'
          }
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
            className={
              isLight
                ? 'absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer'
                : 'absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer'
            }
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Live Autocomplete Suggestions Dropdown */}
      {isOpen && (
        <div
          className={
            isLight
              ? 'absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden'
              : 'absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-[#071022] border border-cyan-700/60 shadow-[0_20px_50px_rgba(2,8,20,0.9)] overflow-hidden'
          }
        >
          {searchQuery.trim() === '' ? (
            <div className="p-4 space-y-2.5">
              <div
                className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                  isLight ? 'text-blue-700' : 'text-cyan-300'
                }`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-cyan-400'}`} />
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
                    className={
                      isLight
                        ? 'px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-xs text-slate-700 hover:text-blue-700 transition-colors cursor-pointer'
                        : 'px-2.5 py-1 rounded-lg bg-[#0A1730] hover:bg-cyan-500/20 border border-cyan-900/70 hover:border-cyan-400 text-xs text-cyan-200 transition-colors cursor-pointer'
                    }
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          ) : matchingProjects.length === 0 ? (
            <div className="p-5 text-center space-y-2">
              <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                ไม่พบโครงการที่ตรงกับคีย์เวิร์ด "
                <span className={`font-semibold ${isLight ? 'text-blue-700' : 'text-cyan-300'}`}>
                  {searchQuery}
                </span>
                "
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`text-[11px] hover:underline cursor-pointer ${
                  isLight ? 'text-blue-600' : 'text-cyan-400'
                }`}
              >
                ล้างคำค้นหาเพื่อแสดงทั้งหมด
              </button>
            </div>
          ) : (
            <div>
              <div
                className={`px-4 py-2 border-b flex items-center justify-between text-[11px] ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-[#050B16] border-cyan-950 text-cyan-300'
                }`}
              >
                <span className="font-medium">
                  รายการที่เสนอตามคีย์เวิร์ด ({matchingProjects.length} โครงการ)
                </span>
                <span className={`font-mono ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                  คลิกเพื่อดูรายละเอียด
                </span>
              </div>

              <div
                className={`max-h-80 overflow-y-auto divide-y ${
                  isLight ? 'divide-slate-100' : 'divide-cyan-950/60 prominent-scrollbar'
                }`}
              >
                {topSuggestions.map((project, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(project)}
                      className={`w-full text-left px-4 py-3 transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                        isLight
                          ? isActive
                            ? 'bg-blue-50'
                            : 'hover:bg-slate-50'
                          : isActive
                          ? 'bg-[#0E2248]'
                          : 'hover:bg-[#0A1730]'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span
                            className={`font-mono font-bold ${
                              isLight ? 'text-blue-700' : 'text-cyan-300'
                            }`}
                          >
                            {highlightText(project.code, searchQuery)}
                          </span>
                          <span className="text-slate-400" aria-hidden="true">·</span>
                          <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                            {project.fundingSource === 'budget_annual' ? 'งบประมาณประจำปี' : 'เงินกองทุน สตง.'}
                          </span>
                          <span className="text-slate-400" aria-hidden="true">·</span>
                          <span className={`font-mono ${isLight ? 'text-slate-600' : 'text-cyan-400'}`}>
                            {project.quarters.join(', ')}
                          </span>
                        </div>
                        <div
                          className={`text-xs font-semibold leading-snug line-clamp-2 ${
                            isLight ? 'text-slate-900' : 'text-white'
                          }`}
                        >
                          {highlightText(project.name, searchQuery)}
                        </div>
                        <div className={`text-[11px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          กลุ่มเป้าหมาย: {highlightText(project.targetGroup, searchQuery)}
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-1 font-mono tabular-nums">
                        <div
                          className={`text-xs font-bold ${
                            isLight ? 'text-slate-900' : 'text-emerald-400'
                          }`}
                        >
                          ฿{project.budgetAllocated.toLocaleString()}
                        </div>
                        <div className="text-[10px] inline-flex items-center gap-1 justify-end">
                          {project.status === 'completed' ? (
                            <span
                              className={`inline-flex items-center gap-0.5 font-semibold ${
                                isLight ? 'text-emerald-700' : 'text-emerald-400'
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" /> เสร็จแล้ว
                            </span>
                          ) : project.status === 'in_progress' ? (
                            <span
                              className={`inline-flex items-center gap-0.5 font-semibold ${
                                isLight ? 'text-blue-700' : 'text-cyan-300'
                              }`}
                            >
                              <Clock className="w-3 h-3" /> กำลังทำ
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-0.5 font-semibold ${
                                isLight ? 'text-amber-700' : 'text-amber-300'
                              }`}
                            >
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
                <div
                  className={`p-2.5 border-t ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#050B16] border-cyan-950'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onViewAllMatches(searchQuery.trim());
                      setIsOpen(false);
                    }}
                    className={
                      isLight
                        ? 'w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors'
                        : 'w-full py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-700/60 text-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors'
                    }
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
