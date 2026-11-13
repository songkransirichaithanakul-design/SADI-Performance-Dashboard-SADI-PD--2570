import React from 'react';

interface SadiLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const SadiLogo: React.FC<SadiLogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
}) => {
  const badgeSizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const titleSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Clean authoritative text seal badge - NO cartoonish or unconvincing SVG illustration */}
      <div className={`font-mono font-bold tracking-widest rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-100 ${badgeSizes[size]}`}>
        SADI
      </div>

      {showSubtitle && (
        <div className="flex flex-col text-left leading-tight">
          <span className={`font-bold tracking-tight text-zinc-100 ${titleSizes[size]}`}>
            สถาบันพัฒนาการตรวจเงินแผ่นดิน
          </span>
          <span className="text-[10px] sm:text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
            STATE AUDIT DEVELOPMENT INSTITUTE
          </span>
        </div>
      )}
    </div>
  );
};
