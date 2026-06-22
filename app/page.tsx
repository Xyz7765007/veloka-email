"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RotateCcw, RefreshCw } from "lucide-react";
import type { Analysis, IntakeData } from "@/lib/types";
import { Background } from "@/components/Background";
import { Hero } from "@/components/Hero";
import { Wizard } from "@/components/Wizard";
import { Scanning } from "@/components/Scanning";
import { Report } from "@/components/Report";
import { Wordmark } from "@/components/Wordmark";
import { Button } from "@/components/ui";
import { sanitizeAnalysis } from "@/lib/sanitize";

type Phase = "hero" | "intake" | "scanning" | "report" | "error";
type ApiResult =
  | { ok: true; analysis: Analysis }
  | { ok: false; error: string };

const phaseVariants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function Page() {
  const [phase, setPhase] = useState<Phase>("hero");
  const [intake, setIntake] = useState<IntakeData | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string>("");

  // dual-gate: the report only shows once BOTH the minimum scan animation
  // has elapsed AND the API has returned.
  const [minDone, setMinDone] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const reqId = useRef(0);

  const runScan = useCallback(async (data: IntakeData) => {
    const id = ++reqId.current;
    // Deterministic client-side ceiling so a hung request fails cleanly rather
    // than spinning forever (sits above the server's 60s maxDuration).
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 100_000);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (id !== reqId.current) return; // stale
      if (!res.ok) {
        setResult({
          ok: false,
          error:
            json?.error ||
            "The scan couldn't complete. Please try again in a moment.",
        });
      } else if (json?.analysis) {
        setResult({ ok: true, analysis: json.analysis as Analysis });
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
  }, []);

  const startScan = useCallback(
    (data: IntakeData) => {
      setIntake(data);
      setResult(null);
      setMinDone(false);
      setError("");
      setPhase("scanning");
      runScan(data);
    },
    [runScan],
  );

  // resolve the gate
  useEffect(() => {
    if (phase !== "scanning" || !minDone || !result) return;
    if (result.ok) {
      setAnalysis(sanitizeAnalysis(result.analysis));
      setPhase("report");
      window.scrollTo({ top: 0, behavior: "auto" });
    } else {
      setError(result.error);
      setPhase("error");
    }
  }, [phase, minDone, result]);

  const reset = useCallback(() => {
    reqId.current++;
    setPhase("hero");
    setIntake(null);
    setAnalysis(null);
    setResult(null);
    setMinDone(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

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
      <AnimatePresence mode="wait">
        {phase === "hero" && (
          <motion.div
            key="hero"
            variants={phaseVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Hero onStart={() => setPhase("intake")} />
          </motion.div>
        )}

        {phase === "intake" && (
          <motion.div
            key="intake"
            variants={phaseVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Wizard onComplete={startScan} onBack={() => setPhase("hero")} />
          </motion.div>
        )}

        {phase === "scanning" && intake && (
          <motion.div
            key="scanning"
            variants={phaseVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Scanning data={intake} onMinComplete={() => setMinDone(true)} />
          </motion.div>
        )}

        {phase === "report" && analysis && intake && (
          <motion.div
            key="report"
            variants={phaseVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <Report analysis={analysis} intake={intake} onReset={reset} />
          </motion.div>
        )}

        {phase === "error" && (
          <motion.div
            key="error"
            variants={phaseVariants}
            initial="initial"
            animate="enter"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <ErrorScreen message={error} onRetry={retry} onReset={reset} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
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
        <p className="mt-8 max-w-sm font-mono text-[11px] leading-relaxed text-bone-faint">
          Your inputs are kept. &ldquo;Try again&rdquo; re-runs the same email,
          no re-typing needed.
        </p>
      </div>
    </div>
  );
}
