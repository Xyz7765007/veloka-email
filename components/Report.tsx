"use client";

import { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Eye,
  Clock,
  Reply,
  Check,
  X,
  ShieldAlert,
  Download,
  RotateCcw,
  ArrowUpRight,
  Gauge,
  Trophy,
  Layers,
  Mail,
  GitCompare,
  Lightbulb,
} from "lucide-react";
import type {
  Analysis,
  IntakeData,
  EmailScore,
  CampaignMode,
} from "@/lib/types";
import {
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
import { LockedRewrite } from "@/components/LockedRewrite";
import { Wordmark } from "@/components/Wordmark";
import { downloadReport } from "@/lib/pdf";
import { BRAND } from "@/lib/brand";

const MODE_META: Record<
  CampaignMode,
  { label: string; icon: typeof Mail; insight: string }
> = {
  single: { label: "Standalone emails", icon: Mail, insight: "Portfolio read" },
  sequence: { label: "Follow-up sequence", icon: Layers, insight: "Sequence flow" },
  variations: {
    label: "A/B/C variations",
    icon: GitCompare,
    insight: "Why the winner wins",
  },
};

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

function SectionHead({
  index,
  eyebrow,
  title,
  sub,
  icon,
}: {
  index: string;
  eyebrow: string;
  title: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <Reveal>
      <div className="flex items-start gap-4">
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-bone/12 bg-ink-3 text-brand">
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
          {sub && <p className="mt-1 max-w-2xl text-sm text-bone-dim">{sub}</p>}
        </div>
      </div>
    </Reveal>
  );
}

function EmailDetail({
  email,
  originalBody,
  isWinner,
}: {
  email: EmailScore;
  originalBody: string;
  isWinner: boolean;
}) {
  const c = scoreColor(email.overallScore);
  return (
    <div className="space-y-10">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-bone/10 bg-ink-2/40 p-6">
        <div className="flex items-center gap-5">
          <div className="relative grid h-20 w-20 place-items-center">
            <RadialGauge score={email.overallScore} size={80} stroke={6} />
            <span className="absolute font-display text-xl" style={{ color: c }}>
              <AnimatedNumber value={email.overallScore} />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-bone-faint">
                {email.label}
              </span>
              {isWinner && (
                <span className="inline-flex items-center gap-1 rounded-full border border-good/40 bg-good/10 px-2 py-0.5 text-[10px] font-medium text-good">
                  <Trophy size={10} /> Winner
                </span>
              )}
            </div>
            <div className="mt-0.5 font-display text-2xl tracking-tight text-bone">
              {email.headline}
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-bone-dim">
              <span style={{ color: c }} className="font-medium">
                Grade {email.grade}
              </span>
              <span className="text-bone-faint">·</span>
              <span>{scoreLabel(email.overallScore)}</span>
            </div>
          </div>
        </div>
        <div
          className="inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2.5"
          style={{
            borderColor: `${bandColor(email.replyLikelihood.band)}40`,
            background: `${bandColor(email.replyLikelihood.band)}12`,
          }}
        >
          <Reply size={16} style={{ color: bandColor(email.replyLikelihood.band) }} />
          <div className="leading-tight">
            <div className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
              Reply likelihood
            </div>
            <div className="text-sm">
              <span
                className="font-semibold"
                style={{ color: bandColor(email.replyLikelihood.band) }}
              >
                {email.replyLikelihood.band}
              </span>{" "}
              <span className="font-mono text-bone-dim">
                {email.replyLikelihood.range}
              </span>
            </div>
          </div>
        </div>
      </div>

      {email.verdict && (
        <p className="-mt-4 max-w-3xl text-[15px] leading-relaxed text-bone-dim">
          {email.verdict}
        </p>
      )}

      {/* ICP POV */}
      <div className="panel rounded-3xl p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-brand/30 bg-brand/10 text-brand">
              <Eye size={17} />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                Reading as
              </div>
              <div className="font-display text-base tracking-tight text-bone">
                {email.icp.persona}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-bone/12 bg-ink-2 px-3.5 py-2">
            <Clock size={14} className="text-brand" />
            <span className="font-mono text-xs text-bone-dim">decides in</span>
            <span className="font-display text-sm text-bone">
              {email.icp.secondsToDecision}
            </span>
          </div>
        </div>

        {email.icp.firstReaction && (
          <p className="mt-5 font-display text-lg italic leading-snug text-bone">
            &ldquo;{email.icp.firstReaction}&rdquo;
          </p>
        )}
        {email.icp.feeling && (
          <div className="mt-2 inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            <span className="text-sm text-bone-dim">{email.icp.feeling}</span>
          </div>
        )}
        {email.icp.readThrough && (
          <p className="mt-4 text-[15px] leading-relaxed text-bone-dim">
            {email.icp.readThrough}
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-good/20 bg-good/[0.05] p-4">
            <div className="mb-2 flex items-center gap-2">
              <Check size={14} className="text-good" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-good">
                What lands
              </span>
            </div>
            <ul className="space-y-2">
              {email.icp.landsWell.length === 0 && (
                <li className="text-sm text-bone-faint">Nothing landed cleanly.</li>
              )}
              {email.icp.landsWell.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-bone-dim">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-good" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-crit/20 bg-crit/[0.05] p-4">
            <div className="mb-2 flex items-center gap-2">
              <X size={14} className="text-crit" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-crit">
                Where they drop off
              </span>
            </div>
            <ul className="space-y-2">
              {email.icp.dropsOff.length === 0 && (
                <li className="text-sm text-bone-faint">No major drop-off.</li>
              )}
              {email.icp.dropsOff.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-bone-dim">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-crit" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {email.icp.replyReasoning && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-bone/10 bg-ink-2/40 p-4">
            <Reply
              size={15}
              className={`mt-0.5 shrink-0 ${
                email.icp.wouldReply ? "text-good" : "text-crit"
              }`}
            />
            <p className="text-sm leading-relaxed text-bone-dim">
              <span className="text-bone">
                {email.icp.wouldReply ? "Would reply. " : "Would not reply. "}
              </span>
              {email.icp.replyReasoning}
            </p>
          </div>
        )}
      </div>

      {/* marked-up email */}
      <div>
        <div className="mb-4">
          <Eyebrow>Line by line</Eyebrow>
          <h3 className="mt-1 font-display text-xl tracking-tight text-bone">
            The email, marked up
          </h3>
        </div>
        <EmailMarkup
          subject={email.subject}
          body={originalBody}
          notes={email.lineNotes}
        />
      </div>

      {/* dimensions */}
      {email.dimensions.length > 0 && (
        <div>
          <div className="mb-4">
            <Eyebrow>The breakdown</Eyebrow>
            <h3 className="mt-1 font-display text-xl tracking-tight text-bone">
              Scored on what matters
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {email.dimensions.map((d, i) => {
              const dc = statusColor(d.status);
              return (
                <Reveal key={d.key + i} delay={i * 0.04}>
                  <div className="panel h-full rounded-2xl p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[15px] font-medium text-bone">
                        {d.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className="font-display text-lg"
                          style={{ color: dc }}
                        >
                          <AnimatedNumber value={d.score} />
                        </span>
                        <Tag color={dc} subtle>
                          {d.status}
                        </Tag>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Bar value={d.score} color={dc} delay={i * 0.04 + 0.1} />
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-bone-dim">
                      {d.summary}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      )}

      {/* deliverability + strengths */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="panel rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert size={16} className="text-brand" />
            <Eyebrow>Deliverability</Eyebrow>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative grid h-24 w-24 shrink-0 place-items-center">
              <RadialGauge score={email.deliverability.score} size={96} stroke={7} />
              <span
                className="absolute font-display text-xl"
                style={{ color: scoreColor(email.deliverability.score) }}
              >
                <AnimatedNumber value={email.deliverability.score} />
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-relaxed text-bone-dim">
                {email.deliverability.note}
              </p>
              {email.deliverability.triggers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {email.deliverability.triggers.map((t, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-full border border-weak/30 bg-weak/10 px-2.5 py-1 text-xs text-bone"
                    >
                      <ShieldAlert size={11} className="text-weak" />
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <Check size={16} className="text-good" />
            <Eyebrow>What&rsquo;s working</Eyebrow>
          </div>
          {email.strengths.length === 0 ? (
            <p className="text-sm text-bone-faint">
              Nothing notable to keep. Start from the rewrite.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {email.strengths.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-bone-dim"
                >
                  <Check size={15} className="mt-0.5 shrink-0 text-good" />
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* priority fixes */}
      {email.priorityFixes.length > 0 && (
        <div>
          <div className="mb-4">
            <Eyebrow>If you change a few things</Eyebrow>
            <h3 className="mt-1 font-display text-xl tracking-tight text-bone">
              Priority fixes
            </h3>
          </div>
          <div className="space-y-3">
            {email.priorityFixes
              .slice()
              .sort((a, b) => a.rank - b.rank)
              .map((f, i) => {
                const fc = impactColor(f.impact);
                return (
                  <Reveal key={i} delay={i * 0.04}>
                    <div className="panel flex items-start gap-4 rounded-2xl p-5">
                      <div
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-lg"
                        style={{
                          color: fc,
                          background: `${fc}14`,
                          border: `1px solid ${fc}35`,
                        }}
                      >
                        {f.rank}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-medium text-bone">
                            {f.fix}
                          </span>
                          <Tag color={fc} subtle>
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
        </div>
      )}

      {/* rewrite (gated) */}
      <div>
        <div className="mb-4">
          <Eyebrow>Our take</Eyebrow>
          <h3 className="mt-1 font-display text-xl tracking-tight text-bone">
            A version we&rsquo;d send
          </h3>
        </div>
        <LockedRewrite rewrite={email.rewrite} />
      </div>
    </div>
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
  const { mode, campaign, emails } = analysis;
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState("");
  const [active, setActive] = useState(0);
  const oColor = scoreColor(campaign.overallScore);
  const meta = MODE_META[mode] || MODE_META.single;
  const ModeIcon = meta.icon;
  const multi = emails.length > 1;

  async function handleDownload() {
    setDownloading(true);
    setDlError("");
    try {
      await downloadReport(analysis, intake);
    } catch (e) {
      console.error("[pdf] generation failed:", e);
      setDlError("Couldn't generate the PDF. Please try again.");
      setTimeout(() => setDlError(""), 4000);
    } finally {
      setTimeout(() => setDownloading(false), 600);
    }
  }

  const activeEmail = emails[active] || emails[0];
  const activeBody = intake.emails[active]?.body ?? "";

  return (
    <div className="relative z-10 mx-auto max-w-5xl px-5 pb-28 pt-7 sm:px-8">
      {dlError && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
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

      {/* ===== campaign overview ===== */}
      <section className="mt-7 grid gap-8 sm:mt-10 lg:grid-cols-[auto_1fr] lg:gap-12">
        <Reveal className="flex flex-col items-center lg:items-start">
          <div className="relative grid place-items-center">
            <RadialGauge score={campaign.overallScore} size={208} stroke={12} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className="font-display text-[58px] leading-none tracking-tight"
                style={{ color: oColor }}
              >
                <AnimatedNumber value={campaign.overallScore} duration={1500} />
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
              {campaign.grade}
            </span>
            <span className="text-sm text-bone-dim">
              {scoreLabel(campaign.overallScore)}
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.12} className="flex flex-col justify-center">
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-bone/12 bg-ink-2 px-3 py-1.5">
            <ModeIcon size={13} className="text-brand" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-bone-dim">
              {meta.label} · {emails.length} email{emails.length > 1 ? "s" : ""}
            </span>
          </div>
          <h1 className="font-display text-3xl leading-[1.1] tracking-tight text-bone sm:text-[40px]">
            {campaign.headline}
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-bone-dim">
            {campaign.verdict}
          </p>
          {campaign.summary && (
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-bone-faint">
              {campaign.summary}
            </p>
          )}
          {mode === "variations" && campaign.winnerLabel && (
            <div className="mt-5 inline-flex w-fit items-center gap-2 rounded-2xl border border-good/40 bg-good/10 px-4 py-2.5">
              <Trophy size={16} className="text-good" />
              <span className="text-sm text-bone">
                Winner:{" "}
                <span className="font-semibold text-good">
                  {campaign.winnerLabel}
                </span>
              </span>
            </div>
          )}
        </Reveal>
      </section>

      {/* ===== mode insight + recommendation ===== */}
      {(campaign.modeInsight || campaign.recommendation) && (
        <section className="mt-14 sm:mt-20">
          <SectionHead
            index="01"
            eyebrow={meta.insight}
            title={
              mode === "sequence"
                ? "How the sequence flows"
                : mode === "variations"
                ? "Why the winner wins"
                : "The portfolio read"
            }
            icon={<ModeIcon size={18} />}
          />
          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            {campaign.modeInsight && (
              <Reveal>
                <div className="panel h-full rounded-2xl p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Layers size={15} className="text-brand" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                      {meta.insight}
                    </span>
                  </div>
                  <p className="text-[15px] leading-relaxed text-bone-dim">
                    {campaign.modeInsight}
                  </p>
                </div>
              </Reveal>
            )}
            {campaign.recommendation && (
              <Reveal delay={0.08}>
                <div className="h-full rounded-2xl border border-brand/30 bg-brand/[0.06] p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Lightbulb size={15} className="text-brand" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-brand">
                      Do this first
                    </span>
                  </div>
                  <p className="text-[15px] leading-relaxed text-bone">
                    {campaign.recommendation}
                  </p>
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* ===== cross-cutting angles ===== */}
      {campaign.angles.length > 0 && (
        <section className="mt-14 sm:mt-20">
          <SectionHead
            index="02"
            eyebrow="Different desks, different reads"
            title="How each persona sees it"
            sub="The same submission, judged through the lenses that decide its fate."
            icon={<Eye size={18} />}
          />
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {campaign.angles.map((ang, i) => (
              <Reveal key={i} delay={i * 0.07}>
                <div className="panel relative h-full overflow-hidden rounded-2xl p-5">
                  <div className="absolute right-4 top-4 font-display text-4xl text-bone/[0.06]">
                    0{i + 1}
                  </div>
                  <div className="mb-3 inline-flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" />
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
        </section>
      )}

      {/* ===== per-email detail ===== */}
      <section className="mt-14 sm:mt-20">
        <SectionHead
          index="03"
          eyebrow={multi ? "Email by email" : "The email"}
          title={multi ? "Each email, in detail" : "Full diagnostic"}
          icon={<Gauge size={18} />}
        />

        {multi && (
          <Reveal>
            <div className="mt-6 flex flex-wrap gap-2">
              {emails.map((e, i) => {
                const isActive = active === i;
                const ec = scoreColor(e.overallScore);
                const isWinner =
                  mode === "variations" && campaign.winnerLabel === e.label;
                return (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`focusable flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 transition-all ${
                      isActive
                        ? "border-brand/50 bg-brand/[0.08]"
                        : "border-bone/12 hover:border-bone/30"
                    }`}
                  >
                    <span
                      className="font-display text-sm"
                      style={{ color: isActive ? ec : undefined }}
                    >
                      {e.overallScore}
                    </span>
                    <span
                      className={`text-sm ${
                        isActive ? "text-bone" : "text-bone-dim"
                      }`}
                    >
                      {e.label}
                    </span>
                    {isWinner && <Trophy size={12} className="text-good" />}
                  </button>
                );
              })}
            </div>
          </Reveal>
        )}

        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35 }}
            >
              <EmailDetail
                email={activeEmail}
                originalBody={activeBody}
                isWinner={
                  mode === "variations" &&
                  campaign.winnerLabel === (activeEmail?.label || "")
                }
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* footer CTA */}
      <Reveal>
        <div className="mt-16 flex flex-col items-center gap-5 rounded-3xl border border-bone/10 bg-gradient-to-b from-ink-2/60 to-transparent p-8 text-center">
          <div className="font-display text-xl tracking-tight text-bone">
            Want emails that score like this, on autopilot?
          </div>
          <p className="max-w-md text-sm leading-relaxed text-bone-dim">
            {BRAND.signoff} Side Kick builds the AI SDR system that finds intent,
            writes the email, and books the meeting.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={BRAND.bookACall}
              target="_blank"
              rel="noopener noreferrer"
              className="focusable inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.02]"
            >
              Book a demo
              <ArrowUpRight size={16} />
            </a>
            <Button variant="ghost" onClick={handleDownload} disabled={downloading}>
              <span className="inline-flex items-center gap-1.5">
                <Download size={15} />
                {downloading ? "Preparing…" : "Download report"}
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
