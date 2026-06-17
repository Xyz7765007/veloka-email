# Coldscore — by Side Kick

**Read your cold email the way your prospect does.**

Coldscore is a diagnostic web app that scores a cold email from the point of view of the prospect's ICP. A user enters their company, ICP, and offer, pastes the email, and gets a deep, multi-angle analysis — an ICP first-person read, a line-by-line markup, dimension scores, deliverability flags, priority fixes, and a suggested rewrite — all downloadable as a branded PDF.

Built with Next.js (App Router) + TypeScript + Tailwind + Framer Motion. Scoring runs server-side via the OpenAI API.

---

## 1. What you need

- **Node.js 18.17+** (Node 20+ recommended)
- An **OpenAI API key** — this is the only secret the app requires. Get one at https://platform.openai.com/api-keys.

---

## 2. Run it locally

```bash
npm install
cp .env.example .env.local      # then edit .env.local and add your key
npm run dev
```

Open http://localhost:3000.

`.env.local` must contain:

```
OPENAI_API_KEY=sk-...
# optional — defaults to gpt-5.4:
# OPENAI_MODEL=gpt-5.4
```

Without `OPENAI_API_KEY`, the UI loads fully but the scan returns a clear "scoring isn't configured" error instead of a report.

---

## 3. Deploy to Vercel (GitHub → Vercel)

**Step 1 — push to GitHub**

```bash
git init
git add .
git commit -m "Coldscore initial"
git branch -M main
git remote add origin https://github.com/<you>/coldscore.git
git push -u origin main
```

**Step 2 — import to Vercel**

1. Go to https://vercel.com/new and import the repo.
2. Framework preset auto-detects **Next.js** — leave the defaults.
3. Before deploying, open **Settings → Environment Variables** and add:

   | Name | Required? | Value |
   |------|-----------|-------|
   | `OPENAI_API_KEY` | **Yes** | your `sk-...` key |
   | `OPENAI_MODEL` | optional | scoring model, defaults to `gpt-5.4` |
   | `AIRTABLE_API_KEY` | optional | Airtable PAT (`pat...`) — saves scans; add `schema.bases:*` scopes to auto-create the table (see §6) |
   | `AIRTABLE_BASE_ID` | optional | the Airtable base (`app...`) to write into |
   | `AIRTABLE_TABLE_NAME` | optional | table name, defaults to `Scans` |

   The three Airtable variables are only needed if you want every scan saved (see §6). Without them, scoring works exactly the same — nothing is persisted.

4. Click **Deploy**.

> ⚠️ **The one thing you must not skip:** set `OPENAI_API_KEY` in Vercel. Everything else (UI, flow, PDF) works out of the box, but the scan needs the key. If you add it after the first deploy, trigger a redeploy so it takes effect.

The scoring route is configured for up to 60s of execution (`maxDuration = 60`), which fits Vercel's defaults.

---

## 4. How it's wired

```
app/
  page.tsx            phase state machine (hero → intake → scanning → report / error)
  api/score/route.ts  server route → OpenAI (Structured Outputs = guaranteed JSON)
  layout.tsx          fonts + metadata
  globals.css         ambient field, grain, scan-beam keyframes
components/
  Hero · Wizard · Scanning · Report · EmailMarkup · ui · Background · Wordmark
lib/
  prompt.ts           system prompt + analysis JSON schema + user prompt builder
  types.ts            IntakeData + Analysis contracts
  score.ts            shared color / label helpers
  pdf.ts              client-side jsPDF report generator
  airtable.ts         best-effort persistence of each scan (optional)
```

The scan animation enforces a minimum on-screen time and the report only appears once **both** the animation and the API call have finished, so the experience never flickers or feels fake.

---

## 5. Swapping the model / provider

All scoring logic is isolated in **`app/api/score/route.ts`** and **`lib/prompt.ts`**.

- To change the model, set `OPENAI_MODEL` (no code change). Use any current model that supports Structured Outputs (e.g. `gpt-5.4`, `gpt-5.4-mini`).
- The scan uses OpenAI **Structured Outputs** (`response_format: { type: "json_schema", strict: true }`) so the model's reply is constrained to exactly match `ANALYSIS_SCHEMA` in `lib/prompt.ts`. To move to another provider, replace the single `openai.chat.completions.create(...)` call in `route.ts` and map `ANALYSIS_SCHEMA` to that provider's structured-output format, returning the same `Analysis` shape. Nothing else in the app changes.

---

## 6. Saving scans to Airtable (optional)

If `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` are set, every completed scan is written as one row holding **all inputs and all outputs**. Persistence is best-effort and **non-blocking** — if Airtable is down or misconfigured, the user still gets their report; the save just fails into the server logs.

### Setup — zero manual schema (≈1 min)

The app **creates the table and all its fields for you** on the first scan. You only provide a token and a base.

1. Create (or pick) a base in Airtable. Copy its base ID — the `app...` part of the URL — into `AIRTABLE_BASE_ID`.
2. Create a **Personal Access Token** at https://airtable.com/create/tokens, grant it access to that base, and give it these scopes:
   - `data.records:write` — to save scans
   - `schema.bases:read` and `schema.bases:write` — to auto-create the table & fields
   That token is your `AIRTABLE_API_KEY`.
3. (Optional) Set `AIRTABLE_TABLE_NAME` if you want something other than `Scans`.
4. Add the variables in Vercel and redeploy. Run one scan — the `Scans` table appears, fully built.

On every run the app checks the schema and creates anything missing (a brand-new table, or just the fields you don't have yet), so it self-heals if you rename or delete a column. This is cached per instance and throttled, so it doesn't re-run or hit rate limits on normal traffic.

### If you'd rather not grant schema scopes

Auto-creation needs `schema.bases:*`. Without those scopes the app **still saves** — it just can't build the schema, so create the table yourself (named `Scans`, or your `AIRTABLE_TABLE_NAME`). Only two fields are strictly required; together they hold the complete record:

| Field | Type |
|-------|------|
| `Inputs JSON` | Long text |
| `Analysis JSON` | Long text |

The app writes a richer row when these columns also exist (created automatically when schema scopes are granted), and falls back to just the two JSON fields if a column is missing — so a mismatch never loses data:

`Company` · `Website` · `Offering` · `Goal` · `ICP Title` · `ICP Industry` · `ICP Company Size` · `ICP Pain` · `ICP Notes` · `Subject` · `Email Body` (text) — `Overall Score` · `Deliverability Score` (number) — `Would Reply` (checkbox) — `Grade` · `Headline` · `Verdict` · `Reply Likelihood` · `Reply Range` · `Model` (text).

Tip: add a **Created time** field in Airtable's UI for automatic timestamps — it's computed, so the app doesn't (and can't) set it via the API.

To use a different store (Postgres, Sheets, a webhook, etc.), replace the single `saveScan(...)` call in `app/api/score/route.ts`; the shape passed in is `(intake, analysis, model)`. All schema/write logic lives in `lib/airtable.ts`.

---

## 7. Notes

- No auth, no database to run — each scan is stateless. The PDF is generated entirely in the browser. (Airtable persistence in §6 is optional and off unless its env vars are set.)
- Reduced-motion is respected (`prefers-reduced-motion`).
- Fonts: Space Grotesk / Hanken Grotesk / JetBrains Mono via `next/font` (self-hosted at build, no runtime fetch).
