import { NextResponse } from "next/server";
import { isAdminRequest, accessConfigured } from "@/lib/auth";
import {
  clientsConfigured,
  createClient,
  listClients,
} from "@/lib/clients";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originOf(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

function guard(req: Request): NextResponse | null {
  if (!accessConfigured() || !isAdminRequest(req)) {
    return NextResponse.json({ ok: false, error: "Not authorised." }, { status: 401 });
  }
  if (!clientsConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Airtable isn't configured. Add AIRTABLE_API_KEY and AIRTABLE_BASE_ID." },
      { status: 503 }
    );
  }
  return null;
}

export async function GET(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  const clients = await listClients();
  const origin = originOf(req);
  return NextResponse.json({
    ok: true,
    clients: clients.map((c) => ({
      slug: c.slug,
      name: c.name,
      email: c.email,
      company: c.company,
      quota: c.quota,
      used: c.used,
      remaining: c.remaining,
      scans: c.scans,
      status: c.status,
      lastScored: c.lastScored,
      url: origin ? `${origin}/${c.slug}` : `/${c.slug}`,
    })),
  });
}

export async function POST(req: Request) {
  const denied = guard(req);
  if (denied) return denied;

  let body: { name?: string; email?: string; company?: string; quota?: number; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (!body?.name || !body.name.trim()) {
    return NextResponse.json({ ok: false, error: "A client name is required." }, { status: 400 });
  }

  try {
    const rec = await createClient({
      name: body.name,
      email: body.email,
      company: body.company,
      quota: body.quota,
      notes: body.notes,
    });
    const origin = originOf(req);
    return NextResponse.json({
      ok: true,
      client: {
        slug: rec.slug,
        name: rec.name,
        quota: rec.quota,
        url: origin ? `${origin}/${rec.slug}` : `/${rec.slug}`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    const friendly =
      msg === "not_configured"
        ? "Airtable isn't configured."
        : msg === "name_required"
        ? "A client name is required."
        : "Couldn't create the link. Check Airtable access and try again.";
    return NextResponse.json({ ok: false, error: friendly }, { status: 502 });
  }
}
