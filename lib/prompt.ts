import type { IntakeData, CampaignMode } from "@/lib/types";

export const MODEL = process.env.OPENAI_MODEL || "gpt-5.4";

const MODE_GUIDE: Record<CampaignMode, string> = {
  single:
    "These are STANDALONE emails — each is its own first-touch attempt. Score each independently. Labels: 'Email 1', 'Email 2', 'Email 3'. The campaign summary should give a portfolio read (which is strongest, common weaknesses). winnerLabel must be \"\".",
  sequence:
    "These emails form a FOLLOW-UP SEQUENCE sent to the same prospect over time (step 1, step 2, step 3). Score each step AND judge the sequence as a whole: does it escalate value, avoid repeating the same ask/line, vary the angle, and build urgency without nagging? Labels: 'Step 1', 'Step 2', 'Step 3'. Put the flow critique in campaign.modeInsight. winnerLabel must be \"\".",
  variations:
    "These are A/B/C VARIATIONS of the same first-touch email, competing for the same goal. Score each, then pick the one most likely to win replies. Labels: 'Variation A', 'Variation B', 'Variation C'. Set campaign.winnerLabel to the winning label and explain why it wins (vs the others) in campaign.modeInsight.",
};

export const SYSTEM_PROMPT = `You are the senior cold-email strategist behind Side Kick (get-sidekick.com), a B2B outbound infrastructure agency with 20+ years of outbound experience. You judge cold emails the way a real, busy, slightly skeptical prospect would — not the way a marketer hopes they'll be read.

You will receive the sender's company, offer, goal, ICP, and one to three emails framed by a mode (standalone / sequence / variations). Analyse them and return a single structured JSON object.

How to think:
- Inhabit the ICP. Read each email as that exact persona in their real inbox: skim first, decide in seconds, mostly look for a reason to delete. Write the ICP read in FIRST PERSON ("I'd probably...").
- Be specific to THESE emails. Quote the actual words. Never give generic cold-email advice that could apply to any email.
- Be honest and conservative. Most cold emails are mediocre. Ground reply-rate estimates in real B2B benchmarks (a typical cold email gets ~1-5% positive replies; a great, highly-relevant one might reach 8-15%; spammy/generic ones near 0). Do not inflate.
- Score 0-100 where 0-39 = will be deleted/ignored, 40-59 = weak but salvageable, 60-79 = solid, 80-100 = excellent and rare.
- For deliverability, flag concrete spam/filter risks (spammy phrases, ALL CAPS, links, money/guarantee language, over-personalization tokens, length, image-heavy).
- For line notes, the "excerpt" MUST be copied verbatim from that email's subject or body so it can be located in the original text. Keep excerpts short (a phrase, not a paragraph).
- The rewrite must be a genuine, ready-to-send improvement built from the sender's actual offer and ICP — not a template.

Mode-specific instructions: {{MODE_GUIDE}}

Output rules:
- Score every email provided, in order, in the "emails" array. Use the label scheme stated for this mode.
- Per email provide 4-6 dimensions, 2-6 line notes, 3-5 priority fixes.
- campaign.angles: exactly the three lenses "The Skeptic", "The Busy Executive", "The Deliverability Filter" applied across the set.
- campaign.overallScore reflects the whole submission (for variations, weight toward the best; for a sequence, the sequence's combined effectiveness; for standalone, the overall quality of the set).
- Never use em dashes (—) or en dashes (–) anywhere. Use commas, periods, or colons. This applies especially to the rewrite body, which must read as clean, ready-to-send copy.
- Every field is mandatory. Return ONLY the JSON object matching the schema.`;

// ---- OpenAI Structured Outputs schema (strict mode) ----
// No minimum/maximum/minItems; additionalProperties:false + full required everywhere.

const replyLikelihood = {
  type: "object",
  additionalProperties: false,
  properties: {
    band: { type: "string", enum: ["Very Low", "Low", "Moderate", "Strong", "High"] },
    range: { type: "string", description: "Positive-reply rate range, e.g. '2-4%'." },
    rationale: { type: "string" },
  },
  required: ["band", "range", "rationale"],
};

const icp = {
  type: "object",
  additionalProperties: false,
  properties: {
    persona: { type: "string" },
    secondsToDecision: { type: "string", description: "e.g. '~3s'." },
    firstReaction: { type: "string", description: "First-person gut reaction." },
    readThrough: { type: "string", description: "First-person read-through narrative." },
    landsWell: { type: "array", items: { type: "string" } },
    dropsOff: { type: "array", items: { type: "string" } },
    wouldReply: { type: "boolean" },
    replyReasoning: { type: "string" },
    feeling: { type: "string" },
  },
  required: ["persona", "secondsToDecision", "firstReaction", "readThrough", "landsWell", "dropsOff", "wouldReply", "replyReasoning", "feeling"],
};

const dimension = {
  type: "object",
  additionalProperties: false,
  properties: {
    key: { type: "string" },
    label: { type: "string" },
    score: { type: "integer", description: "0-100." },
    status: { type: "string", enum: ["strong", "ok", "weak", "critical"] },
    summary: { type: "string" },
  },
  required: ["key", "label", "score", "status", "summary"],
};

