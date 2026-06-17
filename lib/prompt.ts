import type { IntakeData } from "./types";

export const MODEL = process.env.OPENAI_MODEL || "gpt-5.4";

export const SYSTEM_PROMPT = `You are the analysis engine behind Coldscore, a diagnostic tool built by Side Kick — a B2B outbound infrastructure studio. Your job: take ONE cold email plus the sender's ICP (ideal customer profile), and evaluate the email the way the *actual recipient* would read it — a busy, skeptical, time-poor B2B buyer who gets dozens of cold emails a day and deletes most of them in seconds.

Operate by these principles:

1. Be specific to THIS email. Never give advice that could be pasted onto any email ("add personalization", "make it shorter", "add a clear CTA"). Point at exact words and phrases. Quote them.

2. Inhabit the ICP. In the "icp" section you ARE that persona. React in first person. Be honest about the 3-second skim: what the eye catches, where attention dies, the gut feeling, and whether you would actually reply or just archive it.

3. Ground reply estimates in reality. Cold B2B outbound positive-reply rates are usually 1-5%. 5-10% is good. Above 10% is exceptional and rare. Generic or spammy emails sit below 1%. Calibrate honestly — do not inflate.

4. Judge from multiple lenses. Provide reads from at least: "The Skeptic" (assumes you're wasting their time, hunts for reasons to delete), "The Busy Executive" (skims, only cares about relevance and effort-to-value), and "The Deliverability Filter" (spam/primary-inbox risk). Each lens should reach a concrete conclusion.

5. Flag deliverability concretely. Call out spam-trigger words, risky phrasing, link/image load, ALL CAPS, "free"/"guarantee"/"act now", multiple CTAs, walls of text, spintax artifacts, and anything that risks the spam or promotions tab.

6. The rewrite must be genuinely better and ready to send — not a template, not lorem. Keep the sender's real offer and facts. Make it tighter, more relevant to the ICP, and human. Provide 2-3 distinct subject line options.

7. Be brutally honest but useful. No flattery, no filler, no hedging. Most cold emails are mediocre — score conservatively and explain why. Still surface real strengths where they exist.

Scoring scale (0-100): 85+ exceptional, 70-84 strong, 55-69 average/usable, 40-54 weak, below 40 likely deleted on sight. Sub-dimension scores follow the same scale. The deliverability score is "safer = higher".

Constraints on output:
- Provide 5-7 dimensions covering: subject line, relevance to ICP, personalization, value proposition clarity, credibility/proof, call-to-action, and brevity/readability (merge sensibly to land in 5-7).
- Provide exactly the three lenses named above as angles (you may add a fourth only if clearly warranted).
- Provide 3-8 lineNotes. Each excerpt MUST be copied verbatim from the subject or body so it can be located in the original text. Mark its location.
- Provide 3-5 priorityFixes, ranked 1..n by impact.
- Keep prose tight: 1-3 sentences per field, no markdown, no emojis.

Return your complete analysis as a single JSON object that exactly matches the required schema. Every field is mandatory — fill all of them.`;

