import type { Analysis, IntakeData } from "@/lib/types";

/**
 * Airtable persistence for Coldscore scans.
 *
 * Highlights:
 * - OPTIONAL: no-ops if AIRTABLE_API_KEY / AIRTABLE_BASE_ID aren't set.
 * - AUTO-SCHEMA: on first use it ensures the table + every field exists,
 *   creating whatever is missing via the Metadata API. Requires the PAT to have
 *   `schema.bases:read` + `schema.bases:write`; if those scopes are absent it
 *   degrades silently (relies on a pre-made table + the write-time fallback).
 * - NON-BLOCKING: nothing here ever throws to the caller. A logging/setup
 *   failure must never break a client's scan.
 * - RESILIENT WRITE: tries the rich field set; on a 422 (schema mismatch) it
 *   retries with just the two JSON columns so the full record is never lost.
 * - RACE / RATE-LIMIT SAFE: schema work is de-duplicated and cached per
 *   instance, table-creation races resolve to a field-diff, and field creation
 *   is throttled under Airtable's 5 req/sec limit.
 */

const API = "https://api.airtable.com/v0";
const meta = (baseId: string) => `${API}/meta/bases/${baseId}/tables`;

type FieldSpec = { name: string; type: string; options?: Record<string, unknown> };

// Single source of truth for the schema. Only rock-solid field types are used
// so a single create-table call never fails on an exotic spec. (Want a
// timestamp? Add a "Created time" field in Airtable's UI — it's zero-config and
// computed fields can't be written via the API anyway.)
const FIELD_SPECS: FieldSpec[] = [
  { name: "Company", type: "singleLineText" }, // first entry = primary field
  { name: "Website", type: "singleLineText" },
  { name: "Offering", type: "multilineText" },
  { name: "Goal", type: "singleLineText" },
  { name: "ICP Title", type: "singleLineText" },
  { name: "ICP Industry", type: "singleLineText" },
  { name: "ICP Company Size", type: "singleLineText" },
  { name: "ICP Pain", type: "multilineText" },
  { name: "ICP Notes", type: "multilineText" },
  { name: "Subject", type: "singleLineText" },
  { name: "Email Body", type: "multilineText" },
  { name: "Overall Score", type: "number", options: { precision: 0 } },
  { name: "Grade", type: "singleLineText" },
  { name: "Headline", type: "singleLineText" },
  { name: "Verdict", type: "multilineText" },
  { name: "Reply Likelihood", type: "singleLineText" },
  { name: "Reply Range", type: "singleLineText" },
  {
    name: "Would Reply",
    type: "checkbox",
    options: { icon: "check", color: "greenBright" },
  },
  { name: "Deliverability Score", type: "number", options: { precision: 0 } },
  { name: "Model", type: "singleLineText" },
  { name: "Inputs JSON", type: "multilineText" },
  { name: "Analysis JSON", type: "multilineText" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function specToField(s: FieldSpec) {
  return s.options
    ? { name: s.name, type: s.type, options: s.options }
    : { name: s.name, type: s.type };
}

/* ------------------------------------------------------------------ */
/* Schema ensuring                                                     */
/* ------------------------------------------------------------------ */

// Per-instance caches (persist across warm serverless invocations).
const schemaReady = new Set<string>();
const schemaSkip = new Set<string>(); // permanent skip (no scope / bad config)
const schemaInflight = new Map<string, Promise<void>>();

type EnsureStatus = "ready" | "skip" | "retry";

interface ATTable {
  id?: string;
  name?: string;
  fields?: { name?: string }[];
}

async function fetchTables(
  baseId: string,
  token: string
): Promise<{ ok: boolean; status: number; tables: ATTable[] }> {
  try {
    const res = await fetch(meta(baseId), { headers: headers(token) });
    if (!res.ok) return { ok: false, status: res.status, tables: [] };
    const data = (await res.json().catch(() => ({}))) as { tables?: ATTable[] };
    return {
      ok: true,
      status: res.status,
      tables: Array.isArray(data?.tables) ? data.tables : [],
    };
  } catch {
    return { ok: false, status: 0, tables: [] };
  }
}

async function ensureFields(
  baseId: string,
  token: string,
  table: ATTable
): Promise<EnsureStatus> {
  const tableId = table.id;
  if (!tableId) return "retry";

  const have = new Set(
    (table.fields || []).map((f) => f?.name).filter(Boolean) as string[]
  );
  const missing = FIELD_SPECS.filter((f) => !have.has(f.name));
  if (missing.length === 0) return "ready";

  const url = `${meta(baseId)}/${tableId}/fields`;
  for (const spec of missing) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify(specToField(spec)),
      });
    } catch (e) {
      console.error(`[airtable] field create network error '${spec.name}':`, e);
      return "retry";
    }

    if (res.ok) {
      // created
    } else if (res.status === 401 || res.status === 403) {
      console.warn(
        `[airtable] cannot create field '${spec.name}' — token lacks schema.bases:write.`
      );
      return "skip";
    } else if (res.status === 422) {
      // Already exists, or a duplicate/uncreatable spec — non-fatal.
      const d = await res.text().catch(() => "");
      console.warn(`[airtable] field '${spec.name}' not created (422): ${d}`);
    } else {
      console.error(
        `[airtable] field '${spec.name}' create failed ${res.status}`
      );
    }
    await sleep(220); // stay under 5 req/sec per base
  }
  return "ready";
}

