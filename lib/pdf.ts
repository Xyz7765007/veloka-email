import type { Analysis, EmailScore, IntakeData } from "./types";
import { scoreColor, statusColor, severityColor, impactColor } from "./score";
import { BRAND, BRAND_HEX } from "./brand";

/* ---------------- geometry & palette ---------------- */
const PAGE_W = 210;
const PAGE_H = 297;
const M = 16;
const CW = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 16;

type RGB = [number, number, number];
const INK: RGB = [24, 26, 30];
const DIM: RGB = [92, 98, 107];
const FAINT: RGB = [150, 156, 165];
const LINE: RGB = [228, 231, 236];
const PANEL: RGB = [247, 249, 252];
const GOOD: RGB = [42, 140, 92];
const CRIT: RGB = [198, 64, 52];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const BRAND_RGB = hexToRgb(BRAND_HEX);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

function teaserOf(body: string): { teaser: string; locked: boolean } {
  // Collapse paragraph gaps so a blank line after the greeting doesn't
  // truncate the teaser to just "Hi Name,".
  const text = (body || "").replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
  if (!text) return { teaser: "", locked: false };
  // Reveal ~40% of the rewrite (160-230 chars) as conversion bait, then lock.
  const cap = Math.max(160, Math.min(230, Math.floor(text.length * 0.4)));
  if (text.length <= cap) return { teaser: text, locked: false };
  const slice = text.slice(0, cap);
  const sentenceEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  let cut: number;
  if (sentenceEnd > cap * 0.45) cut = sentenceEnd + 1;
  else {
    const nl = slice.lastIndexOf("\n");
    const sp = slice.lastIndexOf(" ");
    cut = nl > cap * 0.5 ? nl : sp > 0 ? sp : cap;
  }
  return { teaser: text.slice(0, cut).trim(), locked: true };
}

