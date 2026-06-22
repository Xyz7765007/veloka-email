"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, ScanLine, Plus, X, Mail, Layers, GitCompare } from "lucide-react";
import type { IntakeData, CampaignMode } from "@/lib/types";
import { Wordmark } from "./Wordmark";
import { Button, Field, Eyebrow } from "./ui";

const ease = [0.22, 1, 0.36, 1] as const;

const GOALS = ["Book a meeting", "Get a reply", "Drive a signup", "Build awareness"];
const SIZES = ["1-10", "11-50", "51-200", "201-1k", "1k+"];

const STEPS = [
  { id: 0, label: "Your offer" },
  { id: 1, label: "Your ICP" },
  { id: 2, label: "The emails" },
];

const MODES: {
  id: CampaignMode;
  title: string;
  desc: string;
  icon: typeof Mail;
}[] = [
  { id: "single", title: "Standalone", desc: "1 to 3 separate emails, each scored on its own.", icon: Mail },
  { id: "sequence", title: "Follow-up sequence", desc: "Up to 3 emails to the same prospect. We judge the flow too.", icon: Layers },
  { id: "variations", title: "A/B/C variations", desc: "Up to 3 versions of one email. We pick the winner.", icon: GitCompare },
];

function emailLabel(mode: CampaignMode, i: number) {
  if (mode === "variations") return `Variation ${String.fromCharCode(65 + i)}`;
  if (mode === "sequence") return `Step ${i + 1}`;
  return `Email ${i + 1}`;
}

