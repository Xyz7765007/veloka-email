"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { IntakeData } from "@/lib/types";
import { Wordmark } from "./Wordmark";

const STAGES = [
  "Parsing structure & merge tags",
  "Loading ICP persona",
  "Simulating the 3-second skim",
  "Reading the email line by line",
  "Checking deliverability & spam risk",
  "Scoring across dimensions",
  "Compiling the diagnostic",
];

const STAGE_MS = 760; // per line
const MIN_TOTAL = STAGES.length * STAGE_MS + 500;

export function Scanning({
  data,
  onMinComplete,
}: {
  data: IntakeData;
  onMinComplete: () => void;
}) {
  const [active, setActive] = useState(0);
  const [pct, setPct] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // Cap at the LAST stage (not past it): the final step keeps pulsing as
      // "in progress" until the parent transitions to the report. This way a
      // slow model call reads as "still finalizing", never a frozen 100%.
      setActive((a) => Math.min(a + 1, STAGES.length - 1));
    }, STAGE_MS);

    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / MIN_TOTAL, 1);
      // Hold at 99% until the report actually appears (the real "100%" moment
      // is the report reveal, driven by the parent once the API has returned).
      setPct(Math.min(Math.round(p * 100), 99));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const done = setTimeout(() => {
      if (!firedRef.current) {
        firedRef.current = true;
        onMinComplete();
      }
    }, MIN_TOTAL);

    return () => {
      clearInterval(interval);
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [onMinComplete]);

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-7">
      <header className="flex items-center justify-between">
        <Wordmark small />
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-gold">
          scanning
        </span>
      </header>

      <div className="grid flex-1 items-center gap-10 py-10 md:grid-cols-[1fr_0.85fr]">
        {/* specimen with beam */}
        <div className="panel relative overflow-hidden p-6 shadow-panel">
          <div
            className="pointer-events-none absolute inset-x-0 z-20 h-28"
            style={{
              background:
                "linear-gradient(180deg, transparent, rgba(245,196,81,0.14) 55%, rgba(245,196,81,0.45))",
              borderBottom: "1.5px solid rgba(245,196,81,0.85)",
              animation: "sweep 2.4s ease-in-out infinite",
            }}
          />
          <div className="mb-3 flex items-center justify-between border-b border-bone/10 pb-3 font-mono text-[0.66rem] text-bone-faint">
            <span>{data.company || "specimen"}.eml</span>
            <span className="text-gold">{pct}%</span>
          </div>
          {data.subject && (
            <p className="mb-3 font-mono text-[0.74rem] text-bone">
              <span className="text-bone-faint">subj </span>
              {data.subject}
            </p>
          )}
          <pre className="max-h-[16rem] overflow-hidden whitespace-pre-wrap font-mono text-[0.78rem] leading-relaxed text-bone-dim">
            {data.body.slice(0, 620)}
          </pre>
        </div>

        {/* status stream */}
        <div>
          <div className="mb-5">
            <div className="font-display text-4xl font-semibold tracking-tight text-bone">
              {pct}
              <span className="text-gold">%</span>
            </div>
            <div className="mt-1 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-bone-faint">
              running diagnostic
            </div>
          </div>

          <div className="space-y-3">
            {STAGES.map((s, i) => {
              const isDone = i < active;
              const isCurrent = i === active;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors duration-300 ${
                      isDone
                        ? "border-good bg-good/20"
                        : isCurrent
                        ? "border-gold"
                        : "border-bone/15"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-2.5 w-2.5 text-good" strokeWidth={3} />
                    ) : isCurrent ? (
                      <motion.span
                        className="h-1.5 w-1.5 rounded-full bg-gold"
                        animate={{ opacity: [1, 0.2, 1] }}
                        transition={{ duration: 0.9, repeat: Infinity }}
                      />
                    ) : null}
                  </span>
                  <span
                    className={`font-mono text-[0.78rem] transition-colors duration-300 ${
                      isDone
                        ? "text-bone-dim"
                        : isCurrent
                        ? "text-bone"
                        : "text-bone-faint"
                    }`}
                  >
                    {s}
                    {isCurrent && <span className="caret ml-1 text-gold">▍</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
