import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  MODEL,
  SYSTEM_PROMPT,
  ANALYSIS_SCHEMA,
  buildUserPrompt,
} from "@/lib/prompt";
import type { Analysis, IntakeData } from "@/lib/types";
import { saveScan } from "@/lib/airtable";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  let data: IntakeData;
  try {
    data = (await req.json()) as IntakeData;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!data?.body || data.body.trim().length < 20) {
    return NextResponse.json(
      { error: "Please paste an email body of at least 20 characters." },
      { status: 400 }
    );
  }

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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

    // Best-effort persistence to Airtable. Never blocks or fails the scan:
    // saveScan swallows its own errors and no-ops if Airtable isn't configured.
    const persisted = await saveScan(data, analysis as Analysis, MODEL);

    return NextResponse.json({ analysis, saved: persisted.saved });
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
