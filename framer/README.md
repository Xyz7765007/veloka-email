# Coldscore — Framer code component

`Coldscore.tsx` is the full Coldscore app packaged as a **single Framer code
component**. The entire end-user flow — Hero → intake wizard → scanning →
report + branded PDF — is ported verbatim, with the original design preserved
pixel-for-pixel. The compiled Tailwind CSS is embedded and fully scoped to a
`.cs-root` wrapper (Tailwind `important: ".cs-root"` + preflight disabled), so
every rule stays inside the component and nothing leaks onto — or is broken by —
the surrounding Framer page.

## How env variables are handled

Framer components run only in the browser, so **no secret ever lives in this
component**. Scoring stays on your deployed Next.js app: the component POSTs to
`${apiBaseUrl}/api/score`, and the server there reads `OPENAI_API_KEY` (and the
optional Airtable vars) from Vercel. Nothing sensitive is shipped to Framer.

| Secret | Lives in | Never in |
|--------|----------|----------|
| `OPENAI_API_KEY` | Vercel env of the deployed app | ❌ the Framer bundle |
| `AIRTABLE_*` | Vercel env of the deployed app | ❌ the Framer bundle |

## Setup (once)

1. **Deploy the app** (this repo) to Vercel with `OPENAI_API_KEY` set, as usual.
2. **Add CORS.** This repo now ships `middleware.ts` (repo root) which allows
   cross-origin calls to `/api/*` and answers preflight requests. It is additive
   — it does not modify `app/api/score/route.ts`. Deploy it once so Framer (a
   different origin) can reach `/api/score`.
3. **Create per-prospect access links.** The scorer gates non-admin requests
   behind a client link with a small scoring quota (default 3) so recipients
   can't spam it. Create one link per prospect in the admin console and send it
   to them — the Framer page is where they *paste* it (see below). You do **not**
   hard-code a slug into the component.

## Add to Framer

1. In Framer: **Assets → Code → +** and paste `Coldscore.tsx` (or drag the file
   in). It appears as a component named **Coldscore**.
2. Drop it on a **full-page frame** (the app owns the whole viewport — it uses
   fixed ambient backgrounds and `100vh` sections).
3. In the properties panel set:
   - **API base URL** — your deployed app, e.g. `https://veloka-email.vercel.app`
     (no trailing slash needed).
   - **Access link slug** — leave **blank**. It's an optional prefill for your
     own testing only; in normal use each prospect pastes their own link.
   - **Client name / Company / Book-a-call URL / Site URL** — optional brand
     overrides (default to Side Kick / get-sidekick.com).

## How prospects use it

The hero has a **"Received a link from us? Paste it here"** box. The prospect
pastes the link you sent them (either the full URL like
`https://veloka-email.vercel.app/veloka-x7k2` or just the `veloka-x7k2` code) —
the component extracts the slug and scores against **their** quota. So the page
never holds a slug that goes stale, and links can't be spammed by strangers.

Two more entry points on the hero:
- **See a sample report** — loads a prefilled simulation (the Acme specimen
  scoring 31/100) so a prospect with no link still sees the full value, without
  spending a scan.
- **No link yet? Request access** — links to your book-a-call URL for opt-in.

The scan runs against your backend; quota exhaustion and errors are handled by
the built-in screens, and the PDF report is generated client-side (jsPDF is
loaded lazily only when someone downloads it).

## Repo integration note

This file lives inside the Next.js project but is **not** part of the app — it
imports the `framer` package, which only exists in Framer's runtime. So
`framer/` is added to `exclude` in `tsconfig.json`; otherwise `next build`'s
type-check fails with *"Cannot find module 'framer'"*. Keep that exclude in
place. Nothing in the app imports this component.

## Dependencies

Framer resolves these automatically — no action needed:
`framer-motion`, `lucide-react`, and `jspdf` (lazy, download-only).

## Rebuilding the embedded CSS

The design is frozen into `Coldscore.tsx` as a compiled CSS string. If you
change any component styling and want to refresh it:

```bash
npx tailwindcss -c tailwind.framer.cjs -i framer/_input.css -o framer/coldscore.raw.css
# then paste the result into the COLDSCORE_CSS constant in Coldscore.tsx.
# The config uses `important: ".cs-root"` + `corePlugins.preflight: false`,
# so every rule is already scoped to the .cs-root wrapper — no post-processing.
```

`tailwind.framer.cjs` and `framer/_input.css` are the build inputs kept
alongside the component for exactly this.