export async function buildReportDoc(a: Analysis, intake: IntakeData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = M;

  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = M;
    }
  };

  type TextOpts = {
    size?: number; color?: RGB; font?: "normal" | "bold" | "italic";
    family?: "helvetica" | "courier"; x?: number; maxW?: number; lh?: number;
    gapAfter?: number; align?: "left" | "right";
  };

  const text = (content: string, opts: TextOpts = {}) => {
    const size = opts.size ?? 10;
    const color = opts.color ?? INK;
    const x = opts.x ?? M;
    const maxW = opts.maxW ?? CW;
    const lh = opts.lh ?? size * 0.5;
    doc.setFont(opts.family ?? "helvetica", opts.font ?? "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(content ?? ""), maxW) as string[];
    for (const line of lines) {
      ensure(lh);
      if (opts.align === "right") doc.text(line, x, y, { align: "right" });
      else doc.text(line, x, y);
      y += lh;
    }
    if (opts.gapAfter) y += opts.gapAfter;
  };

  const rule = (gap = 4, color: RGB = LINE, weight = 0.3) => {
    ensure(gap + 1);
    doc.setDrawColor(...color);
    doc.setLineWidth(weight);
    doc.line(M, y, PAGE_W - M, y);
    y += gap;
  };

  const eyebrow = (label: string, color: RGB = BRAND_RGB) => {
    ensure(6);
    text(label.toUpperCase(), { size: 7.5, color, family: "courier", gapAfter: 1.6 });
  };

  const sectionTitle = (label: string) => {
    ensure(11);
    y += 2.5;
    eyebrow(label);
  };

  const bullets = (items: string[], dot: RGB = BRAND_RGB, color: RGB = DIM) => {
    items.forEach((it) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(String(it ?? ""), CW - 6) as string[];
      ensure(lines.length * 4.4);
      doc.setFillColor(...dot);
      doc.circle(M + 1.1, y - 1.3, 0.8, "F");
      text(lines.join("\n"), { x: M + 5, maxW: CW - 5, color, size: 9.5, gapAfter: 1 });
    });
  };

  const bar = (label: string, score: number, hex: string, sub?: string) => {
    const s = clamp(score);
    const c = hexToRgb(hex);
    ensure(11 + (sub ? 4 : 0));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(label, M, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...c);
    doc.text(`${s}`, PAGE_W - M, y, { align: "right" });
    y += 2.2;
    const trackH = 2.4;
    doc.setFillColor(...LINE);
    doc.rect(M, y, CW, trackH, "F");
    doc.setFillColor(...c);
    doc.rect(M, y, (CW * s) / 100, trackH, "F");
    y += trackH + 3;
    if (sub) text(sub, { size: 8.8, color: DIM, gapAfter: 2.5, lh: 4 });
  };

  const scoreChip = (score: number, rightX: number, centerY: number) => {
    const s = clamp(score);
    const c = hexToRgb(scoreColor(s));
    const label = `${s}/100`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const w = doc.getTextWidth(label) + 7;
    const hh = 6.6;
    doc.setFillColor(c[0], c[1], c[2]);
    doc.roundedRect(rightX - w, centerY - hh / 2, w, hh, hh / 2, hh / 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(label, rightX - w / 2, centerY, { align: "center", baseline: "middle" });
  };

  /* header band */
  doc.setFillColor(...BRAND_RGB);
  doc.rect(0, 0, PAGE_W, 2, "F");
  y = M + 2.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text(BRAND.product, M, y);
  const pw = doc.getTextWidth(BRAND.product);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...FAINT);
  doc.text(`by ${BRAND.company}`, M + pw + 3, y);
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...FAINT);
  doc.text(
    new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    PAGE_W - M, y, { align: "right" }
  );
  y += 4.5;
  rule(6);

  /* title */
  const modeLabel =
    a.mode === "sequence" ? "Follow-up sequence"
    : a.mode === "variations" ? "A/B/C variations"
    : intake.emails.length > 1 ? "Standalone emails"
    : "Cold email diagnostic";
  eyebrow(modeLabel);
  text(intake.company || "Cold email analysis", { size: 20, font: "bold", gapAfter: 1.5 });
  const meta: string[] = [];
  if (intake.icpTitle) meta.push(`ICP: ${intake.icpTitle}`);
  meta.push(`${intake.emails.length} email${intake.emails.length > 1 ? "s" : ""}`);
  if (intake.goal) meta.push(`Goal: ${intake.goal}`);
  text(meta.join("   ·   "), { size: 9.5, color: DIM, gapAfter: 3 });

  /* campaign summary card */
  const cmp = a.campaign;
  ensure(34);
  const boxY = y;
  const CARD_H = 30;
  doc.setFillColor(...PANEL);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, boxY, CW, CARD_H, 2.5, 2.5, "FD");
  const cardMid = boxY + CARD_H / 2;
  const csc = hexToRgb(scoreColor(cmp.overallScore));

  // left column: score number + /100 + grade, centered as a unit
  const numStr = `${clamp(cmp.overallScore)}`;
  const numBaseline = cardMid + 2.5; // optical: big digits read centered slightly low
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(...csc);
  doc.text(numStr, M + 10, numBaseline);
  const numW = doc.getTextWidth(numStr);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...FAINT);
  doc.text("/100", M + 10 + numW + 1.5, numBaseline);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...csc);
  doc.text(`GRADE ${cmp.grade}`, M + 10, boxY + CARD_H - 5);

  // right column: headline + verdict, centered as a unit
  const rx = M + 50;
  const rw = CW - 50 - 9;
  const headLine = (doc.splitTextToSize(cmp.headline || "Summary", rw) as string[])[0] ?? "";
  const vLines = (doc.splitTextToSize(cmp.verdict || "", rw) as string[]).slice(0, 4);
  const HEAD_GAP = 6.2; // headline top -> first verdict line top
  const V_LH = 4.4;
  const rightBlockH = HEAD_GAP + vLines.length * V_LH;
  const ry0 = boxY + (CARD_H - rightBlockH) / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(...INK);
  doc.text(headLine, rx, ry0, { baseline: "top" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.3);
  doc.setTextColor(...DIM);
  let vy = ry0 + HEAD_GAP;
  vLines.forEach((l) => {
    doc.text(l, rx, vy, { baseline: "top" });
    vy += V_LH;
  });
  y = boxY + CARD_H + 5;

  if (cmp.recommendation) {
    ensure(14);
    const ry = y;
    const padX = 5;
    const padTop = 4.6;
    const padBot = 4.6;
    const eyeH = 2.8;
    const eyeGap = 3;
    const bodyLh = 4.4;
    const recLines = doc.splitTextToSize(cmp.recommendation, CW - padX * 2 - 1) as string[];
    const h = padTop + eyeH + eyeGap + recLines.length * bodyLh + padBot;
    doc.setFillColor(237, 243, 255);
    doc.setDrawColor(...BRAND_RGB);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, ry, CW, h, 2, 2, "FD");
    doc.setFillColor(...BRAND_RGB);
    doc.rect(M, ry, 1.4, h, "F");
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...BRAND_RGB);
    doc.text("DO THIS FIRST", M + padX, ry + padTop, { baseline: "top" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.6);
    doc.setTextColor(...INK);
    let by = ry + padTop + eyeH + eyeGap;
    recLines.forEach((l) => {
      doc.text(l, M + padX, by, { baseline: "top" });
      by += bodyLh;
    });
    y = ry + h + 4;
  }

  if (cmp.modeInsight) {
    sectionTitle(
      a.mode === "variations" ? "Why the winner wins"
      : a.mode === "sequence" ? "Sequence flow" : "Across the set"
    );
    if (a.mode === "variations" && cmp.winnerLabel) {
      text(`Winner: ${cmp.winnerLabel}`, { size: 10, font: "bold", color: BRAND_RGB, gapAfter: 1 });
    }
    text(cmp.modeInsight, { size: 9.5, color: DIM, gapAfter: 1 });
  }

  if (cmp.angles?.length) {
    sectionTitle("Read from every angle");
    cmp.angles.forEach((ang) => {
      text(ang.lens, { size: 9.5, font: "bold", gapAfter: 0.6 });
      text(ang.read, { size: 9.3, color: DIM, gapAfter: 2 });
    });
  }

  /* per-email sections */
  a.emails.forEach((em: EmailScore, idx) => {
    if (idx === 0) { y += 1; rule(5, LINE, 0.4); }
    else { doc.addPage(); y = M; }

    ensure(16);
    const hy = y;
    const STRIP_H = 11;
    const stripMid = hy + STRIP_H / 2;
    doc.setFillColor(...INK);
    doc.roundedRect(M, hy, CW, STRIP_H, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(em.label || `Email ${idx + 1}`, M + 5, stripMid, { baseline: "middle" });
    scoreChip(em.overallScore, PAGE_W - M - 4, stripMid);
    y = hy + STRIP_H + 4;

    if (em.subject) text(`Subject: ${em.subject}`, { size: 9.5, family: "courier", color: INK, gapAfter: 1.5 });
    text(`${em.headline ? em.headline + ". " : ""}${em.verdict}`, { size: 9.6, color: DIM, gapAfter: 2.5 });

    text(`Predicted reply: ${em.replyLikelihood.band}  ·  est. ${em.replyLikelihood.range}`, {
      size: 9.6, font: "bold", color: hexToRgb(scoreColor(em.overallScore)), gapAfter: 0.8,
    });
    text(em.replyLikelihood.rationale, { size: 9, color: DIM, gapAfter: 2.5 });

    sectionTitle("Through your prospect's eyes");
    text(`${em.icp.persona}  ·  decides in ${em.icp.secondsToDecision}`, {
      size: 8.5, family: "courier", color: FAINT, gapAfter: 1.8,
    });
    text(`"${em.icp.firstReaction}"`, { size: 10.5, font: "italic", color: INK, gapAfter: 2.2 });
    text(em.icp.readThrough, { size: 9.3, color: DIM, gapAfter: 2.5 });
    if (em.icp.landsWell.length) {
      text("What lands", { size: 9, font: "bold", color: GOOD, gapAfter: 1.2 });
      bullets(em.icp.landsWell, GOOD);
    }
    if (em.icp.dropsOff.length) {
      text("Where they drop off", { size: 9, font: "bold", color: CRIT, gapAfter: 1.2 });
      bullets(em.icp.dropsOff, CRIT);
    }
    text(`${em.icp.wouldReply ? "Would reply. " : "Would not reply. "}${em.icp.replyReasoning}`, {
      size: 9.4, font: "bold", color: INK, gapAfter: 2.5,
    });

    if (em.dimensions.length) {
      sectionTitle("Dimension scores");
      em.dimensions.forEach((dm) => bar(dm.label, dm.score, statusColor(dm.status), dm.summary));
    }

    if (em.lineNotes.length) {
      sectionTitle("Line-by-line notes");
      em.lineNotes.forEach((ln, i) => {
        const c = hexToRgb(severityColor(ln.severity));
        ensure(15);
        text(`${i + 1}.  "${ln.excerpt}"`, { size: 9, font: "bold", family: "courier", color: c, gapAfter: 1, lh: 4.2 });
        text(`Issue: ${ln.issue}`, { size: 9, color: INK, x: M + 5, maxW: CW - 5, gapAfter: 0.8, lh: 4.2 });
        text(`Fix: ${ln.suggestion}`, { size: 9, color: DIM, x: M + 5, maxW: CW - 5, gapAfter: 2.4, lh: 4.2 });
      });
    }

    sectionTitle("Deliverability");
    bar("Inbox safety", em.deliverability.score, scoreColor(em.deliverability.score), em.deliverability.note);
    if (em.deliverability.triggers.length) {
      text("Flags", { size: 9, font: "bold", color: CRIT, gapAfter: 1.2 });
      bullets(em.deliverability.triggers, CRIT);
    }

    if (em.strengths.length) {
      sectionTitle("What's working");
      bullets(em.strengths, GOOD, INK);
    }

    if (em.priorityFixes.length) {
      sectionTitle("Priority fixes");
      em.priorityFixes.slice().sort((x, z) => x.rank - z.rank).forEach((pf) => {
        const c = hexToRgb(impactColor(pf.impact));
        ensure(13);
        const cy = y - 1.4;
        doc.setFillColor(c[0], c[1], c[2]);
        doc.circle(M + 2, cy, 2.2, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`${pf.rank}`, M + 2, cy, { align: "center", baseline: "middle" });
        text(pf.fix, { size: 9.8, font: "bold", x: M + 7, maxW: CW - 7, gapAfter: 0.6, lh: 4.4 });
        text(`${pf.impact.toUpperCase()} IMPACT · ${pf.why}`, { size: 8.8, color: DIM, x: M + 7, maxW: CW - 7, gapAfter: 2.4, lh: 4 });
      });
    }

    sectionTitle("Suggested rewrite");
    text("Subject options", { size: 9, font: "bold", gapAfter: 1.2 });
    em.rewrite.subjectOptions.forEach((s, i) => {
      text(`${String.fromCharCode(65 + i)}.  ${s}`, { size: 9.4, family: "courier", color: INK, x: M + 4, maxW: CW - 4, gapAfter: 0.8, lh: 4.2 });
    });
    y += 1.5;

    const { teaser, locked } = teaserOf(em.rewrite.body);
    text("Rewritten body", { size: 9, font: "bold", gapAfter: 1.5 });
    const bodyTop = y;
    if (teaser) {
      text(teaser + (locked ? " …" : ""), { size: 9.4, color: INK, x: M + 4, maxW: CW - 8, lh: 4.6 });
      doc.setDrawColor(...BRAND_RGB);
      doc.setLineWidth(0.8);
      doc.line(M + 1, bodyTop - 3, M + 1, Math.min(y, BOTTOM));
    }
    y += 2;

    if (locked) {
      const padX = 6;
      const padTop = 5;
      const padBot = 5;
      const titleH = 4.4;
      const gap1 = 2.4;
      const explLh = 3.9;
      const gap2 = 2.8;
      const linkH = 3.8;
      const explainer = `You're seeing the opening. ${BRAND.company} walks you through the complete, ready-to-send rewrite on a quick call:`;
      const ll = doc.splitTextToSize(explainer, CW - padX * 2) as string[];
      const h = padTop + titleH + gap1 + ll.length * explLh + gap2 + linkH + padBot;
      ensure(h + 2);
      const ly = y;
      doc.setFillColor(237, 243, 255);
      doc.setDrawColor(...BRAND_RGB);
      doc.setLineWidth(0.3);
      doc.roundedRect(M, ly, CW, h, 2.5, 2.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      doc.text("The full rewrite is one call away", M + padX, ly + padTop, { baseline: "top" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.8);
      doc.setTextColor(...DIM);
      let ey = ly + padTop + titleH + gap1;
      ll.forEach((l) => {
        doc.text(l, M + padX, ey, { baseline: "top" });
        ey += explLh;
      });
      const linkTop = ly + padTop + titleH + gap1 + ll.length * explLh + gap2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...BRAND_RGB);
      doc.textWithLink(BRAND.bookACall, M + padX, linkTop + 2.5, { url: BRAND.bookACall });
      y = ly + h + 4;
    }

    if (em.rewrite.rationale) {
      text(`Why this approach: ${em.rewrite.rationale}`, { size: 8.6, font: "italic", color: DIM, gapAfter: 1, lh: 4 });
    }
  });

  /* footers */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, PAGE_H - 11, PAGE_W - M, PAGE_H - 11);
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...FAINT);
    doc.text(`${BRAND.product} · ${BRAND.company}`, M, PAGE_H - 7);
    doc.text(`${p} / ${pages}`, PAGE_W - M, PAGE_H - 7, { align: "right" });
  }

  return doc;
}

export async function downloadReport(a: Analysis, intake: IntakeData) {
  const doc = await buildReportDoc(a, intake);
  const safe = (intake.company || "email").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`coldscore-${safe}.pdf`);
}
