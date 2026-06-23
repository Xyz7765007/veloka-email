"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RotateCcw, RefreshCw, Lock, ArrowUpRight } from "lucide-react";
import type { Analysis, IntakeData } from "@/lib/types";
import { Background } from "@/components/Background";
import { Hero } from "@/components/Hero";
import { Wizard } from "@/components/Wizard";
import { Scanning } from "@/components/Scanning";
import { Report } from "@/components/Report";
import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui";
import { sanitizeAnalysis } from "@/lib/sanitize";
import { BRAND } from "@/lib/brand";

type Phase = "hero" | "intake" | "scanning" | "report" | "error" | "exhausted";
type ApiResult =
  | { ok: true; analysis: Analysis; remaining: number | null }
  | { ok: false; error: string; exhausted?: boolean };

const phaseVariants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function Coldscore({
  isAdmin,
  clientSlug,
  clientName,
  initialRemaining,
}: {
  isAdmin: boolean;
  clientSlug?: string;
  clientName?: string;
  initialRemaining?: number;
}) {
  const capped = !isAdmin;
  const startRemaining = capped ? Math.max(0, initialRemaining ?? 0) : Infinity;

  const [remaining, setRemaining] = useState<number>(startRemaining);
  const [phase, setPhase] = useState<Phase>(
    capped && startRemaining <= 0 ? "exhausted" : "hero"
  );
  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string>("");

  const [minDone, setMinDone] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const reqId = useRef(0);

  const maxEmails = capped ? Math.max(1, Math.min(3, remaining)) : 3;

  const runScan = useCallback(
    async (data: IntakeData) => {
      const id = ++reqId.current;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 100_000);
      try {
        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, clientSlug }),
          signal: controller.signal,
        });
        const json = await res.json().catch(() => ({}));
        if (id !== reqId.current) return;
        if (!res.ok) {
          const isQuota = res.status === 403 && Boolean(json?.quota);
          setResult({
            ok: false,
            error:
              json?.error ||
              "The scan couldn't complete. Please try again in a moment.",
            exhausted: isQuota,
          });
          if (json?.quota && typeof json.quota.remaining === "number") {
            setRemaining(json.quota.remaining);
          }
        } else if (json?.analysis) {
          setResult({
            ok: true,
            analysis: json.analysis as Analysis,
            remaining: typeof json.remaining === "number" ? json.remaining : null,
          });
        } else {
          setResult({
            ok: false,
            error: "The scan returned an unexpected response. Please try again.",
          });
        }
      } catch (err) {
        if (id !== reqId.current) return;
        const aborted = err instanceof DOMException && err.name === "AbortError";
        setResult({
          ok: false,
          error: aborted
            ? "The scan took too long and timed out. Please try again."
            : "Couldn't reach the scoring service. Check your connection and try again.",
        });
      } finally {
        clearTimeout(timer);
      }
    },
    [clientSlug]
  );

  const startScan = useCallback(
    (data: IntakeData) => {
      setIntake(data);
      setResult(null);
      setMinDone(false);
      setError("");
      setPhase("scanning");
      runScan(data);
    },
    [runScan]
  );

  // resolve the dual-gate (min animation + API both done)
  useEffect(() => {
    if (phase !== "scanning" || !minDone || !result) return;
    if (result.ok) {
      setAnalysis(sanitizeAnalysis(result.analysis));
      if (capped && result.remaining !== null) setRemaining(result.remaining);
      setPhase("report");
      window.scrollTo({ top: 0, behavior: "auto" });
    } else if (result.exhausted) {
      setPhase("exhausted");
      window.scrollTo({ top: 0, behavior: "auto" });
    } else {
      setError(result.error);
      setPhase("error");
    }
  }, [phase, minDone, result, capped]);

  const reset = useCallback(() => {
    reqId.current++;
    setIntake(null);
    setAnalysis(null);
    setResult(null);
    setMinDone(false);
    setError("");
    setPhase(capped && remaining <= 0 ? "exhausted" : "hero");
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [capped, remaining]);

  const retry = useCallback(() => {
    if (!intake) return reset();
    setResult(null);
    setMinDone(false);
    setError("");
    setPhase("scanning");
    runScan(intake);
  }, [intake, runScan, reset]);

  return (
    <main className="relative min-h-screen">
      <Background />

      {capped && phase !== "exhausted" && (
        <QuotaPill remaining={remaining} />
      )}

      <AnimatePresence mode="wait">
        {phase === "hero" && (
          <motion.div key="hero" variants={phaseVariants} initial="initial" animate="enter" exit="exit" transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <Hero onStart={() => setPhase("intake")} />
          </motion.div>
        )}

        {phase === "intake" && (
          <motion.div key="intake" variants={phaseVariants} initial="initial" animate="enter" exit="exit" transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <Wizard onComplete={startScan} onBack={() => setPhase("hero")} maxEmails={maxEmails} />
          </motion.div>
        )}

        {phase === "scanning" && intake && (
          <motion.div key="scanning" variants={phaseVariants} initial="initial" animate="enter" exit="exit" transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <Scanning data={intake} onMinComplete={() => setMinDone(true)} />
          </motion.div>
        )}

        {phase === "report" && analysis && intake && (
          <motion.div key="report" variants={phaseVariants} initial="initial" animate="enter" exit="exit" transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <Report analysis={analysis} intake={intake} onReset={reset} />
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div key="error" variants={phaseVariants} initial="initial" animate="enter" exit="exit" transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <ErrorScreen message={error} onRetry={retry} onReset={reset} />
          </motion.div>
        )}

        {phase === "exhausted" && (
          <motion.div key="exhausted" variants={phaseVariants} initial="initial" animate="enter" exit="exit" transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
            <ExhaustedScreen clientName={clientName} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function QuotaPill({ remaining }: { remaining: number }) {
  return (
    <div className="fixed bottom-5 right-5 z-40">
      <div className="flex items-center gap-2 rounded-full border border-bone/12 bg-ink-2 px-3.5 py-2 shadow-panel">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-brand/12 font-mono text-[0.62rem] font-bold text-brand">
          {remaining}
        </span>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-bone-dim">
          {remaining === 1 ? "email left" : "emails left"}
        </span>
      </div>
    </div>
  );
}

function ExhaustedScreen({ clientName }: { clientName?: string }) {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-7">
      <header className="flex items-center justify-between">
        <Wordmark small />
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-bone-faint">
          quota reached
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="grid h-16 w-16 place-items-center rounded-2xl border border-brand/30 bg-brand/10 text-brand"
        >
          <Lock size={26} />
        </motion.div>
        <h1 className="mt-6 font-display text-2xl tracking-tight text-bone">
          You&rsquo;ve used all your scores
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-bone-dim">
          {clientName ? `${clientName}, this` : "This"} link has scored its full
          allowance of emails. To score more, or to see the full rewrites and how{" "}
          {BRAND.company} would build outbound that scores like this, let&rsquo;s talk.
        </p>
        <a
          href={BRAND.bookACall}
          target="_blank"
          rel="noopener noreferrer"
          className="focusable mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-mono text-[0.78rem] uppercase tracking-[0.16em] text-white transition-transform hover:scale-[1.02]"
        >
          Book a call <ArrowUpRight size={16} />
        </a>
      </div>
    </div>
  );
}

function ErrorScreen({
  message,
  onRetry,
  onReset,
}: {
  message: string;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-7">
      <header className="flex items-center justify-between">
        <button onClick={onReset} className="focusable rounded-full">
          <Wordmark small />
        </button>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-crit">
          scan failed
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="grid h-16 w-16 place-items-center rounded-2xl border border-crit/30 bg-crit/10 text-crit"
        >
          <AlertTriangle size={28} />
        </motion.div>
        <h1 className="mt-6 font-display text-2xl tracking-tight text-bone">
          The scan hit a snag
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-bone-dim">
          {message}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={onRetry}>
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw size={15} /> Try the scan again
            </span>
          </Button>
          <Button variant="ghost" onClick={onReset}>
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw size={14} /> Start over
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
