import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  lightText?: boolean;
  hideText?: boolean;
}

export const TiklaYonetLogo: React.FC<LogoProps> = ({
  size = 'md',
  lightText = false,
  hideText = false,
}) => {
  const iconSizes = {
    sm: 'w-7 h-6',
    md: 'w-10 h-8',
    lg: 'w-14 h-11',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Exact Monitor Icon with Gradient and Mouse Pointer Cursor */}
      <svg
        className={`${iconSizes[size]} shrink-0`}
        viewBox="0 0 64 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="screenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="35%" stopColor="#8B5CF6" />
            <stop offset="70%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
          <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0.5" dy="1" stdDeviation="0.8" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Monitor Frame */}
        <rect
          x="2"
          y="2"
          width="60"
          height="38"
          rx="5"
          fill="#0F172A"
          stroke="#1E293B"
          strokeWidth="2.5"
        />

        {/* Gradient Screen */}
        <rect
          x="5"
          y="5"
          width="54"
          height="32"
          rx="3"
          fill="url(#screenGrad)"
        />

        {/* Monitor Base / Stand */}
        <path
          d="M26 40 L38 40 L44 48 L20 48 Z"
          fill="#1E293B"
          stroke="#0F172A"
          strokeWidth="1.5"
        />
        <rect
          x="18"
          y="47"
          width="28"
          height="2.5"
          rx="1.2"
          fill="#334155"
        />

        {/* Mouse Arrow Cursor on Screen */}
        <path
          d="M34 16 L34 30 L38.5 26 L43 33 L45 32 L40.5 25 L46 25 Z"
          fill="white"
          stroke="#0F172A"
          strokeWidth="1.5"
          strokeLinejoin="round"
          filter="url(#shadow)"
        />
      </svg>

      {/* Brand Text: Tıkla (Dark/Light) + Yönet (Orange) */}
      {!hideText && (
        <div className={`font-black tracking-tight leading-none ${textSizes[size]}`}>
          <span className={lightText ? 'text-white' : 'text-slate-900'}>Tıkla</span>
          <span className="text-orange-500">Yönet</span>
        </div>
      )}
    </div>
  );
};
