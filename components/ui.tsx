"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { scoreColor } from "@/lib/score";

/* ---------- Animated count-up number ---------- */
export function AnimatedNumber({
  value,
  duration = 1200,
  delay = 0,
  decimals = 0,
}: {
  value: number;
  duration?: number;
  delay?: number;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    let start: number | null = null;
    const startVal = 0;
    const timeout = setTimeout(() => {
      const tick = (t: number) => {
        if (start === null) start = t;
        const p = Math.min((t - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(startVal + (value - startVal) * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
        else setDisplay(value);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [inView, value, duration, delay]);

  return (
    <span ref={ref}>
      {decimals > 0 ? display.toFixed(decimals) : Math.round(display)}
    </span>
  );
}

/* ---------- Radial score gauge ---------- */
export function RadialGauge({
  score,
  size = 220,
  stroke = 12,
  delay = 0.2,
}: {
  score: number;
  size?: number;
  stroke?: number;
  delay?: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  const offset = c - (Math.min(score, 100) / 100) * c;

  return (
    <svg ref={ref} width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(20,20,24,0.09)"
        strokeWidth={stroke}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={inView ? { strokeDashoffset: offset } : { strokeDashoffset: c }}
        transition={{ duration: 1.4, delay, ease: [0.22, 1, 0.36, 1] }}
        style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
      />
    </svg>
  );
}

/* ---------- Linear bar ---------- */
export function Bar({
  value,
  color,
  delay = 0,
  height = 8,
}: {
  value: number;
  color: string;
  delay?: number;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  return (
    <div
      ref={ref}
      className="w-full overflow-hidden rounded-full bg-bone/[0.07]"
      style={{ height }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={inView ? { width: `${Math.min(value, 100)}%` } : { width: 0 }}
        transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/* ---------- Eyebrow ---------- */
export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`eyebrow ${className}`}>{children}</div>;
}

/* ---------- Tag / chip ---------- */
export function Tag({
  children,
  color,
  subtle = false,
}: {
  children: React.ReactNode;
  color: string;
  subtle?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.64rem] uppercase tracking-[0.14em]"
      style={{
        color,
        background: subtle ? "transparent" : `${color}1A`,
        border: `1px solid ${color}40`,
      }}
    >
      {children}
    </span>
  );
}

/* ---------- Button ---------- */
export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "group relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-mono text-[0.78rem] uppercase tracking-[0.16em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 focusable";
  const styles =
    variant === "primary"
      ? "bg-gold text-ink hover:bg-gold-soft hover:shadow-glow active:scale-[0.98]"
      : "bg-transparent text-bone-dim border border-bone/15 hover:text-bone hover:border-bone/35 active:scale-[0.98]";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

/* ---------- Form field ---------- */
export function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  textarea = false,
  rows = 4,
  required = false,
  optional = false,
  mono = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  rows?: number;
  required?: boolean;
  optional?: boolean;
  mono?: boolean;
}) {
  const shared =
    "focusable w-full rounded-xl border border-bone/12 bg-ink-2/70 px-4 py-3 text-bone placeholder:text-bone-faint transition-colors duration-200 hover:border-bone/20";
  return (
    <label className="block">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-bone-dim">
          {label}
          {required && <span className="ml-1 text-gold">*</span>}
        </span>
        {optional && (
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-bone-faint">
            optional
          </span>
        )}
      </div>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={`${shared} ${mono ? "font-mono text-[0.86rem] leading-relaxed" : ""}`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={shared}
        />
      )}
      {hint && (
        <p className="mt-1.5 text-[0.78rem] leading-snug text-bone-faint">
          {hint}
        </p>
      )}
    </label>
  );
}
