import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  MODEL,
  buildSystemPrompt,
  ANALYSIS_SCHEMA,
  buildUserPrompt,
} from "@/lib/prompt";
import type { Analysis, IntakeData } from "@/lib/types";
import { saveScan } from "@/lib/airtable";
import { isAdminRequest } from "@/lib/auth";
import { getClient, recordUsage, type ClientRecord } from "@/lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Scoring engine isn't configured. Add OPENAI_API_KEY to your environment variables and redeploy.",
      },
      { status: 500 }
    );
  }

  let data: IntakeData & { clientSlug?: string };
  try {
    data = (await req.json()) as IntakeData & { clientSlug?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    !data?.emails ||
    !Array.isArray(data.emails) ||
    data.emails.length === 0 ||
    !data.emails.some((e) => e?.body && e.body.trim().length >= 20)
  ) {
    return NextResponse.json(
      { error: "Please add at least one email with a body of 20+ characters." },
      { status: 400 }
    );
  }

  // Normalise: keep at most 3 emails that actually have content.
  data.emails = data.emails
    .filter((e) => e && (e.body?.trim() || e.subject?.trim()))
    .slice(0, 3);
  if (!data.mode) data.mode = "single";

  // ---- access + quota gate (the ONLY place OpenAI credits are spent) ----
  // Team requests (valid access cookie) are unlimited. Everyone else must
  // present a valid client link whose remaining quota covers this submission.
  const admin = isAdminRequest(req);
  let client: ClientRecord | null = null;
  if (!admin) {
    const slug = (data.clientSlug || "").trim();
    if (!slug) {
      return NextResponse.json(
        { error: "This scorer requires a valid access link." },
        { status: 401 }
      );
    }
    client = await getClient(slug);
    if (!client || client.status === "disabled") {
      return NextResponse.json(
        { error: "This link is invalid or has been disabled." },
        { status: 403 }
      );
    }
    if (client.remaining <= 0) {
      return NextResponse.json(
        {
          error: "This link has used all of its email scoring.",
          quota: { used: client.used, quota: client.quota, remaining: 0 },
        },
        { status: 403 }
      );
    }
    if (data.emails.length > client.remaining) {
      return NextResponse.json(
        {
          error: `This link has ${client.remaining} email${
            client.remaining === 1 ? "" : "s"
          } of scoring left. Reduce the number of emails and try again.`,
          quota: { used: client.used, quota: client.quota, remaining: client.remaining },
        },
        { status: 403 }
      );
    }
  }

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt(data.mode) },
        { role: "user", content: buildUserPrompt(data) },
      ],
      // Structured Outputs: the response is constrained to exactly match the schema.
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "coldscore_analysis",
          strict: true,
          schema: ANALYSIS_SCHEMA,
        },
      },
    });

    const choice = completion.choices?.[0];

    // Structured Outputs may return a refusal instead of content.
    if (choice?.message?.refusal) {
      return NextResponse.json(
        {
          error:
            "The model declined to analyse this input. Try a different email.",
        },
        { status: 422 }
      );
    }

    // Surface filter / truncation reasons with clearer messages.
    if (choice?.finish_reason === "content_filter") {
      return NextResponse.json(
        {
          error:
            "This input was blocked by the model's safety filter. Try a different email.",
        },
        { status: 422 }
      );
    }
    if (choice?.finish_reason === "length") {
      return NextResponse.json(
        {
          error:
            "The analysis was cut off before it finished. Try again, or shorten a very long email.",
        },
        { status: 502 }
      );
    }

    const content = choice?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "The scoring engine returned an empty response. Try again." },
        { status: 502 }
      );
    }

    let analysis: unknown;
    try {
      analysis = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "The scoring engine returned malformed data. Try again." },
        { status: 502 }
      );
    }

    // Best-effort persistence to Airtable with the FULL analysis (incl. full
    // rewrites). Never blocks or fails the scan.
    const persisted = await saveScan(data, analysis as Analysis, MODEL, client?.slug);

    // The scan succeeded — decrement the client's quota (team is unlimited).
    if (client) {
      await recordUsage(client, data.emails.length);
    }

    // Gate the rewrite for the client: subjects stay full, the rewritten body
    // is truncated to a teaser so the full value sits behind a booked call.
    gateForClient(analysis);

    const remaining = client
      ? Math.max(0, client.remaining - data.emails.length)
      : null;

    return NextResponse.json({ analysis, saved: persisted.saved, remaining });
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status?: number }).status
        : undefined;

    let msg = "The scan couldn't complete. Please try again in a moment.";
    if (status === 401) {
      msg = "The API key was rejected. Check OPENAI_API_KEY in your environment.";
    } else if (status === 429) {
      msg =
        "Rate limit or quota reached on the scoring engine. Wait a moment and try again.";
    } else if (status === 400) {
      msg =
        "The scoring request was rejected — this usually means the configured model doesn't support structured outputs. Try gpt-5.4 or another current model.";
    } else if (status === 404) {
      msg =
        "The configured model wasn't found. Check OPENAI_MODEL (e.g. gpt-5.4).";
    }

    return NextResponse.json(
      { error: msg },
      { status: typeof status === "number" ? status : 502 }
    );
  }
}

// --- rewrite gating -------------------------------------------------
function teaser(body: string): string {
  const max = Math.min(Math.max(Math.floor(body.length * 0.45), 90), 260);
  if (body.length <= max) return body;
  let cut = body.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 60) cut = cut.slice(0, lastSpace);
  return cut.trimEnd() + "…";
}

function gateForClient(analysis: unknown): void {
  if (!analysis || typeof analysis !== "object") return;
  const emails = (analysis as { emails?: unknown }).emails;
  if (!Array.isArray(emails)) return;
  for (const e of emails) {
    const rw = (e as { rewrite?: Record<string, unknown> })?.rewrite;
    if (rw && typeof rw.body === "string") {
      if (rw.body.trim().length > 60) {
        rw.body = teaser(rw.body);
        rw.bodyLocked = true;
      } else {
        rw.bodyLocked = false;
      }
    }
  }
}