function Chips({
  options,
  value,
  onChange,
  label,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div>
      <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-bone-dim">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(active ? "" : o)}
              className={`focusable rounded-full border px-3.5 py-1.5 font-mono text-[0.72rem] tracking-[0.04em] transition-all duration-150 ${
                active
                  ? "border-brand/60 bg-brand/15 text-brand"
                  : "border-bone/12 text-bone-dim hover:border-bone/30 hover:text-bone"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Wizard({
  onComplete,
  onBack,
}: {
  onComplete: (data: IntakeData) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [d, setD] = useState<IntakeData>({
    company: "",
    website: "",
    offering: "",
    icpTitle: "",
    icpIndustry: "",
    icpCompanySize: "",
    icpPain: "",
    icpNotes: "",
    goal: "",
    mode: "single",
    emails: [{ subject: "", body: "" }],
  });

  const set = (k: keyof IntakeData) => (v: string) => setD((p) => ({ ...p, [k]: v }));
  const setEmail = (i: number, k: "subject" | "body", v: string) =>
    setD((p) => ({
      ...p,
      emails: p.emails.map((e, idx) => (idx === i ? { ...e, [k]: v } : e)),
    }));
  const addEmail = () =>
    setD((p) => (p.emails.length >= 3 ? p : { ...p, emails: [...p.emails, { subject: "", body: "" }] }));
  const removeEmail = (i: number) =>
    setD((p) => (p.emails.length <= 1 ? p : { ...p, emails: p.emails.filter((_, idx) => idx !== i) }));
  const setMode = (m: CampaignMode) => setD((p) => ({ ...p, mode: m }));

  const canNext =
    step === 0
      ? d.company.trim().length > 0 && d.offering.trim().length > 0
      : step === 1
      ? d.icpTitle.trim().length > 0 || d.icpNotes.trim().length > 0
      : d.emails.some((e) => e.body.trim().length >= 20);

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const handlePrimary = () => {
    if (step < 2) go(step + 1);
    else {
      // keep only emails that have content
      const emails = d.emails.filter((e) => e.body.trim() || e.subject.trim());
      onComplete({ ...d, emails: emails.length ? emails : d.emails.slice(0, 1) });
    }
  };

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-7">
      <header className="flex items-center justify-between">
        <button onClick={onBack} className="focusable rounded-full">
          <Wordmark small />
        </button>
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-bone-faint">
          Intake · {step + 1}/3
        </span>
      </header>

      {/* progress rail */}
      <div className="mt-8 flex gap-2">
        {STEPS.map((s) => (
          <div key={s.id} className="flex-1">
            <div className="h-1 overflow-hidden rounded-full bg-bone/10">
              <motion.div
                className="h-full rounded-full bg-brand"
                initial={false}
                animate={{ width: step > s.id ? "100%" : step === s.id ? "50%" : "0%" }}
                transition={{ duration: 0.5, ease }}
              />
            </div>
            <div
              className={`mt-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] transition-colors ${
                step >= s.id ? "text-bone-dim" : "text-bone-faint"
              }`}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="relative flex-1 overflow-hidden py-10">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.4, ease }}
          >
            {step === 0 && (
              <div className="space-y-6">
                <StepIntro k="01" title="Who's sending this?" sub="A little context sharpens the read. Nothing here is stored." />
                <Field label="Company name" required value={d.company} onChange={set("company")} placeholder="Acme Inc" />
                <Field label="Website" optional value={d.website} onChange={set("website")} placeholder="acme.com" />
                <Field
                  label="What you sell"
                  required
                  textarea
                  rows={3}
                  value={d.offering}
                  onChange={set("offering")}
                  placeholder="What you do and for whom."
                  hint="One or two lines is plenty."
                />
                <Chips label="Campaign goal" options={GOALS} value={d.goal} onChange={set("goal")} />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <StepIntro k="02" title="Who is this email for?" sub="This is the persona Coldscore becomes when it reads your email." />
                <Field label="Target title / persona" required value={d.icpTitle} onChange={set("icpTitle")} placeholder="VP of Sales at a Series B SaaS" />
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Industry / market" optional value={d.icpIndustry} onChange={set("icpIndustry")} placeholder="B2B SaaS" />
                  <div className="self-start">
                    <Chips label="Company size" options={SIZES} value={d.icpCompanySize} onChange={set("icpCompanySize")} />
                  </div>
                </div>
                <Field label="Core pain you solve for them" optional textarea rows={2} value={d.icpPain} onChange={set("icpPain")} placeholder="Reps spend hours on manual prospecting instead of selling." />
                <Field
                  label="Paste a full ICP (if you have one)"
                  optional
                  textarea
                  rows={4}
                  value={d.icpNotes}
                  onChange={set("icpNotes")}
                  placeholder="Drop any ICP doc, persona notes, or qualification criteria here."
                  hint="Either fill the fields above or paste a profile."
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <StepIntro k="03" title="What are we scoring?" sub="Pick how your emails relate, then paste up to three." />

                {/* mode picker */}
                <div className="grid gap-3 sm:grid-cols-3">
                  {MODES.map((m) => {
                    const active = d.mode === m.id;
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMode(m.id)}
                        className={`focusable rounded-2xl border p-4 text-left transition-all duration-150 ${
                          active
                            ? "border-brand/60 bg-brand/[0.08]"
                            : "border-bone/12 hover:border-bone/30"
                        }`}
                      >
                        <Icon size={18} className={active ? "text-brand" : "text-bone-dim"} />
                        <div className={`mt-2 text-[0.95rem] font-medium ${active ? "text-bone" : "text-bone-dim"}`}>
                          {m.title}
                        </div>
                        <div className="mt-1 text-[0.78rem] leading-snug text-bone-faint">{m.desc}</div>
                      </button>
                    );
                  })}
                </div>

                {/* emails */}
                <div className="space-y-4">
                  {d.emails.map((e, i) => (
                    <div key={i} className="rounded-2xl border border-bone/12 bg-ink-2/40 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-brand">
                          {emailLabel(d.mode, i)}
                        </span>
                        {d.emails.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEmail(i)}
                            className="focusable rounded-full p-1 text-bone-faint transition-colors hover:text-crit"
                            aria-label="Remove email"
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-3">
                        <Field
                          label="Subject line"
                          value={e.subject}
                          onChange={(v) => setEmail(i, "subject", v)}
                          placeholder="Quick question about {company}"
                          mono
                        />
                        <Field
                          label="Email body"
                          textarea
                          rows={8}
                          mono
                          value={e.body}
                          onChange={(v) => setEmail(i, "body", v)}
                          placeholder={`Hi {first_name},\n\nI noticed your team is hiring SDRs...\n\nWorth a quick look?\n\nBest, Name`}
                          hint={`${e.body.trim().length} chars · keep your merge tags, we read them too.`}
                        />
                      </div>
                    </div>
                  ))}

                  {d.emails.length < 3 && (
                    <button
                      type="button"
                      onClick={addEmail}
                      className="focusable flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-bone/20 py-3 font-mono text-[0.74rem] uppercase tracking-[0.14em] text-bone-dim transition-colors hover:border-brand/50 hover:text-brand"
                    >
                      <Plus size={15} />
                      Add {d.mode === "variations" ? "a variation" : d.mode === "sequence" ? "a step" : "an email"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between border-t border-bone/10 pt-5">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => go(step - 1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        ) : (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Home
          </Button>
        )}

        <Button onClick={handlePrimary} disabled={!canNext}>
          {step < 2 ? (
            <>
              Continue
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          ) : (
            <>
              Score {d.emails.length > 1 ? `${d.emails.length} emails` : "the email"}
              <ScanLine className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function StepIntro({ k, title, sub }: { k: string; title: string; sub: string }) {
  return (
    <div className="mb-2">
      <Eyebrow>Step {k}</Eyebrow>
      <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-bone sm:text-[1.7rem]">
        {title}
      </h2>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-bone-dim">{sub}</p>
    </div>
  );
}
