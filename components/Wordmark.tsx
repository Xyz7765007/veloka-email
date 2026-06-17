"use client";

export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <span className="relative inline-flex">
        <svg
          width={small ? 22 : 26}
          height={small ? 22 : 26}
          viewBox="0 0 32 32"
          fill="none"
        >
          <circle
            cx="16"
            cy="16"
            r="9"
            stroke="#f5c451"
            strokeWidth="2.2"
          />
          <circle cx="16" cy="16" r="2.8" fill="#f5c451" />
          <line x1="16" y1="2.5" x2="16" y2="6.5" stroke="#f5c451" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="16" y1="25.5" x2="16" y2="29.5" stroke="#f5c451" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="2.5" y1="16" x2="6.5" y2="16" stroke="#f5c451" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="25.5" y1="16" x2="29.5" y2="16" stroke="#f5c451" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <div className="leading-none">
        <span
          className={`font-display font-semibold tracking-tight text-bone ${
            small ? "text-base" : "text-lg"
          }`}
        >
          Coldscore
        </span>
        {!small && (
          <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-bone-faint">
            by Side&nbsp;Kick
          </span>
        )}
      </div>
    </div>
  );
}
