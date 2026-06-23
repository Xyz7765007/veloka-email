import { randomBytes } from "crypto";

/**
 * Airtable "Clients" table — the per-lead quota ledger.
 *
 * One row per client link. The scoring route reads a client's quota before
 * spending any OpenAI credits and records usage after a successful scan, so a
 * shared link can never exceed its cap. Reads fail CLOSED (an error or missing
 * config yields no client, which the caller treats as "no access") so a hiccup
 * can't be used to drain credits.
 */

const API = "https://api.airtable.com/v0";
const metaUrl = (baseId: string) => `${API}/meta/bases/${baseId}/tables`;

type FieldSpec = { name: string; type: string; options?: Record<string, unknown> };

const FIELDS: FieldSpec[] = [
  { name: "Slug", type: "singleLineText" }, // primary — the URL token
  { name: "Client Name", type: "singleLineText" },
  { name: "Email", type: "singleLineText" },
  { name: "Company", type: "singleLineText" },
  { name: "Quota", type: "number", options: { precision: 0 } },
  { name: "Emails Used", type: "number", options: { precision: 0 } },
  { name: "Scans", type: "number", options: { precision: 0 } },
  { name: "Status", type: "singleLineText" }, // active | exhausted | disabled
  { name: "Last Scored", type: "singleLineText" },
  { name: "Created", type: "singleLineText" },
  { name: "Notes", type: "multilineText" },
];

const DEFAULT_QUOTA = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cfg() {
  const token = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_CLIENTS_TABLE || "Clients";
  return { token, baseId, table };
}

export function clientsConfigured(): boolean {
  const { token, baseId } = cfg();
  return Boolean(token && baseId);
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}
function specToField(s: FieldSpec) {
  return s.options ? { name: s.name, type: s.type, options: s.options } : { name: s.name, type: s.type };
}

/* ---------------- types ---------------- */
export interface ClientRecord {
  id: string;
  slug: string;
  name: string;
  email: string;
  company: string;
  quota: number;
  used: number;
  scans: number;
  status: string; // active | exhausted | disabled
  remaining: number;
  lastScored: string;
  created: string;
}

/* ---------------- schema ensure ---------------- */
const schemaReady = new Set<string>();
const schemaSkip = new Set<string>();
const schemaInflight = new Map<string, Promise<void>>();

interface ATTable {
  id?: string;
  name?: string;
  fields?: { name?: string }[];
}

async function listTables(baseId: string, token: string) {
  try {
    const res = await fetch(metaUrl(baseId), { headers: headers(token) });
    if (!res.ok) return { ok: false, status: res.status, tables: [] as ATTable[] };
    const data = (await res.json().catch(() => ({}))) as { tables?: ATTable[] };
    return { ok: true, status: res.status, tables: Array.isArray(data.tables) ? data.tables : [] };
  } catch {
    return { ok: false, status: 0, tables: [] as ATTable[] };
  }
}

async function ensureFields(baseId: string, token: string, table: ATTable): Promise<boolean> {
  if (!table.id) return false;
  const have = new Set((table.fields || []).map((f) => f?.name).filter(Boolean) as string[]);
  const missing = FIELDS.filter((f) => !have.has(f.name));
  const url = `${metaUrl(baseId)}/${table.id}/fields`;
  for (const spec of missing) {
    try {
      const res = await fetch(url, { method: "POST", headers: headers(token), body: JSON.stringify(specToField(spec)) });
      if (res.status === 401 || res.status === 403) return false;
    } catch {
      return false;
    }
    await sleep(220);
  }
  return true;
}

async function doEnsure(baseId: string, token: string, table: string): Promise<"ready" | "skip"> {
  const list = await listTables(baseId, token);
  if (!list.ok) return "skip"; // no schema scope / bad config → rely on a pre-made table
  const existing = list.tables.find((t) => t?.name === table || t?.id === table);
  if (existing) {
    await ensureFields(baseId, token, existing);
    return "ready";
  }
  try {
    const res = await fetch(metaUrl(baseId), {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({
        name: table,
        description: "Coldscore — client links + per-lead scoring quota.",
        fields: FIELDS.map(specToField),
      }),
    });
    if (res.ok) return "ready";
    if (res.status === 422) {
      const relist = await listTables(baseId, token);
      const now = relist.tables.find((t) => t?.name === table || t?.id === table);
      if (now) {
        await ensureFields(baseId, token, now);
        return "ready";
      }
    }
  } catch {
    /* fall through */
  }
  return "skip";
}

async function ensureSchema(): Promise<void> {
  const { token, baseId, table } = cfg();
  if (!token || !baseId) return;
  const key = `${baseId}::${table}`;
  if (schemaReady.has(key) || schemaSkip.has(key)) return;
  let inflight = schemaInflight.get(key);
  if (!inflight) {
    inflight = doEnsure(baseId, token, table)
      .then((s) => {
        if (s === "ready") schemaReady.add(key);
        else schemaSkip.add(key);
      })
      .catch((e) => console.error("[clients] ensureSchema error:", e))
      .finally(() => schemaInflight.delete(key));
    schemaInflight.set(key, inflight);
  }
  await inflight;
}

/* ---------------- helpers ---------------- */
export function slugify(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 32) || "client";
}

