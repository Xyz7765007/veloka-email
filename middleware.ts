import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// ─────────────────────────────────────────────────────────────────────────────
// CORS for /api/* — lets the Framer code component (framer/Coldscore.tsx) call
// /api/score from a different origin (framer.com, your published Framer site).
// Purely additive: it does not touch app/api/score/route.ts. Requests carry no
// cookies (the Framer component uses a clientSlug, not the admin session), so a
// wildcard origin is safe.
// ─────────────────────────────────────────────────────────────────────────────

export const config = { matcher: "/api/:path*" }

function corsHeaders(origin: string | null): Record<string, string> {
    return {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
    }
}

export function middleware(req: NextRequest) {
    const origin = req.headers.get("origin")

    // Preflight — answer directly with 204 + CORS headers.
    if (req.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
    }

    // Actual request — let it through, then attach CORS headers to the response.
    const res = NextResponse.next()
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
        res.headers.set(k, v)
    }
    return res
}
