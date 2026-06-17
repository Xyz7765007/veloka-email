"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  Eye,
  Clock,
  Reply,
  Check,
  X,
  ShieldAlert,
  Sparkles,
  Download,
  RotateCcw,
  Copy,
  CheckCheck,
  ArrowUpRight,
  Gauge,
  ScanLine,
  Quote,
} from "lucide-react";
import type { Analysis, IntakeData } from "@/lib/types";
import {
  COLORS,
  scoreColor,
  statusColor,
  impactColor,
  bandColor,
  scoreLabel,
} from "@/lib/score";
import {
  AnimatedNumber,
  RadialGauge,
  Bar,
  Eyebrow,
  Tag,
  Button,
} from "@/components/ui";
import { EmailMarkup } from "@/components/EmailMarkup";
import { Wordmark } from "@/components/Wordmark";
import { downloadReport } from "@/lib/pdf";

/* ---------- scroll reveal wrapper ---------- */
function Reveal({
  children,
  delay = 0,
  y = 18,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- section heading ---------- */
function Section({
  index,
  eyebrow,
  title,
  sub,
  icon,
  children,
}: {
  index: string;
  eyebrow: string;
  title: string;
  sub?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14 sm:mt-20">
      <Reveal>
        <div className="flex items-start gap-4">
          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-bone/12 bg-ink-3 text-gold">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] tracking-widest text-bone-faint">
                {index}
              </span>
              <Eyebrow>{eyebrow}</Eyebrow>
            </div>
            <h2 className="mt-1 font-display text-2xl tracking-tight text-bone sm:text-[28px]">
              {title}
            </h2>
            {sub && (
              <p className="mt-1 max-w-2xl text-sm text-bone-dim">{sub}</p>
            )}
          </div>
        </div>
      </Reveal>
      <div className="mt-7">{children}</div>
    </section>
  );
}

/* ---------- copy-to-clipboard helper ---------- */
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className="focusable inline-flex items-center gap-1.5 rounded-full border border-bone/14 bg-ink-2 px-3 py-1.5 text-xs text-bone-dim transition-colors hover:border-gold/40 hover:text-bone"
    >
      {done ? (
        <>
          <CheckCheck size={13} className="text-good" /> Copied
        </>
      ) : (
        <>
          <Copy size={13} /> {label}
        </>
      )}
    </button>
  );
}

