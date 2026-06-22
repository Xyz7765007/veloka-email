"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Copy, CheckCheck, Sparkles, ArrowUpRight } from "lucide-react";
import type { Rewrite } from "@/lib/types";
import { BRAND, BRAND_HEX } from "@/lib/brand";

/** Show an enticing opening of the rewrite, lock the rest behind a CTA. */
function buildTeaser(body: string): { teaser: string; locked: boolean } {
  // Collapse paragraph gaps so a blank line after the greeting doesn't
  // truncate the teaser to just "Hi Name,".
  const text = (body || "").replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
  if (!text) return { teaser: "", locked: false };

  // Reveal ~40% (160-230 chars) as conversion bait, then lock the rest.
  const cap = Math.max(160, Math.min(230, Math.floor(text.length * 0.4)));
  if (text.length <= cap) return { teaser: text, locked: false };

  // Cut at a clean sentence boundary near the cap.
  const slice = text.slice(0, cap);
  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? ")
  );
  let cut: number;
  if (sentenceEnd > cap * 0.45) cut = sentenceEnd + 1;
  else {
    const nl = slice.lastIndexOf("\n");
    const sp = slice.lastIndexOf(" ");
    cut = nl > cap * 0.5 ? nl : sp > 0 ? sp : cap;
  }
  return { teaser: text.slice(0, cut).trim(), locked: true };
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="focusable inline-flex items-center gap-1.5 rounded-full border border-bone/14 bg-ink-2 px-3 py-1.5 text-xs text-bone-dim transition-colors hover:border-brand/40 hover:text-bone"
    >
      {done ? (
        <>
          <CheckCheck size={13} className="text-good" /> Copied
        </>
      ) : (
        <>
          <Copy size={13} /> Copy
        </>
      )}
    </button>
  );
}

export function LockedRewrite({ rewrite }: { rewrite: Rewrite }) {
  const { teaser, locked } = buildTeaser(rewrite.body);

  return (
    <div className="panel overflow-hidden rounded-3xl">
      {/* subject options — always fully visible */}
      <div className="border-b border-bone/8 p-6">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-bone-faint">
          Subject lines to test
        </div>
        <div className="space-y-2.5">
          {rewrite.subjectOptions.length === 0 && (
            <p className="text-sm text-bone-faint">No subject suggestions.</p>
          )}
          {rewrite.subjectOptions.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl border border-bone/10 bg-ink-2/60 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-brand">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm text-bone">{s}</span>
              </div>
              <CopyButton text={s} />
            </div>
          ))}
        </div>
      </div>

      {/* body — opening shown, rest gated */}
      <div className="relative p-6">
        <div
          className="absolute left-0 top-6 h-[calc(100%-3rem)] w-0.5 rounded-full"
          style={{ background: BRAND_HEX }}
        />
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-bone-faint">
          Rewritten body
        </div>

        {teaser && (
          <div className="relative">
            <div className="whitespace-pre-wrap pl-4 font-mono text-[13.5px] leading-relaxed text-bone">
              {teaser}
              {locked && <span className="text-bone-dim">…</span>}
            </div>
            {locked && (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-14"
                style={{
                  background:
                    "linear-gradient(180deg, transparent, var(--ink, #0B0D12))",
                }}
              />
            )}
          </div>
        )}

        {locked && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-4 rounded-2xl border border-brand/30 bg-brand/[0.06] p-5 sm:p-6"
          >
            <div className="flex items-start gap-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand/40 bg-brand/10 text-brand">
                <Lock size={17} />
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg tracking-tight text-bone">
                  The full rewrite is one call away
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-bone-dim">
                  You&rsquo;re seeing the opening. On a quick call, {BRAND.company}{" "}
                  walks you through the complete, ready-to-send rewrite, and
                  shows how we&rsquo;d build the system that writes emails like
                  this at scale.
                </p>
                <a
                  href={BRAND.bookACall}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focusable mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.02]"
                >
                  Book a call to unlock it
                  <ArrowUpRight size={16} />
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {!teaser && <div className="pl-4 text-sm text-bone-faint">No rewrite generated.</div>}
      </div>

      {/* rationale — strategy shown to build trust (the asset is the body) */}
      {rewrite.rationale && (
        <div className="border-t border-bone/8 bg-ink-2/40 p-5">
          <div className="flex items-start gap-3">
            <Sparkles size={15} className="mt-0.5 shrink-0 text-brand" />
            <p className="text-[13px] leading-relaxed text-bone-dim">
              <span className="text-bone">Why this approach: </span>
              {rewrite.rationale}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
