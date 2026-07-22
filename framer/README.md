# Coldscore — Framer code component

`Coldscore.tsx` is the full Coldscore app packaged as a **single Framer code
component**. The entire end-user flow — Hero → intake wizard → scanning →
report + branded PDF — is ported verbatim, with the original design preserved
pixel-for-pixel (the compiled Tailwind CSS is embedded and rendered inside a
Shadow DOM so it can neither leak into nor be broken by the Framer page).

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
3. **Create an access link.** The scorer gates non-admin requests behind a
   client link with a scoring quota. Open the app's admin console, create a link
   for this Framer placement, and copy its **slug** (e.g. `veloka`).

## Add to Framer

1. In Framer: **Assets → Code → +** and paste `Coldscore.tsx` (or drag the file
   in). It appears as a component named **Coldscore**.
2. Drop it on a **full-page frame** (the app owns the whole viewport — it uses
   fixed ambient backgrounds and `100vh` sections).
3. In the properties panel set:
   - **API base URL** — your deployed app, e.g. `https://veloka-email.vercel.app`
     (no trailing slash needed).
   - **Access link slug** — the slug from step 3 above.
   - **Client name / Company / Book-a-call URL / Site URL** — optional brand
     overrides (default to Side Kick / get-sidekick.com).

That's it. The scan runs against your backend; quota exhaustion and errors are
handled by the built-in screens, and the PDF report is generated client-side
(jsPDF is loaded lazily only when someone downloads it).

## Dependencies

Framer resolves these automatically — no action needed:
`framer-motion`, `lucide-react`, and `jspdf` (lazy, download-only).

## Rebuilding the embedded CSS

The design is frozen into `Coldscore.tsx` as a compiled CSS string. If you
change any component styling and want to refresh it:

```bash
npx tailwindcss -c tailwind.framer.cjs -i framer/_input.css -o framer/coldscore.raw.css
# then remap the custom :root block to the shadow tree and re-inject:
#   :root {   →   :host, .cs-root {
# and paste the result into the COLDSCORE_CSS constant in Coldscore.tsx
```

`tailwind.framer.cjs` and `framer/_input.css` are the build inputs kept
alongside the component for exactly this.
