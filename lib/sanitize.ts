import type {
  Analysis,
  Angle,
  Band,
  Campaign,
  CampaignMode,
  Dimension,
  EmailScore,
  IcpRead,
  Impact,
  LineNote,
  PriorityFix,
  ReplyLikelihood,
  Rewrite,
  Severity,
  Status,
} from "@/lib/types";

/**
 * Hardens raw model output into a fully-formed Analysis. Structured Outputs
 * already constrains shape, but this guarantees the UI/PDF can never crash on a
 * surprising payload: out-of-range/NaN scores, missing nested objects, non-array
 * arrays, unknown enums, or empty/garbage entries all resolve to safe values.
 */

function clampScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
function str(v: unknown, fallback = ""): string {
  if (typeof v === "string" && v.trim().length > 0) {
    // Brand voice: no em/en dashes anywhere in the report. Hyphens (e.g.
    // "2-4%", "first-touch") use "-" and are untouched.
    return v.replace(/\s*[—–]\s*/g, ", ");
  }
  return fallback;
}
function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function strList(v: unknown): string[] {
  return arr<unknown>(v).map((x) => str(x)).filter(Boolean);
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fb;
}
function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function isObj(v: unknown): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

const STATUSES = ["strong", "ok", "weak", "critical"] as const;
const SEVERITIES = ["high", "medium", "low"] as const;
const IMPACTS = ["high", "medium", "low"] as const;
const BANDS = ["Very Low", "Low", "Moderate", "Strong", "High"] as const;
const MODES = ["single", "sequence", "variations"] as const;

function sReply(v: unknown): ReplyLikelihood {
  const r = obj(v);
  return {
    band: oneOf<Band>(r.band, BANDS, "Low"),
    range: str(r.range, "-"),
    rationale: str(r.rationale),
  };
}
function sIcp(v: unknown): IcpRead {
  const i = obj(v);
  return {
    persona: str(i.persona, "Your prospect"),
    secondsToDecision: str(i.secondsToDecision, "~5s"),
    firstReaction: str(i.firstReaction),
    readThrough: str(i.readThrough),
    landsWell: strList(i.landsWell),
    dropsOff: strList(i.dropsOff),
    wouldReply: Boolean(i.wouldReply),
    replyReasoning: str(i.replyReasoning),
    feeling: str(i.feeling),
  };
}
function sDims(v: unknown): Dimension[] {
  return arr<unknown>(v).filter(isObj).map((dd) => {
    const d = obj(dd);
    return {
      key: str(d.key, "dimension"),
      label: str(d.label, "Dimension"),
      score: clampScore(d.score),
      status: oneOf<Status>(d.status, STATUSES, "ok"),
      summary: str(d.summary),
    };
  });
}
function sNotes(v: unknown): LineNote[] {
  return arr<unknown>(v).filter(isObj).map((nn) => {
    const n = obj(nn);
    return {
      excerpt: str(n.excerpt),
      location: oneOf<"subject" | "body">(n.location, ["subject", "body"], "body"),
      severity: oneOf<Severity>(n.severity, SEVERITIES, "medium"),
      issue: str(n.issue),
      suggestion: str(n.suggestion),
    };
  }).filter((n) => n.excerpt.length > 0 || n.issue.length > 0);
}
function sFixes(v: unknown): PriorityFix[] {
  return arr<unknown>(v).filter(isObj).map((ff, i) => {
    const f = obj(ff);
    return {
      rank: typeof f.rank === "number" && Number.isFinite(f.rank) ? f.rank : i + 1,
      fix: str(f.fix),
      impact: oneOf<Impact>(f.impact, IMPACTS, "medium"),
      why: str(f.why),
    };
  });
}
function sRewrite(v: unknown): Rewrite {
  const r = obj(v);
  return {
    subjectOptions: strList(r.subjectOptions),
    body: str(r.body),
    rationale: str(r.rationale),
  };
}
function sAngles(v: unknown): Angle[] {
  return arr<unknown>(v).filter(isObj).map((gg) => {
    const g = obj(gg);
    return { lens: str(g.lens, "Perspective"), read: str(g.read) };
  });
}

function sEmail(v: unknown, idx: number): EmailScore {
  const e = obj(v);
  const d = obj(e.deliverability);
  return {
    label: str(e.label, `Email ${idx + 1}`),
    subject: typeof e.subject === "string" ? e.subject : "",
    overallScore: clampScore(e.overallScore),
    grade: str(e.grade, "-"),
    headline: str(e.headline, "Analysis"),
    verdict: str(e.verdict),
    replyLikelihood: sReply(e.replyLikelihood),
    icp: sIcp(e.icp),
    dimensions: sDims(e.dimensions),
    lineNotes: sNotes(e.lineNotes),
    deliverability: {
      score: clampScore(d.score),
      triggers: strList(d.triggers),
      note: str(d.note),
    },
    strengths: strList(e.strengths),
    priorityFixes: sFixes(e.priorityFixes),
    rewrite: sRewrite(e.rewrite),
  };
}

function sCampaign(v: unknown): Campaign {
  const c = obj(v);
  return {
    overallScore: clampScore(c.overallScore),
    grade: str(c.grade, "-"),
    headline: str(c.headline, "Analysis complete"),
    verdict: str(c.verdict),
    summary: str(c.summary),
    recommendation: str(c.recommendation),
    modeInsight: str(c.modeInsight),
    winnerLabel: typeof c.winnerLabel === "string" ? c.winnerLabel : "",
    angles: sAngles(c.angles),
  };
}

export function sanitizeAnalysis(
  raw: unknown,
  fallbackMode: CampaignMode = "single"
): Analysis {
  const a = obj(raw);
  let emails = arr<unknown>(a.emails).filter(isObj).map((e, i) => sEmail(e, i));
  if (emails.length === 0) {
    // Never render an empty report — synthesise one placeholder email.
    emails = [sEmail({}, 0)];
  }
  return {
    mode: oneOf<CampaignMode>(a.mode, MODES, fallbackMode),
    campaign: sCampaign(a.campaign),
    emails,
  };
}
