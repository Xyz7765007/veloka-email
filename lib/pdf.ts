import type { Analysis, IntakeData } from "./types";
import { scoreColor, statusColor, severityColor, impactColor } from "./score";

const PAGE_W = 210;
const PAGE_H = 297;
const M = 16; // margin
const CW = PAGE_W - M * 2; // content width
const INK: [number, number, number] = [26, 24, 20];
const DIM: [number, number, number] = [110, 104, 92];
const FAINT: [number, number, number] = [150, 144, 132];
const BRAND: [number, number, number] = [180, 138, 38]; // deeper gold for print
const LINE: [number, number, number] = [228, 224, 214];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export async function downloadReport(a: Analysis, intake: IntakeData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = M;

  const ensure = (h: number) => {
    if (y + h > PAGE_H - M - 6) {
      doc.addPage();
      y = M;
    }
  };

  const text = (
    content: string,
    opts: {
      size?: number;
      color?: [number, number, number];
      font?: "normal" | "bold" | "italic";
      family?: "helvetica" | "courier";
      x?: number;
      maxW?: number;
      lh?: number;
      gapAfter?: number;
    } = {}
  ) => {
    const size = opts.size ?? 10;
    const color = opts.color ?? INK;
    const x = opts.x ?? M;
    const maxW = opts.maxW ?? CW;
    const lh = opts.lh ?? size * 0.46;
    doc.setFont(opts.family ?? "helvetica", opts.font ?? "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(content, maxW) as string[];
    for (const line of lines) {
      ensure(lh);
      doc.text(line, x, y);
      y += lh;
    }
    if (opts.gapAfter) y += opts.gapAfter;
  };

  const rule = (gap = 4) => {
    ensure(gap + 2);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(M, y, PAGE_W - M, y);
    y += gap;
  };

  const eyebrow = (label: string) => {
    ensure(7);
    text(label.toUpperCase(), {
      size: 7.5,
      color: BRAND,
      family: "courier",
      gapAfter: 1.5,
    });
  };

  const sectionTitle = (label: string) => {
    ensure(12);
    y += 3;
    eyebrow(label);
    y += 1;
  };

  const bullets = (items: string[], color: [number, number, number] = DIM) => {
    items.forEach((it) => {
      ensure(5);
      doc.setFillColor(...BRAND);
      doc.circle(M + 1, y - 1.2, 0.7, "F");
      text(it, { x: M + 5, maxW: CW - 5, color, size: 9.5, gapAfter: 0.5 });
    });
  };

  const scoreBar = (label: string, score: number, color: string, sub: string) => {
    ensure(14);
    text(label, { size: 9.5, font: "bold", gapAfter: 0.5 });
    const barY = y;
    doc.setFillColor(...LINE);
    doc.roundedRect(M, barY, CW - 22, 2.4, 1.2, 1.2, "F");
    const [r, g, b] = hexToRgb(color);
    doc.setFillColor(r, g, b);
    doc.roundedRect(M, barY, ((CW - 22) * Math.min(score, 100)) / 100, 2.4, 1.2, 1.2, "F");
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(r, g, b);
    doc.text(`${score}`, PAGE_W - M, barY + 2.2, { align: "right" });
    y = barY + 5;
    text(sub, { size: 8.5, color: DIM, gapAfter: 2.5 });
  };

  /* ---------- HEADER ---------- */
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PAGE_W, 1.4, "F");
  y = M + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text("Coldscore", M, y);
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...FAINT);
  doc.text("BY SIDE KICK", M + 30, y - 0.5);
  doc.text(
    new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    PAGE_W - M,
    y,
    { align: "right" }
  );
  y += 4;
  rule(5);

  /* ---------- TITLE ---------- */
  text("Cold email diagnostic", { size: 8, color: FAINT, family: "courier", gapAfter: 1 });
  text(intake.company || "Cold email analysis", {
    size: 20,
    font: "bold",
    gapAfter: 1,
  });
  if (intake.icpTitle) {
    text(`For: ${intake.icpTitle}`, { size: 9.5, color: DIM, gapAfter: 1 });
  }
  if (intake.subject) {
    text(`Subject tested: "${intake.subject}"`, {
      size: 9,
      color: DIM,
      family: "courier",
      gapAfter: 2,
    });
  }
  y += 2;

  /* ---------- OVERALL SCORE ---------- */
  ensure(30);
  const boxY = y;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, boxY, CW, 26, 2, 2, "S");
  const sc = hexToRgb(scoreColor(a.overallScore));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(...sc);
  doc.text(`${a.overallScore}`, M + 8, boxY + 17);
  doc.setFontSize(10);
  doc.setTextColor(...FAINT);
  doc.text("/100", M + 8 + doc.getTextWidth(`${a.overallScore}`) + 2, boxY + 17);
  // grade
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...sc);
  doc.text(`Grade ${a.grade}`, M + 46, boxY + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  const verdictLines = doc.splitTextToSize(a.verdict, CW - 56) as string[];
  let vy = boxY + 15;
  verdictLines.slice(0, 3).forEach((l) => {
    doc.text(l, M + 46, vy);
    vy += 4.4;
  });
  y = boxY + 31;

  /* ---------- REPLY LIKELIHOOD ---------- */
  sectionTitle("Predicted reply likelihood");
  text(`${a.replyLikelihood.band}  ·  est. ${a.replyLikelihood.range} positive replies`, {
    size: 11,
    font: "bold",
    color: hexToRgb(scoreColor(a.overallScore)),
    gapAfter: 1,
  });
  text(a.replyLikelihood.rationale, { size: 9.5, color: DIM, gapAfter: 2 });

  /* ---------- ICP POV ---------- */
  sectionTitle("Through your prospect's eyes");
  text(`Persona: ${a.icp.persona}  ·  decides in ${a.icp.secondsToDecision}`, {
    size: 9,
    color: FAINT,
    family: "courier",
    gapAfter: 2,
  });
  text(`"${a.icp.firstReaction}"`, {
    size: 11,
    font: "italic",
    color: INK,
    gapAfter: 2.5,
  });
  text(a.icp.readThrough, { size: 9.5, color: DIM, gapAfter: 2.5 });
  if (a.icp.landsWell.length) {
    text("What lands", { size: 9, font: "bold", color: hexToRgb("#3a9d64"), gapAfter: 1 });
    bullets(a.icp.landsWell);
    y += 1;
  }
  if (a.icp.dropsOff.length) {
    text("Where they drop off", { size: 9, font: "bold", color: hexToRgb("#c0492f"), gapAfter: 1 });
    bullets(a.icp.dropsOff);
    y += 1;
  }
  text(
    `${a.icp.wouldReply ? "Would reply." : "Would not reply."}  ${a.icp.replyReasoning}`,
    { size: 9.5, font: "bold", color: INK, gapAfter: 2 }
  );

  /* ---------- DIMENSIONS ---------- */
  sectionTitle("Dimension scores");
  a.dimensions.forEach((dm) => scoreBar(dm.label, dm.score, statusColor(dm.status), dm.summary));

  /* ---------- ANGLES ---------- */
  sectionTitle("Read from every angle");
  a.angles.forEach((ang) => {
    text(ang.lens, { size: 9.5, font: "bold", gapAfter: 0.5 });
    text(ang.read, { size: 9.5, color: DIM, gapAfter: 2 });
  });

  /* ---------- LINE NOTES ---------- */
  sectionTitle("Line-by-line notes");
  a.lineNotes.forEach((ln, i) => {
    ensure(16);
    const c = hexToRgb(severityColor(ln.severity));
    text(`${i + 1}. "${ln.excerpt}"`, {
      size: 9,
      font: "bold",
      family: "courier",
      color: c,
      gapAfter: 0.5,
    });
    text(`Issue — ${ln.issue}`, { size: 9, color: INK, x: M + 4, maxW: CW - 4, gapAfter: 0.5 });
    text(`Fix — ${ln.suggestion}`, { size: 9, color: DIM, x: M + 4, maxW: CW - 4, gapAfter: 2 });
  });

  /* ---------- DELIVERABILITY ---------- */
  sectionTitle("Deliverability");
  scoreBar(
    "Inbox safety",
    a.deliverability.score,
    scoreColor(a.deliverability.score),
    a.deliverability.note
  );
  if (a.deliverability.triggers.length) {
    text("Flags:", { size: 9, font: "bold", gapAfter: 1 });
    bullets(a.deliverability.triggers);
  }

  /* ---------- STRENGTHS ---------- */
  if (a.strengths.length) {
    sectionTitle("What's working");
    bullets(a.strengths, INK);
  }

  /* ---------- PRIORITY FIXES ---------- */
  sectionTitle("Priority fixes");
  a.priorityFixes
    .slice()
    .sort((x, z) => x.rank - z.rank)
    .forEach((pf) => {
      ensure(14);
      const c = hexToRgb(impactColor(pf.impact));
      text(`${pf.rank}. ${pf.fix}`, { size: 10, font: "bold", gapAfter: 0.5 });
      text(`${pf.impact.toUpperCase()} IMPACT`, {
        size: 7.5,
        family: "courier",
        color: c,
        gapAfter: 0.5,
      });
      text(pf.why, { size: 9, color: DIM, gapAfter: 2 });
    });

  /* ---------- REWRITE ---------- */
  sectionTitle("Suggested rewrite");
  text("Subject options", { size: 9, font: "bold", gapAfter: 1 });
  a.rewrite.subjectOptions.forEach((s, i) => {
    text(`${String.fromCharCode(65 + i)}.  ${s}`, {
      size: 9.5,
      family: "courier",
      color: INK,
      gapAfter: 0.5,
    });
  });
  y += 2;
  text("Body", { size: 9, font: "bold", gapAfter: 1.5 });
  ensure(10);
  const bodyStart = y;
  text(a.rewrite.body, { size: 9.5, color: INK, lh: 4.6, x: M + 4, maxW: CW - 8 });
  // left accent rule for the rewrite body
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.8);
  doc.line(M + 1, bodyStart - 3, M + 1, Math.min(y, PAGE_H - M));
  y += 2;
  text(`Why — ${a.rewrite.rationale}`, { size: 8.5, font: "italic", color: DIM });

  /* ---------- FOOTERS ---------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, PAGE_H - 12, PAGE_W - M, PAGE_H - 12);
    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...FAINT);
    doc.text("Generated by Coldscore — Side Kick", M, PAGE_H - 8);
    doc.text(`${p} / ${pages}`, PAGE_W - M, PAGE_H - 8, { align: "right" });
  }

  const safe = (intake.company || "email").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`coldscore-${safe}.pdf`);
}
