"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { LineNote } from "@/lib/types";
import { severityColor } from "@/lib/score";

type NumberedNote = LineNote & { n: number };

interface Seg {
  text: string;
  note?: NumberedNote;
}

function buildSegments(text: string, notes: NumberedNote[]): Seg[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const matches: { start: number; end: number; note: NumberedNote }[] = [];
  notes.forEach((note) => {
    const ex = note.excerpt.trim();
    if (!ex) return;
    const idx = lower.indexOf(ex.toLowerCase());
    if (idx === -1) return;
    matches.push({ start: idx, end: idx + ex.length, note });
  });
  matches.sort((a, b) => a.start - b.start);
  const accepted: typeof matches = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      accepted.push(m);
      lastEnd = m.end;
    }
  }
  const segs: Seg[] = [];
  let cursor = 0;
  for (const m of accepted) {
    if (m.start > cursor) segs.push({ text: text.slice(cursor, m.start) });
    segs.push({ text: text.slice(m.start, m.end), note: m.note });
    cursor = m.end;
  }
  if (cursor < text.length) segs.push({ text: text.slice(cursor) });
  return segs;
}

function Highlighted({
  segs,
  active,
  setActive,
}: {
  segs: Seg[];
  active: number | null;
  setActive: (n: number | null) => void;
}) {
  return (
    <>
      {segs.map((s, i) => {
        if (!s.note) return <span key={i}>{s.text}</span>;
        const c = severityColor(s.note.severity);
        const isActive = active === s.note.n;
        return (
          <span
            key={i}
            onMouseEnter={() => setActive(s.note!.n)}
            onMouseLeave={() => setActive(null)}
            className="relative cursor-help rounded px-0.5 transition-shadow duration-150"
            style={{
              background: `${c}${isActive ? "33" : "1f"}`,
              boxShadow: isActive
                ? `inset 0 -2px 0 ${c}, 0 0 0 1px ${c}66`
                : `inset 0 -2px 0 ${c}`,
            }}
          >
            {s.text}
            <sup
              className="ml-0.5 font-mono text-[0.6em] font-semibold"
              style={{ color: c }}
            >
              {s.note.n}
            </sup>
          </span>
        );
      })}
    </>
  );
}

export function EmailMarkup({
  subject,
  body,
  notes,
}: {
  subject: string;
  body: string;
  notes: LineNote[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const numbered: NumberedNote[] = notes.map((n, i) => ({ ...n, n: i + 1 }));
  const subjNotes = numbered.filter((n) => n.location === "subject");
  const bodyNotes = numbered.filter((n) => n.location === "body");
  const subjSegs = buildSegments(subject, subjNotes);
  const bodySegs = buildSegments(body, bodyNotes);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      {/* the marked-up email */}
      <div className="panel overflow-hidden p-6 shadow-panel">
        <div className="mb-4 flex items-center justify-between border-b border-bone/10 pb-3">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone-faint">
            your email, marked up
          </span>
          <span className="font-mono text-[0.66rem] text-bone-faint">
            {notes.length} notes
          </span>
        </div>
        {subject && (
          <div className="mb-4">
            <div className="mb-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-bone-faint">
              subject
            </div>
            <div className="whitespace-pre-wrap font-mono text-[0.9rem] text-bone">
              {subjSegs.length ? (
                <Highlighted segs={subjSegs} active={active} setActive={setActive} />
              ) : (
                subject
              )}
            </div>
          </div>
        )}
        <div className="whitespace-pre-wrap text-[0.92rem] leading-[1.7] text-bone-dim">
          <Highlighted segs={bodySegs} active={active} setActive={setActive} />
        </div>
      </div>

      {/* annotations rail */}
      <div className="space-y-3">
        {numbered.length === 0 && (
          <div className="rounded-xl border border-good/20 bg-good/[0.05] p-4 text-[0.86rem] leading-snug text-bone-dim">
            No line-level issues were flagged — nothing in the wording tripped a
            specific red flag. Check the breakdown and priority fixes below for
            the bigger-picture read.
          </div>
        )}
        {numbered.map((note, i) => {
          const c = severityColor(note.severity);
          const isActive = active === note.n;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              onMouseEnter={() => setActive(note.n)}
              onMouseLeave={() => setActive(null)}
              className="rounded-xl border p-3.5 transition-all duration-200"
              style={{
                borderColor: isActive ? `${c}66` : "rgba(241,234,220,0.1)",
                background: isActive ? `${c}0d` : "rgba(23,21,15,0.4)",
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[0.66rem] font-semibold"
                  style={{ background: `${c}22`, color: c }}
                >
                  {note.n}
                </span>
                <span
                  className="font-mono text-[0.58rem] uppercase tracking-[0.14em]"
                  style={{ color: c }}
                >
                  {note.severity} · {note.location}
                </span>
              </div>
              <p className="mt-2 text-[0.86rem] font-medium leading-snug text-bone">
                {note.issue}
              </p>
              <p className="mt-1.5 text-[0.82rem] leading-snug text-bone-dim">
                {note.suggestion}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