export function Report({
  analysis,
  intake,
  onReset,
}: {
  analysis: Analysis;
  intake: IntakeData;
  onReset: () => void;
}) {
  const a = analysis;
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState("");
  const oColor = scoreColor(a.overallScore);

  async function handleDownload() {
    setDownloading(true);
    setDlError("");
    try {
      await downloadReport(a, intake);
    } catch (e) {
      console.error("[pdf] generation failed:", e);
      setDlError("Couldn't generate the PDF. Please try again.");
      setTimeout(() => setDlError(""), 4000);
    } finally {
      setTimeout(() => setDownloading(false), 600);
    }
  }

  return (
    <div className="relative z-10 mx-auto max-w-5xl px-5 pb-28 pt-7 sm:px-8">
      {dlError && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-crit/40 bg-ink-2 px-4 py-2 text-sm text-bone shadow-panel"
          role="alert"
        >
          {dlError}
        </motion.div>
      )}
      {/* top bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="sticky top-0 z-30 -mx-5 mb-2 flex items-center justify-between gap-3 border-b border-bone/8 bg-ink/70 px-5 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8"
      >
        <Wordmark small />
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onReset}>
            <span className="inline-flex items-center gap-1.5">
              <RotateCcw size={14} /> Scan another
            </span>
          </Button>
          <Button onClick={handleDownload} disabled={downloading}>
            <span className="inline-flex items-center gap-1.5">
              <Download size={15} />
              {downloading ? "Preparing…" : "Download report"}
            </span>
          </Button>
        </div>
      </motion.div>

      {/* ===== headline verdict ===== */}
      <section className="mt-7 grid gap-8 sm:mt-10 lg:grid-cols-[auto_1fr] lg:gap-12">
        <Reveal className="flex flex-col items-center lg:items-start">
          <div className="relative grid place-items-center">
            <RadialGauge score={a.overallScore} size={208} stroke={12} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className="font-display text-[58px] leading-none tracking-tight"
                style={{ color: oColor }}
              >
                <AnimatedNumber value={a.overallScore} duration={1500} />
              </div>
              <div className="mt-0.5 font-mono text-[11px] tracking-widest text-bone-faint">
                OUT OF 100
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span
              className="grid h-9 min-w-9 place-items-center rounded-lg px-2 font-display text-lg"
              style={{
                color: oColor,
                background: `${oColor}1A`,
                border: `1px solid ${oColor}40`,
              }}
            >
              {a.grade}
            </span>
            <span className="text-sm text-bone-dim">
              {scoreLabel(a.overallScore)}
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.12} className="flex flex-col justify-center">
          <Eyebrow>The verdict</Eyebrow>
          <h1 className="mt-2 font-display text-3xl leading-[1.1] tracking-tight text-bone sm:text-[40px]">
            {a.headline}
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-bone-dim">
            {a.verdict}
          </p>

          {/* reply likelihood */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div
              className="inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2.5"
              style={{
                borderColor: `${bandColor(a.replyLikelihood.band)}40`,
                background: `${bandColor(a.replyLikelihood.band)}12`,
              }}
            >
              <Reply size={16} style={{ color: bandColor(a.replyLikelihood.band) }} />
              <div className="leading-tight">
                <div className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                  Reply likelihood
                </div>
                <div className="text-sm">
                  <span
                    className="font-semibold"
                    style={{ color: bandColor(a.replyLikelihood.band) }}
                  >
                    {a.replyLikelihood.band}
                  </span>{" "}
                  <span className="font-mono text-bone-dim">
                    {a.replyLikelihood.range}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5"
              style={{
                borderColor: a.icp.wouldReply ? `${COLORS.good}40` : `${COLORS.crit}40`,
                background: a.icp.wouldReply ? `${COLORS.good}12` : `${COLORS.crit}12`,
              }}
            >
              {a.icp.wouldReply ? (
                <Check size={16} className="text-good" />
              ) : (
                <X size={16} className="text-crit" />
              )}
              <span className="text-sm text-bone">
                Prospect would {a.icp.wouldReply ? "" : "not "}reply
              </span>
            </div>
          </div>
          <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-bone-faint">
            {a.replyLikelihood.rationale}
          </p>
        </Reveal>
      </section>

      {/* ===== POV centerpiece ===== */}
      <Section
        index="01"
        eyebrow="The moment of truth"
        title="Through your prospect's eyes"
        sub="Not a rubric — the actual read. This is what happens in the seconds your email is open."
        icon={<Eye size={18} />}
      >
        <Reveal>
          <div className="panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
            {/* persona + timing row */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold">
                  <Eye size={18} />
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                    Reading as
                  </div>
                  <div className="font-display text-lg tracking-tight text-bone">
                    {a.icp.persona}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-bone/12 bg-ink-2 px-3.5 py-2">
                <Clock size={14} className="text-gold" />
                <span className="font-mono text-xs text-bone-dim">
                  decides in
                </span>
                <span className="font-display text-base text-bone">
                  {a.icp.secondsToDecision}
                </span>
              </div>
            </div>

            {/* first reaction — big quote */}
            <div className="relative mt-6 rounded-2xl border border-bone/10 bg-ink-2/60 p-5 sm:p-6">
              <Quote
                size={26}
                className="absolute -top-3 left-5 text-gold/50"
                fill="currentColor"
              />
              <p className="font-display text-xl italic leading-snug text-bone sm:text-2xl">
                {a.icp.firstReaction}
              </p>
              <div className="mt-3 inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                <span className="text-sm text-bone-dim">{a.icp.feeling}</span>
              </div>
            </div>

            {/* read-through narrative */}
            <p className="mt-6 text-[15px] leading-relaxed text-bone-dim">
              {a.icp.readThrough}
            </p>

            {/* lands / drops */}
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-good/20 bg-good/[0.05] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Check size={15} className="text-good" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-good">
                    What lands
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {a.icp.landsWell.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-bone-dim">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-good" />
                      {s}
                    </li>
                  ))}
                  {a.icp.landsWell.length === 0 && (
                    <li className="text-sm text-bone-faint">
                      Nothing landed cleanly.
                    </li>
                  )}
                </ul>
              </div>
              <div className="rounded-2xl border border-crit/20 bg-crit/[0.05] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <X size={15} className="text-crit" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-crit">
                    Where they drop off
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {a.icp.dropsOff.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-bone-dim">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-crit" />
                      {s}
                    </li>
                  ))}
                  {a.icp.dropsOff.length === 0 && (
                    <li className="text-sm text-bone-faint">
                      No major drop-off points.
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* would reply reasoning */}
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-bone/10 bg-ink-2/40 p-4">
              <Reply
                size={16}
                className={`mt-0.5 shrink-0 ${a.icp.wouldReply ? "text-good" : "text-crit"}`}
              />
              <p className="text-sm leading-relaxed text-bone-dim">
                {a.icp.replyReasoning}
              </p>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ===== annotated specimen ===== */}
      <Section
        index="02"
        eyebrow="Line by line"
        title="Your email, marked up"
        sub="Every flag is anchored to the exact words your prospect reads. Hover a highlight to jump to the note."
        icon={<ScanLine size={18} />}
      >
        <Reveal>
          <EmailMarkup subject={intake.subject} body={intake.body} notes={a.lineNotes} />
        </Reveal>
      </Section>

      {/* ===== dimensions ===== */}
      <Section
        index="03"
        eyebrow="The breakdown"
        title="Scored on what matters"
        icon={<Gauge size={18} />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {a.dimensions.map((d, i) => {
            const c = statusColor(d.status);
            return (
              <Reveal key={d.key} delay={i * 0.05}>
                <div className="panel h-full rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[15px] font-medium text-bone">
                      {d.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-display text-lg"
                        style={{ color: c }}
                      >
                        <AnimatedNumber value={d.score} />
                      </span>
                      <Tag color={c} subtle>
                        {d.status}
                      </Tag>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Bar value={d.score} color={c} delay={i * 0.05 + 0.1} />
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-bone-dim">
                    {d.summary}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
        {a.dimensions.length === 0 && (
          <p className="text-sm text-bone-faint">
            No dimension scores were returned for this email.
          </p>
        )}
      </Section>

      {/* ===== angles ===== */}
      <Section
        index="04"
        eyebrow="Different desks, different reads"
        title="How each persona sees it"
        sub="The same email, judged through the lenses that actually decide its fate."
        icon={<Eye size={18} />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {a.angles.map((ang, i) => (
            <Reveal key={i} delay={i * 0.07}>
              <div className="panel relative h-full overflow-hidden rounded-2xl p-5">
                <div className="absolute right-4 top-4 font-display text-4xl text-bone/[0.06]">
                  0{i + 1}
                </div>
                <div className="mb-3 inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                  <span className="font-display text-base tracking-tight text-bone">
                    {ang.lens}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-bone-dim">
                  {ang.read}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
        {a.angles.length === 0 && (
          <p className="text-sm text-bone-faint">
            No persona-level reads were returned.
          </p>
        )}
      </Section>

      {/* ===== deliverability ===== */}
      <Section
        index="05"
        eyebrow="Will it even arrive"
        title="Deliverability check"
        icon={<ShieldAlert size={18} />}
      >
        <Reveal>
          <div className="panel rounded-2xl p-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="relative grid place-items-center">
                <RadialGauge score={a.deliverability.score} size={132} stroke={9} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="font-display text-2xl"
                    style={{ color: scoreColor(a.deliverability.score) }}
                  >
                    <AnimatedNumber value={a.deliverability.score} />
                  </span>
                  <span className="font-mono text-[9px] tracking-widest text-bone-faint">
                    SAFE
                  </span>
                </div>
              </div>
              <div className="min-w-[220px] flex-1">
                <p className="text-sm leading-relaxed text-bone-dim">
                  {a.deliverability.note}
                </p>
                {a.deliverability.triggers.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                      Spam-filter triggers
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.deliverability.triggers.map((t, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-full border border-weak/30 bg-weak/10 px-3 py-1 text-xs text-bone"
                        >
                          <ShieldAlert size={12} className="text-weak" />
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* ===== priority fixes ===== */}
      <Section
        index="06"
        eyebrow="If you change three things"
        title="Priority fixes"
        sub="Ranked by what moves the reply rate most."
        icon={<ArrowUpRight size={18} />}
      >
        <div className="space-y-3">
          {a.priorityFixes.map((f, i) => {
            const c = impactColor(f.impact);
            return (
              <Reveal key={f.rank} delay={i * 0.05}>
                <div className="panel flex items-start gap-4 rounded-2xl p-5">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-lg"
                    style={{
                      color: c,
                      background: `${c}14`,
                      border: `1px solid ${c}35`,
                    }}
                  >
                    {f.rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-medium text-bone">
                        {f.fix}
                      </span>
                      <Tag color={c} subtle>
                        {f.impact} impact
                      </Tag>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-bone-dim">
                      {f.why}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
        {a.priorityFixes.length === 0 && (
          <p className="text-sm text-bone-faint">
            No priority fixes were returned.
          </p>
        )}
      </Section>

      {/* ===== strengths ===== */}
      {a.strengths.length > 0 && (
        <Section
          index="07"
          eyebrow="Keep these"
          title="What's already working"
          icon={<Check size={18} />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {a.strengths.map((s, i) => (
              <Reveal key={i} delay={i * 0.04}>
                <div className="flex items-start gap-3 rounded-2xl border border-good/18 bg-good/[0.05] p-4">
                  <Check size={16} className="mt-0.5 shrink-0 text-good" />
                  <span className="text-sm leading-relaxed text-bone-dim">
                    {s}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* ===== rewrite ===== */}
      <Section
        index="08"
        eyebrow="Our take"
        title="A version we'd send"
        sub="Not a template — a rewrite built from your offer, aimed at this exact prospect."
        icon={<Sparkles size={18} />}
      >
        <Reveal>
          <div className="panel overflow-hidden rounded-3xl">
            {/* subject options */}
            <div className="border-b border-bone/8 p-6">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                Subject lines to test
              </div>
              <div className="space-y-2.5">
                {a.rewrite.subjectOptions.map((s, i) => (
                  <div
                    key={i}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-bone/10 bg-ink-2/60 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-gold">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm text-bone">{s}</span>
                    </div>
                    <CopyButton text={s} />
                  </div>
                ))}
              </div>
            </div>

            {/* body */}
            <div className="relative p-6">
              <div
                className="absolute left-0 top-6 h-[calc(100%-3rem)] w-0.5 rounded-full"
                style={{ background: COLORS.gold }}
              />
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                  Rewritten body
                </span>
                <CopyButton text={a.rewrite.body} label="Copy email" />
              </div>
              <div className="whitespace-pre-wrap pl-4 font-mono text-[13.5px] leading-relaxed text-bone">
                {a.rewrite.body}
              </div>
            </div>

            {/* rationale */}
            <div className="border-t border-bone/8 bg-ink-2/40 p-5">
              <div className="flex items-start gap-3">
                <Sparkles size={15} className="mt-0.5 shrink-0 text-gold" />
                <p className="text-[13px] leading-relaxed text-bone-dim">
                  <span className="text-bone">Why this works — </span>
                  {a.rewrite.rationale}
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* footer CTA */}
      <Reveal>
        <div className="mt-16 flex flex-col items-center gap-5 rounded-3xl border border-bone/10 bg-gradient-to-b from-ink-2/60 to-transparent p-8 text-center">
          <div className="font-display text-xl tracking-tight text-bone">
            Want the full report on file?
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={handleDownload} disabled={downloading}>
              <span className="inline-flex items-center gap-1.5">
                <Download size={15} />
                {downloading ? "Preparing…" : "Download PDF report"}
              </span>
            </Button>
            <Button variant="ghost" onClick={onReset}>
              <span className="inline-flex items-center gap-1.5">
                <RotateCcw size={14} /> Score another email
              </span>
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-bone-faint">
            <span>Scored by</span>
            <Wordmark small />
          </div>
        </div>
      </Reveal>
    </div>
  );
}
