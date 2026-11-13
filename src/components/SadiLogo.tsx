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

  const imgHeights = {
    sm: 'h-6',
    md: 'h-7',
    lg: 'h-9',
  };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className={`rounded-xl bg-white/95 border border-cyan-400/30 shadow-sm inline-flex items-center justify-center ${badgeSizes[size]}`}>
        <img
          src="/assets/aistudio/Asset_8_300x_0_30a573ad.png"
          alt="สถาบันพัฒนาการตรวจเงินแผ่นดิน (SADI)"
          className={`${imgHeights[size]} w-auto object-contain select-none`}
        />
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