async function doEnsureSchema(
  baseId: string,
  token: string,
  table: string
): Promise<EnsureStatus> {
  // 1) list tables
  const list = await fetchTables(baseId, token);
  if (!list.ok) {
    if (list.status === 401 || list.status === 403) {
      console.warn(
        `[airtable] schema auto-setup skipped — token lacks schema scopes (status ${list.status}). ` +
          `Add 'schema.bases:read' and 'schema.bases:write' to the PAT, or create the '${table}' table manually.`
      );
      return "skip";
    }
    if (list.status === 404) {
      console.warn(
        `[airtable] base '${baseId}' not found (404). Check AIRTABLE_BASE_ID.`
      );
      return "skip";
    }
    console.error(`[airtable] meta list failed (status ${list.status}).`);
    return "retry";
  }

  const existing = list.tables.find(
    (t) => t?.name === table || t?.id === table
  );

  // 2a) table exists → make sure all fields exist
  if (existing) return ensureFields(baseId, token, existing);

  // 2b) create the table with the full field set (one call)
  let createRes: Response;
  try {
    createRes = await fetch(meta(baseId), {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        name: table,
        description: "Coldscore — saved cold-email scans (inputs + outputs).",
        fields: FIELD_SPECS.map(specToField),
      }),
    });
  } catch (e) {
    console.error("[airtable] table create network error:", e);
    return "retry";
  }

  if (createRes.ok) return "ready";

  if (createRes.status === 401 || createRes.status === 403) {
    console.warn(
      `[airtable] cannot create table '${table}' — token lacks schema.bases:write.`
    );
    return "skip";
  }

  if (createRes.status === 422) {
    // Likely a race: another invocation created it first. Re-list and diff.
    const detail = await createRes.text().catch(() => "");
    const relist = await fetchTables(baseId, token);
    const now = relist.tables.find((t) => t?.name === table || t?.id === table);
    if (now) return ensureFields(baseId, token, now);
    console.error(
      `[airtable] table create 422 and table still absent (possible spec issue): ${detail}`
    );
    return "skip";
  }

  console.error(`[airtable] table create failed ${createRes.status}.`);
  return "retry";
}

async function ensureSchema(
  baseId: string,
  token: string,
  table: string
): Promise<void> {
  const key = `${baseId}::${table}`;
  if (schemaReady.has(key) || schemaSkip.has(key)) return;

  let inflight = schemaInflight.get(key);
  if (!inflight) {
    inflight = doEnsureSchema(baseId, token, table)
      .then((status) => {
        if (status === "ready") schemaReady.add(key);
        else if (status === "skip") schemaSkip.add(key);
        // "retry": leave uncached so a later request can try again
      })
      .catch((e) => {
        console.error("[airtable] ensureSchema error:", e);
      })
      .finally(() => {
        schemaInflight.delete(key);
      });
    schemaInflight.set(key, inflight);
  }
  await inflight;
}

/* ------------------------------------------------------------------ */
/* Record write                                                        */
/* ------------------------------------------------------------------ */

type SaveResult = { saved: boolean; error?: string };

function richFields(
  intake: IntakeData,
  analysis: Analysis,
  model: string
): Record<string, unknown> {
  return {
    Company: intake.company || "",
    Website: intake.website || "",
    Offering: intake.offering || "",
    Goal: intake.goal || "",
    "ICP Title": intake.icpTitle || "",
    "ICP Industry": intake.icpIndustry || "",
    "ICP Company Size": intake.icpCompanySize || "",
    "ICP Pain": intake.icpPain || "",
    "ICP Notes": intake.icpNotes || "",
    Subject: intake.subject || "",
    "Email Body": intake.body || "",
    "Overall Score": analysis.overallScore,
    Grade: analysis.grade,
    Headline: analysis.headline,
    Verdict: analysis.verdict,
    "Reply Likelihood": analysis.replyLikelihood?.band || "",
    "Reply Range": analysis.replyLikelihood?.range || "",
    "Would Reply": Boolean(analysis.icp?.wouldReply),
    "Deliverability Score": analysis.deliverability?.score ?? null,
    Model: model,
    "Inputs JSON": JSON.stringify(intake, null, 2),
    "Analysis JSON": JSON.stringify(analysis, null, 2),
  };
}

function coreFields(
  intake: IntakeData,
  analysis: Analysis
): Record<string, unknown> {
  return {
    "Inputs JSON": JSON.stringify(intake, null, 2),
    "Analysis JSON": JSON.stringify(analysis, null, 2),
  };
}

async function postRecord(
  baseId: string,
  table: string,
  token: string,
  fields: Record<string, unknown>
): Promise<Response> {
  return fetch(`${API}/${baseId}/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
}

export async function saveScan(
  intake: IntakeData,
  analysis: Analysis,
  model: string
): Promise<SaveResult> {
  const token = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || "Scans";

  if (!token || !baseId) return { saved: false };

  // Best-effort: create/repair the table + fields. Never throws.
  await ensureSchema(baseId, token, table);

  try {
    let res = await postRecord(
      baseId,
      table,
      token,
      richFields(intake, analysis, model)
    );

    if (!res.ok && res.status === 422) {
      const detail = await res.text().catch(() => "");
      console.warn(
        `[airtable] rich write rejected (422), retrying with core fields. detail: ${detail}`
      );
      res = await postRecord(baseId, table, token, coreFields(intake, analysis));
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[airtable] save failed ${res.status}: ${detail}`);
      return { saved: false, error: `airtable_${res.status}` };
    }

    return { saved: true };
  } catch (err) {
    console.error("[airtable] save error:", err);
    return { saved: false, error: "airtable_network" };
  }
}