function randToken(n = 4): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const b = randomBytes(n);
  let s = "";
  for (let i = 0; i < n; i++) s += chars[b[i] % chars.length];
  return s;
}

function num(v: unknown, d = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : d;
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

interface ATRecord {
  id?: string;
  fields?: Record<string, unknown>;
}

function toRecord(r: ATRecord): ClientRecord | null {
  if (!r?.id || !r.fields) return null;
  const f = r.fields;
  const quota = num(f["Quota"], DEFAULT_QUOTA);
  const used = num(f["Emails Used"], 0);
  return {
    id: r.id,
    slug: str(f["Slug"]),
    name: str(f["Client Name"]),
    email: str(f["Email"]),
    company: str(f["Company"]),
    quota,
    used,
    scans: num(f["Scans"], 0),
    status: str(f["Status"]) || "active",
    remaining: Math.max(0, quota - used),
    lastScored: str(f["Last Scored"]),
    created: str(f["Created"]),
  };
}

/* ---------------- reads ---------------- */
/** Look up one client by slug. Returns null on any miss/error (fail closed). */
export async function getClient(slug: string): Promise<ClientRecord | null> {
  const { token, baseId, table } = cfg();
  if (!token || !baseId || !slug) return null;
  const safe = slug.replace(/[^a-z0-9-]/gi, "");
  if (!safe) return null;
  const formula = encodeURIComponent(`LOWER({Slug})='${safe.toLowerCase()}'`);
  const url = `${API}/${baseId}/${encodeURIComponent(table)}?filterByFormula=${formula}&maxRecords=1`;
  try {
    const res = await fetch(url, { headers: headers(token) });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { records?: ATRecord[] };
    const rec = data.records?.[0];
    return rec ? toRecord(rec) : null;
  } catch {
    return null;
  }
}

/** List all clients for the admin console (most-recent first by Created text). */
export async function listClients(): Promise<ClientRecord[]> {
  const { token, baseId, table } = cfg();
  if (!token || !baseId) return [];
  const out: ClientRecord[] = [];
  let offset: string | undefined;
  try {
    for (let i = 0; i < 10; i++) {
      const url = new URL(`${API}/${baseId}/${encodeURIComponent(table)}`);
      url.searchParams.set("pageSize", "100");
      if (offset) url.searchParams.set("offset", offset);
      const res = await fetch(url.toString(), { headers: headers(token) });
      if (!res.ok) break;
      const data = (await res.json().catch(() => ({}))) as { records?: ATRecord[]; offset?: string };
      for (const r of data.records || []) {
        const rec = toRecord(r);
        if (rec) out.push(rec);
      }
      offset = data.offset;
      if (!offset) break;
    }
  } catch {
    /* return what we have */
  }
  out.sort((a, b) => (b.created || "").localeCompare(a.created || ""));
  return out;
}

/* ---------------- writes ---------------- */
export interface CreateClientInput {
  name: string;
  email?: string;
  company?: string;
  quota?: number;
  notes?: string;
}

/** Create a new client link. Returns the record, or throws on config/error. */
export async function createClient(input: CreateClientInput): Promise<ClientRecord> {
  const { token, baseId, table } = cfg();
  if (!token || !baseId) throw new Error("not_configured");
  const name = (input.name || "").trim();
  if (!name) throw new Error("name_required");
  await ensureSchema();

  // unique slug: base-name + short token, regenerate on the rare collision
  const base = slugify(name);
  let slug = `${base}-${randToken(4)}`;
  for (let i = 0; i < 5; i++) {
    const existing = await getClient(slug);
    if (!existing) break;
    slug = `${base}-${randToken(5)}`;
  }

  const quota = Math.max(1, Math.min(50, Math.round(num(input.quota, DEFAULT_QUOTA))));
  const fields: Record<string, unknown> = {
    Slug: slug,
    "Client Name": name,
    Email: (input.email || "").trim(),
    Company: (input.company || "").trim(),
    Quota: quota,
    "Emails Used": 0,
    Scans: 0,
    Status: "active",
    "Last Scored": "",
    Created: new Date().toISOString(),
    Notes: (input.notes || "").trim(),
  };

  const res = await fetch(`${API}/${baseId}/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[clients] create failed ${res.status}: ${detail}`);
    throw new Error(`airtable_${res.status}`);
  }
  const data = (await res.json().catch(() => ({}))) as { records?: ATRecord[] };
  const rec = data.records?.[0] ? toRecord(data.records[0]) : null;
  if (!rec) throw new Error("create_parse");
  return rec;
}

/** Record consumed emails after a successful scan. Best-effort, retried once. */
export async function recordUsage(client: ClientRecord, emails: number): Promise<void> {
  const { token, baseId, table } = cfg();
  if (!token || !baseId) return;
  const used = client.used + emails;
  const fields: Record<string, unknown> = {
    "Emails Used": used,
    Scans: client.scans + 1,
    "Last Scored": new Date().toISOString(),
    Status: used >= client.quota ? "exhausted" : "active",
  };
  const url = `${API}/${baseId}/${encodeURIComponent(table)}/${client.id}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { method: "PATCH", headers: headers(token), body: JSON.stringify({ fields, typecast: true }) });
      if (res.ok) return;
      console.error(`[clients] recordUsage failed ${res.status}`);
    } catch (e) {
      console.error("[clients] recordUsage error:", e);
    }
    await sleep(200);
  }
}