const lineNote = {
  type: "object",
  additionalProperties: false,
  properties: {
    excerpt: { type: "string", description: "Verbatim phrase from this email." },
    location: { type: "string", enum: ["subject", "body"] },
    severity: { type: "string", enum: ["high", "medium", "low"] },
    issue: { type: "string" },
    suggestion: { type: "string" },
  },
  required: ["excerpt", "location", "severity", "issue", "suggestion"],
};

const priorityFix = {
  type: "object",
  additionalProperties: false,
  properties: {
    rank: { type: "integer" },
    fix: { type: "string" },
    impact: { type: "string", enum: ["high", "medium", "low"] },
    why: { type: "string" },
  },
  required: ["rank", "fix", "impact", "why"],
};

const rewrite = {
  type: "object",
  additionalProperties: false,
  properties: {
    subjectOptions: { type: "array", items: { type: "string" }, description: "2 to 3 subject line options." },
    body: { type: "string", description: "Ready-to-send rewritten body." },
    rationale: { type: "string" },
  },
  required: ["subjectOptions", "body", "rationale"],
};

const emailScore = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string", description: "e.g. 'Email 1' / 'Variation A' / 'Step 1'." },
    subject: { type: "string", description: "The subject line scored (verbatim)." },
    overallScore: { type: "integer", description: "0-100." },
    grade: { type: "string" },
    headline: { type: "string", description: "2-4 word verdict label." },
    verdict: { type: "string" },
    replyLikelihood,
    icp,
    dimensions: { type: "array", items: dimension },
    lineNotes: { type: "array", items: lineNote },
    deliverability: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "integer", description: "0-100, higher = safer." },
        triggers: { type: "array", items: { type: "string" } },
        note: { type: "string" },
      },
      required: ["score", "triggers", "note"],
    },
    strengths: { type: "array", items: { type: "string" } },
    priorityFixes: { type: "array", items: priorityFix },
    rewrite,
  },
  required: ["label", "subject", "overallScore", "grade", "headline", "verdict", "replyLikelihood", "icp", "dimensions", "lineNotes", "deliverability", "strengths", "priorityFixes", "rewrite"],
};

const campaign = {
  type: "object",
  additionalProperties: false,
  properties: {
    overallScore: { type: "integer", description: "0-100 for the whole submission." },
    grade: { type: "string" },
    headline: { type: "string", description: "2-4 word overall verdict." },
    verdict: { type: "string" },
    summary: { type: "string", description: "Short narrative across the set." },
    recommendation: { type: "string", description: "The single most important next move." },
    modeInsight: { type: "string", description: "Mode-specific: sequence flow critique / why the winning variation wins / portfolio note for standalone." },
    winnerLabel: { type: "string", description: "For variations: label of the best email. Empty string otherwise." },
    angles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { lens: { type: "string" }, read: { type: "string" } },
        required: ["lens", "read"],
      },
    },
  },
  required: ["overallScore", "grade", "headline", "verdict", "summary", "recommendation", "modeInsight", "winnerLabel", "angles"],
};

export const ANALYSIS_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    mode: { type: "string", enum: ["single", "sequence", "variations"] },
    campaign,
    emails: { type: "array", items: emailScore },
  },
  required: ["mode", "campaign", "emails"],
};

export function buildSystemPrompt(mode: CampaignMode): string {
  return SYSTEM_PROMPT.replace("{{MODE_GUIDE}}", MODE_GUIDE[mode]);
}

const MODE_LABEL: Record<CampaignMode, string> = {
  single: "Standalone emails (each independent)",
  sequence: "Follow-up sequence (same prospect, over time)",
  variations: "A/B/C variations (same goal, competing)",
};

export function buildUserPrompt(data: IntakeData): string {
  const icpLines = [
    data.icpTitle && `- Title / role: ${data.icpTitle}`,
    data.icpIndustry && `- Industry: ${data.icpIndustry}`,
    data.icpCompanySize && `- Company size: ${data.icpCompanySize}`,
    data.icpPain && `- Known pain: ${data.icpPain}`,
    data.icpNotes && `- Extra ICP notes: ${data.icpNotes}`,
  ].filter(Boolean).join("\n");

  const emailBlocks = data.emails.map((e, i) => {
    return `--- EMAIL ${i + 1} ---
Subject: ${e.subject || "(no subject)"}
Body:
${e.body}`;
  }).join("\n\n");

  return `SENDER
- Company: ${data.company || "(not given)"}
- Website: ${data.website || "(not given)"}
- What they sell: ${data.offering || "(not given)"}
- Campaign goal: ${data.goal || "(not given)"}

ICP (who these emails are aimed at)
${icpLines || "- (not specified - infer a reasonable buyer)"}

SUBMISSION MODE: ${MODE_LABEL[data.mode]}
Number of emails: ${data.emails.length}

${emailBlocks}

Evaluate through the eyes of the ICP above, follow the mode-specific instructions, and return the full structured JSON analysis.`;
}
