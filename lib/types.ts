// Shared types across the app.

export interface IntakeData {
  company: string;
  website: string;
  offering: string;
  // ICP
  icpTitle: string;
  icpIndustry: string;
  icpCompanySize: string;
  icpPain: string;
  icpNotes: string; // optional free-form ICP paste
  goal: string; // campaign goal
  // The email under test
  subject: string;
  body: string;
}

export type Status = "strong" | "ok" | "weak" | "critical";
export type Severity = "high" | "medium" | "low";
export type Impact = "high" | "medium" | "low";

export interface Dimension {
  key: string;
  label: string;
  score: number; // 0-100
  status: Status;
  summary: string;
}

export interface LineNote {
  excerpt: string; // verbatim from the email
  location: "subject" | "body";
  severity: Severity;
  issue: string;
  suggestion: string;
}

export interface Angle {
  lens: string; // e.g. "The Skeptic"
  read: string;
}

export interface PriorityFix {
  rank: number;
  fix: string;
  impact: Impact;
  why: string;
}

export interface Analysis {
  overallScore: number; // 0-100
  grade: string; // "A", "B+", "C-" ...
  headline: string; // 2-4 word summary label
  verdict: string; // one punchy sentence
  replyLikelihood: {
    band: "Very Low" | "Low" | "Moderate" | "Strong" | "High";
    range: string; // "1-3%"
    rationale: string;
  };
  icp: {
    persona: string;
    secondsToDecision: string; // "~3s"
    firstReaction: string; // first person, gut reaction
    readThrough: string; // narrative of how they read it
    landsWell: string[];
    dropsOff: string[];
    wouldReply: boolean;
    replyReasoning: string;
    feeling: string; // short emotional read
  };
  dimensions: Dimension[];
  angles: Angle[];
  lineNotes: LineNote[];
  deliverability: {
    score: number; // 0-100, higher = safer
    triggers: string[];
    note: string;
  };
  strengths: string[];
  priorityFixes: PriorityFix[];
  rewrite: {
    subjectOptions: string[];
    body: string;
    rationale: string;
  };
}
