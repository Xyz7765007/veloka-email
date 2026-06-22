// Shared types across the app.

export type CampaignMode = "single" | "sequence" | "variations";

export type Status = "strong" | "ok" | "weak" | "critical";
export type Severity = "high" | "medium" | "low";
export type Impact = "high" | "medium" | "low";
export type Band = "Very Low" | "Low" | "Moderate" | "Strong" | "High";

export interface EmailInput {
  subject: string;
  body: string;
}

export interface IntakeData {
  company: string;
  website: string;
  offering: string;
  // ICP
  icpTitle: string;
  icpIndustry: string;
  icpCompanySize: string;
  icpPain: string;
  icpNotes: string;
  goal: string;
  // What's under test
  mode: CampaignMode;
  emails: EmailInput[]; // 1–3 emails
}

export interface ReplyLikelihood {
  band: Band;
  range: string; // "1-3%"
  rationale: string;
}

export interface IcpRead {
  persona: string;
  secondsToDecision: string; // "~3s"
  firstReaction: string; // first person
  readThrough: string; // first-person read-through narrative
  landsWell: string[];
  dropsOff: string[];
  wouldReply: boolean;
  replyReasoning: string;
  feeling: string;
}

export interface Dimension {
  key: string;
  label: string;
  score: number; // 0-100
  status: Status;
  summary: string;
}

export interface LineNote {
  excerpt: string; // verbatim from this email
  location: "subject" | "body";
  severity: Severity;
  issue: string;
  suggestion: string;
}

export interface PriorityFix {
  rank: number;
  fix: string;
  impact: Impact;
  why: string;
}

export interface Rewrite {
  subjectOptions: string[]; // fully shown
  body: string; // gated — shown partially behind a CTA
  rationale: string;
}

export interface Deliverability {
  score: number; // 0-100, higher = safer
  triggers: string[];
  note: string;
}

export interface Angle {
  lens: string; // e.g. "The Skeptic"
  read: string;
}

// One email's analysis within the submission.
export interface EmailScore {
  label: string; // "Email 1" | "Variation A" | "Step 1"
  subject: string; // the scored subject, verbatim
  overallScore: number; // 0-100
  grade: string;
  headline: string; // 2-4 word verdict
  verdict: string;
  replyLikelihood: ReplyLikelihood;
  icp: IcpRead;
  dimensions: Dimension[];
  lineNotes: LineNote[];
  deliverability: Deliverability;
  strengths: string[];
  priorityFixes: PriorityFix[];
  rewrite: Rewrite;
}

// Cross-email synthesis for the whole submission.
export interface Campaign {
  overallScore: number; // 0-100 for the whole submission
  grade: string;
  headline: string; // 2-4 word overall verdict
  verdict: string;
  summary: string;
  recommendation: string;
  modeInsight: string; // sequence flow / winning variation / portfolio note
  winnerLabel: string; // variations: winning label; else ""
  angles: Angle[]; // The Skeptic / Busy Executive / Deliverability Filter
}

// The full result of one scan (1–3 emails).
export interface Analysis {
  mode: CampaignMode;
  campaign: Campaign;
  emails: EmailScore[];
}
