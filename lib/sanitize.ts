import type {
  Analysis,
  Angle,
  Dimension,
  Impact,
  LineNote,
  PriorityFix,
  Severity,
  Status,
} from "@/lib/types";

/**
 * Hardens raw model output into a fully-formed Analysis.
 *
 * Structured Outputs already constrains the shape, but this is a belt-and-braces
 * layer so the UI/PDF can NEVER crash on a surprising payload (out-of-range or
 * NaN scores, a missing nested object, a non-array where an array is expected,
 * an unknown enum value, or empty/garbage line notes). Every field comes out
 * present, typed, and in range.
 */

function clampScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim().length > 0 ? v : fallback;
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function oneOf<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : fallback;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

const STATUSES = ["strong", "ok", "weak", "critical"] as const;
const SEVERITIES = ["high", "medium", "low"] as const;
const IMPACTS = ["high", "medium", "low"] as const;
const BANDS = ["Very Low", "Low", "Moderate", "Strong", "High"] as const;

export function sanitizeAnalysis(raw: unknown): Analysis {
  const a = obj(raw);
  const rl = obj(a.replyLikelihood);
  const icp = obj(a.icp);
  const del = obj(a.deliverability);
  const rw = obj(a.rewrite);

  const dimensions: Dimension[] = arr<unknown>(a.dimensions)
    .filter((d) => !!d && typeof d === "object" && !Array.isArray(d))
    .map((dd) => {
      const d = obj(dd);
      return {
        key: str(d.key, "dimension"),
        label: str(d.label, "Dimension"),
        score: clampScore(d.score),
        status: oneOf<Status>(d.status, STATUSES, "ok"),
        summary: str(d.summary),
      };
    });

  const angles: Angle[] = arr<unknown>(a.angles)
    .filter((g) => !!g && typeof g === "object" && !Array.isArray(g))
    .map((gg) => {
      const g = obj(gg);
      return { lens: str(g.lens, "Perspective"), read: str(g.read) };
    });

  const lineNotes: LineNote[] = arr<unknown>(a.lineNotes)
    .map((nn) => {
      const n = obj(nn);
      return {
        excerpt: str(n.excerpt),
        location: oneOf<"subject" | "body">(
          n.location,
          ["subject", "body"],
          "body"
        ),
        severity: oneOf<Severity>(n.severity, SEVERITIES, "medium"),
        issue: str(n.issue),
        suggestion: str(n.suggestion),
      };
    })
    // a note with no excerpt AND no issue carries no information — drop it
    .filter((n) => n.excerpt.length > 0 || n.issue.length > 0);

  const priorityFixes: PriorityFix[] = arr<unknown>(a.priorityFixes)
    .filter((f) => !!f && typeof f === "object" && !Array.isArray(f))
    .map((ff, i) => {
      const f = obj(ff);
      return {
        rank:
          typeof f.rank === "number" && Number.isFinite(f.rank) ? f.rank : i + 1,
        fix: str(f.fix),
        impact: oneOf<Impact>(f.impact, IMPACTS, "medium"),
        why: str(f.why),
      };
    });

  return {
    overallScore: clampScore(a.overallScore),
    grade: str(a.grade, "—"),
    headline: str(a.headline, "Analysis complete"),
    verdict: str(a.verdict),
    replyLikelihood: {
      band: oneOf(rl.band, BANDS, "Low"),
      range: str(rl.range, "—"),
      rationale: str(rl.rationale),
    },
    icp: {
      persona: str(icp.persona, "Your prospect"),
      secondsToDecision: str(icp.secondsToDecision, "~5s"),
      firstReaction: str(icp.firstReaction),
      readThrough: str(icp.readThrough),
      landsWell: arr<unknown>(icp.landsWell)
        .map((x) => str(x))
        .filter(Boolean),
      dropsOff: arr<unknown>(icp.dropsOff)
        .map((x) => str(x))
        .filter(Boolean),
      wouldReply: Boolean(icp.wouldReply),
      replyReasoning: str(icp.replyReasoning),
      feeling: str(icp.feeling),
    },
    dimensions,
    angles,
    lineNotes,
    deliverability: {
      score: clampScore(del.score),
      triggers: arr<unknown>(del.triggers)
        .map((x) => str(x))
        .filter(Boolean),
      note: str(del.note),
    },
    strengths: arr<unknown>(a.strengths)
      .map((x) => str(x))
      .filter(Boolean),
    priorityFixes,
    rewrite: {
      subjectOptions: arr<unknown>(rw.subjectOptions)
        .map((x) => str(x))
        .filter(Boolean),
      body: str(rw.body),
      rationale: str(rw.rationale),
    },
  };
}