// JSON Schema for OpenAI Structured Outputs (strict mode).
// Strict mode forbids minimum/maximum/minItems/maxItems and requires every
// object to set additionalProperties:false and list ALL keys in `required`.
// Count/range guidance lives in the system prompt and field descriptions.
export const ANALYSIS_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    overallScore: {
      type: "integer",
      description: "Overall quality of the email, 0-100.",
    },
    grade: {
      type: "string",
      description: "Letter grade matching the overall score, e.g. A, B+, C-.",
    },
    headline: {
      type: "string",
      description:
        "A 2-4 word verdict label, e.g. 'Forgettable but salvageable', 'Instant delete', 'Sharp and relevant'.",
    },
    verdict: {
      type: "string",
      description: "One punchy sentence summarising the email's fate.",
    },
    replyLikelihood: {
      type: "object",
      additionalProperties: false,
      properties: {
        band: {
          type: "string",
          enum: ["Very Low", "Low", "Moderate", "Strong", "High"],
        },
        range: {
          type: "string",
          description: "Estimated positive-reply rate range, e.g. '2-4%'.",
        },
        rationale: {
          type: "string",
          description: "Why this reply-rate band, in one sentence.",
        },
      },
      required: ["band", "range", "rationale"],
    },
    icp: {
      type: "object",
      additionalProperties: false,
      description:
        "The email seen through the ICP's eyes. Written in first person as that persona.",
      properties: {
        persona: {
          type: "string",
          description:
            "The specific persona you are imagining reading this (title + context).",
        },
        secondsToDecision: {
          type: "string",
          description: "How fast they decide, e.g. '~3s', '8s'.",
        },
        firstReaction: {
          type: "string",
          description:
            "First-person gut reaction in the first few seconds of skimming.",
        },
        readThrough: {
          type: "string",
          description:
            "First-person narrative of how they actually read (or skip through) the email.",
        },
        landsWell: {
          type: "array",
          items: { type: "string" },
          description: "What genuinely lands with this persona.",
        },
        dropsOff: {
          type: "array",
          items: { type: "string" },
          description: "Exact moments attention drops or trust breaks.",
        },
        wouldReply: {
          type: "boolean",
          description: "Would this persona actually reply?",
        },
        replyReasoning: {
          type: "string",
          description: "Why they would or wouldn't reply.",
        },
        feeling: {
          type: "string",
          description:
            "Short emotional read, e.g. 'mildly curious', 'annoyed', 'pitched-at'.",
        },
      },
      required: [
        "persona",
        "secondsToDecision",
        "firstReaction",
        "readThrough",
        "landsWell",
        "dropsOff",
        "wouldReply",
        "replyReasoning",
        "feeling",
      ],
    },
    dimensions: {
      type: "array",
      description:
        "5 to 7 scoring dimensions covering subject line, relevance to ICP, personalization, value-prop clarity, credibility/proof, CTA, and brevity/readability (merged sensibly).",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string", description: "Short stable id, e.g. 'subject'." },
          label: { type: "string", description: "Human label, e.g. 'Subject line'." },
          score: { type: "integer", description: "0-100." },
          status: {
            type: "string",
            enum: ["strong", "ok", "weak", "critical"],
          },
          summary: { type: "string", description: "1-2 sentence justification." },
        },
        required: ["key", "label", "score", "status", "summary"],
      },
    },
    angles: {
      type: "array",
      description:
        "Exactly the three named lenses (The Skeptic, The Busy Executive, The Deliverability Filter); a fourth only if clearly warranted.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          lens: { type: "string" },
          read: { type: "string" },
        },
        required: ["lens", "read"],
      },
    },
    lineNotes: {
      type: "array",
      description:
        "3 to 8 notes. Each excerpt MUST be copied verbatim from the subject or body so it can be located in the original text.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          excerpt: {
            type: "string",
            description:
              "Verbatim phrase copied from the email so it can be highlighted in place.",
          },
          location: { type: "string", enum: ["subject", "body"] },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          issue: { type: "string" },
          suggestion: { type: "string" },
        },
        required: ["excerpt", "location", "severity", "issue", "suggestion"],
      },
    },
    deliverability: {
      type: "object",
      additionalProperties: false,
      properties: {
        score: {
          type: "integer",
          description: "Inbox-safety score 0-100, higher = safer.",
        },
        triggers: {
          type: "array",
          items: { type: "string" },
          description: "Specific spam/deliverability risks found.",
        },
        note: { type: "string" },
      },
      required: ["score", "triggers", "note"],
    },
    strengths: {
      type: "array",
      items: { type: "string" },
      description: "Genuine strengths worth keeping.",
    },
    priorityFixes: {
      type: "array",
      description: "3 to 5 fixes, ranked 1..n by impact.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          rank: { type: "integer" },
          fix: { type: "string" },
          impact: { type: "string", enum: ["high", "medium", "low"] },
          why: { type: "string" },
        },
        required: ["rank", "fix", "impact", "why"],
      },
    },
    rewrite: {
      type: "object",
      additionalProperties: false,
      properties: {
        subjectOptions: {
          type: "array",
          items: { type: "string" },
          description: "2 to 3 distinct subject line options.",
        },
        body: {
          type: "string",
          description: "A ready-to-send rewritten email body.",
        },
        rationale: {
          type: "string",
          description: "What changed and why, in 1-2 sentences.",
        },
      },
      required: ["subjectOptions", "body", "rationale"],
    },
  },
  required: [
    "overallScore",
    "grade",
    "headline",
    "verdict",
    "replyLikelihood",
    "icp",
    "dimensions",
    "angles",
    "lineNotes",
    "deliverability",
    "strengths",
    "priorityFixes",
    "rewrite",
  ],
};

export function buildUserPrompt(data: IntakeData): string {
  const icpLines = [
    data.icpTitle && `Target title / persona: ${data.icpTitle}`,
    data.icpIndustry && `Target industry / market: ${data.icpIndustry}`,
    data.icpCompanySize && `Target company size: ${data.icpCompanySize}`,
    data.icpPain && `Core pain they solve: ${data.icpPain}`,
    data.icpNotes && `Additional ICP detail: ${data.icpNotes}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `Analyse the cold email below for this sender.

=== SENDER ===
Company: ${data.company || "(not given)"}
${data.website ? `Website: ${data.website}` : ""}
What they sell: ${data.offering || "(not given)"}
Campaign goal: ${data.goal || "(not given)"}

=== IDEAL CUSTOMER PROFILE (the recipient) ===
${icpLines || "(no ICP details supplied — infer a reasonable B2B buyer)"}

=== COLD EMAIL UNDER TEST ===
SUBJECT: ${data.subject || "(no subject line provided)"}

BODY:
${data.body}

=== END ===

Evaluate it through the eyes of the ICP above, from every angle, and return the full analysis as the structured JSON object.`;
}
