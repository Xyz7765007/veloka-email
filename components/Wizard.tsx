"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, ScanLine } from "lucide-react";
import type { IntakeData } from "@/lib/types";
import { Wordmark } from "./Wordmark";
import { Button, Field, Eyebrow } from "./ui";

const ease = [0.22, 1, 0.36, 1] as const;

const GOALS = ["Book a meeting", "Get a reply", "Drive a signup", "Build awareness"];
const SIZES = ["1–10", "11–50", "51–200", "201–1k", "1k+"];

const STEPS = [
  { id: 0, label: "Your offer" },
  { id: 1, label: "Your ICP" },
  { id: 2, label: "The email" },
];

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
                  ? "border-gold/60 bg-gold/15 text-gold"
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
    subject: "",
    body: "",
  });

  const set = (k: keyof IntakeData) => (v: string) => setD((p) => ({ ...p, [k]: v }));

  const canNext =
    step === 0
      ? d.company.trim().length > 0 && d.offering.trim().length > 0
      : step === 1
      ? d.icpTitle.trim().length > 0 || d.icpNotes.trim().length > 0
      : d.body.trim().length >= 20;

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const handlePrimary = () => {
    if (step < 2) go(step + 1);
    else onComplete(d);
  };

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-7">
      {/* header */}
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
                className="h-full rounded-full bg-gold"
                initial={false}
                animate={{
                  width: step > s.id ? "100%" : step === s.id ? "50%" : "0%",
                }}
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

      {/* steps */}
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
                <StepIntro
                  k="01"
                  title="Who's sending this?"
                  sub="A little context sharpens the read. Nothing here is stored."
                />
                <Field
                  label="Company name"
                  required
                  value={d.company}
                  onChange={set("company")}
                  placeholder="Side Kick"
                />
                <Field
                  label="Website"
                  optional
                  value={d.website}
                  onChange={set("website")}
                  placeholder="sidekick.com"
                />
                <Field
                  label="What you sell"
                  required
                  textarea
                  rows={3}
                  value={d.offering}
                  onChange={set("offering")}
                  placeholder="Outbound infrastructure that builds AI-driven cold email systems for B2B teams."
                  hint="One or two lines is plenty — what you do and for whom."
                />
                <Chips
                  label="Campaign goal"
                  options={GOALS}
                  value={d.goal}
                  onChange={set("goal")}
                />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <StepIntro
                  k="02"
                  title="Who is this email for?"
                  sub="This is the persona Coldscore becomes when it reads your email."
                />
                <Field
                  label="Target title / persona"
                  required
                  value={d.icpTitle}
                  onChange={set("icpTitle")}
                  placeholder="VP of Sales at a Series B SaaS"
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field
                    label="Industry / market"
                    optional
                    value={d.icpIndustry}
                    onChange={set("icpIndustry")}
                    placeholder="B2B SaaS"
                  />
                  <div className="self-start">
                    <Chips
                      label="Company size"
                      options={SIZES}
                      value={d.icpCompanySize}
                      onChange={set("icpCompanySize")}
                    />
                  </div>
                </div>
                <Field
                  label="Core pain you solve for them"
                  optional
                  textarea
                  rows={2}
                  value={d.icpPain}
                  onChange={set("icpPain")}
                  placeholder="Reps spend hours on manual prospecting instead of selling."
                />
                <Field
                  label="Paste a full ICP (if you have one)"
                  optional
                  textarea
                  rows={4}
                  value={d.icpNotes}
                  onChange={set("icpNotes")}
                  placeholder="Drop any ICP doc, persona notes, or qualification criteria here."
                  hint="Either fill the fields above or paste a profile — whatever you've got."
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <StepIntro
                  k="03"
                  title="The email under test"
                  sub="Paste the cold email exactly as it would land in their inbox."
                />
                <Field
                  label="Subject line"
                  value={d.subject}
                  onChange={set("subject")}
                  placeholder="Quick question about {company}"
                  mono
                />
                <Field
                  label="Email body"
                  required
                  textarea
                  rows={11}
                  mono
                  value={d.body}
                  onChange={set("body")}
                  placeholder={`Hi {first_name},\n\nI noticed your team is hiring SDRs...\n\nWorth a quick look?\n\n— Name`}
                  hint={`${d.body.trim().length} characters · keep your merge tags, we read them too.`}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* footer nav */}
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
              Run the scan
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
