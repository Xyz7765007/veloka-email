"use client";

export function Wordmark({ small = false }: { small?: boolean }) {
  const c = "#FF6F30";
  return (
    <div className="flex items-center gap-2.5 select-none">
      <span className="relative inline-flex">
        <svg width={small ? 22 : 26} height={small ? 22 : 26} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="9" stroke={c} strokeWidth="2.2" />
          <circle cx="16" cy="16" r="2.8" fill={c} />
          <line x1="16" y1="2.5" x2="16" y2="6.5" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="16" y1="25.5" x2="16" y2="29.5" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="2.5" y1="16" x2="6.5" y2="16" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="25.5" y1="16" x2="29.5" y2="16" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <div className="flex items-center gap-2 leading-none">
        <span
          className={`font-display font-semibold tracking-tight text-bone ${
            small ? "text-base" : "text-lg"
          }`}
        >
          Side&nbsp;Kick
        </span>
        <span className="h-3 w-px bg-bone/20" />
        <span
          className={`font-mono uppercase tracking-[0.18em] text-brand ${
            small ? "text-[0.58rem]" : "text-[0.64rem]"
          }`}
        >
          Coldscore
        </span>
      </div>
    </div>
  );
}
