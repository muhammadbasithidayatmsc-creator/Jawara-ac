import React from 'react';

interface JawaraLogoProps {
  variant?: 'light' | 'dark';
  showTagline?: boolean;
  compact?: boolean;
}

export const JawaraLogo: React.FC<JawaraLogoProps> = ({
  variant = 'dark',
  showTagline = false,
  compact = false,
}) => {
  const isLight = variant === 'light';
  return (
    <div className="flex items-center gap-3 select-none">
      <div
        className={`flex items-center justify-center rounded-xl shrink-0 ${
          compact ? 'w-9 h-9' : 'w-10 h-10'
        } ${
          isLight
            ? 'bg-blue-500/20 border border-blue-400/30'
            : 'bg-blue-600 shadow-sm'
        }`}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          className={compact ? 'w-5 h-5' : 'w-6 h-6'}
          aria-hidden="true"
        >
          <rect
            x="4"
            y="7"
            width="24"
            height="11"
            rx="2.5"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
          <path
            d="M8 14.5H24"
            stroke="#93C5FD"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M10 22C10 24 8.5 25.5 8.5 25.5M16 21.5C16 24.5 14.5 26 14.5 26M22 22C22 24 20.5 25.5 20.5 25.5"
            stroke="#60A5FA"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <div
          className={`font-bold tracking-tight leading-none whitespace-nowrap ${
            compact ? 'text-base' : 'text-lg'
          } ${isLight ? 'text-white' : 'text-slate-900'}`}
        >
          JAWARA <span className={isLight ? 'text-sky-300' : 'text-blue-600'}>AC</span>
        </div>
        {showTagline && (
          <p
            className={`text-[11px] mt-1 leading-tight truncate ${
              isLight ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            Service AC Lebih Mudah, Bisnis Lebih Maju
          </p>
        )}
      </div>
    </div>
  );
};
