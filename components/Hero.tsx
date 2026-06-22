"use client";

import { motion } from "framer-motion";
import { ArrowRight, Eye, Crosshair, FileDown } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { Button, Eyebrow } from "./ui";
import { BRAND } from "@/lib/brand";

const ease = [0.22, 1, 0.36, 1] as const;

function Stagger({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

export function Hero({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-7">
      {/* top bar */}
      <Stagger>
        <header className="flex items-center justify-between">
          <Wordmark />
          <div className="hidden items-center gap-2 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-good shadow-[0_0_8px_#5FC98A]" />
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-bone-faint">
              Engine online
            </span>
          </div>
        </header>
      </Stagger>

      {/* main */}
      <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_0.95fr]">
        {/* left — thesis */}
        <div>
          <Stagger delay={0.05}>
            <Eyebrow>Cold email diagnostics</Eyebrow>
          </Stagger>
          <Stagger delay={0.12}>
            <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-bone sm:text-[3.4rem] lg:text-[3.7rem]">
              Read your cold email
              <br />
              the way your{" "}
              <span className="relative whitespace-nowrap text-gold">
                prospect
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  height="10"
                  viewBox="0 0 200 10"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <motion.path
                    d="M2 7C40 3 160 3 198 6"
                    stroke="#3D7BFF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.9, delay: 0.8, ease }}
                  />
                </svg>
              </span>{" "}
              will.
            </h1>
          </Stagger>
          <Stagger delay={0.2}>
            <p className="mt-7 max-w-md text-[1.02rem] leading-relaxed text-bone-dim">
              Coldscore drops your email in front of your exact ICP and shows
              you what they see in the first three seconds, where they lose
              interest, and whether they&apos;d ever reply, then rewrites it
              sharper. Score a single email, a follow-up sequence, or A/B/C
              variations.
            </p>
          </Stagger>
          <Stagger delay={0.28}>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Button onClick={onStart}>
                Score an email
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Button>
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone-faint">
                ~20 seconds · no signup
              </span>
            </div>
          </Stagger>
          <Stagger delay={0.36}>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3">
              {[
                { icon: Eye, label: "ICP point-of-view" },
                { icon: Crosshair, label: "Sequences & variations" },
                { icon: FileDown, label: "Downloadable report" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-gold" />
                  <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone-dim">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </Stagger>
        </div>

        {/* right — specimen */}
        <Stagger delay={0.3}>
          <Specimen />
        </Stagger>
      </div>

      {/* footer credit */}
      <Stagger delay={0.45}>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-bone/10 py-5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone-faint">
          <span>{BRAND.signoff}</span>
          <a
            href={BRAND.bookACall}
            target="_blank"
            rel="noopener noreferrer"
            className="focusable rounded-full text-bone-dim transition-colors hover:text-brand"
          >
            Book a demo →
          </a>
        </footer>
      </Stagger>
    </div>
  );
}

function Specimen() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* corner ticks */}
      <Corner className="-left-2 -top-2 border-l border-t" />
      <Corner className="-right-2 -top-2 border-r border-t" />
      <Corner className="-bottom-2 -left-2 border-b border-l" />
      <Corner className="-bottom-2 -right-2 border-b border-r" />

      <div className="panel relative overflow-hidden p-6 shadow-panel">
        {/* scan beam */}
        <div
          className="pointer-events-none absolute inset-x-0 z-20 h-24"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(61,123,255,0.16) 60%, rgba(61,123,255,0.5))",
            borderBottom: "1.5px solid rgba(61,123,255,0.8)",
            animation: "sweep 4.2s ease-in-out infinite",
          }}
        />
        {/* header line */}
        <div className="mb-4 flex items-center justify-between border-b border-bone/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-bone/20" />
            <span className="font-mono text-[0.66rem] text-bone-faint">
              specimen.eml
            </span>
          </div>
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gold">
            analysing
          </span>
        </div>

        <div className="space-y-1.5 font-mono text-[0.72rem] text-bone-faint">
          <p>
            <span className="text-bone-dim">from</span> rep@vendor.io
          </p>
          <p>
            <span className="text-bone-dim">subj</span>{" "}
            <span className="text-bone">Quick question about Acme</span>
          </p>
        </div>

        <div className="mt-4 space-y-3 text-[0.86rem] leading-relaxed text-bone-dim">
          <p>
            <Mark sev="weak">Hi {"{first_name}"},</Mark> I hope this email
            finds you well.
          </p>
          <p>
            I&apos;m reaching out because we help companies{" "}
            <Mark sev="crit">10x their revenue</Mark> with our{" "}
            <Mark sev="weak">revolutionary AI-powered platform</Mark>.
          </p>
          <p>
            Would you be open to a quick 15-minute call sometime this week to
            explore synergies?
          </p>
        </div>

        {/* mini verdict chip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          className="mt-5 flex items-center justify-between rounded-lg border border-crit/30 bg-crit/10 px-3 py-2"
        >
          <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-crit">
            3 issues flagged
          </span>
          <span className="font-mono text-[0.7rem] text-crit">
            score 31/100
          </span>
        </motion.div>
      </div>
    </div>
  );
}

function Mark({ children, sev }: { children: React.ReactNode; sev: "weak" | "crit" }) {
  const color = sev === "crit" ? "#E04A3C" : "#E66B47";
  return (
    <span
      className="rounded px-0.5"
      style={{
        background: `${color}22`,
        boxShadow: `inset 0 -1.5px 0 ${color}`,
      }}
    >
      {children}
    </span>
  );
}

function Corner({ className }: { className: string }) {
  return (
    <span
      className={`absolute z-30 h-4 w-4 border-gold/50 ${className}`}
      aria-hidden
    />
  );
}
