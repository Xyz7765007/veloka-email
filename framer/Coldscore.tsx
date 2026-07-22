// Coldscore — by Side Kick · Framer code component
// ─────────────────────────────────────────────────────────────────────────────
// A single-file Framer port of the Coldscore Next.js app. The full UI flow
// (Hero → Wizard → Scanning → Report + PDF) is ported verbatim. Scoring stays
// server-side: this component POSTs to `${apiBaseUrl}/api/score` on your
// deployed app, so the OPENAI_API_KEY (and optional Airtable vars) never enter
// the browser. Configure it from the Framer properties panel.
//
// All original styling is preserved by embedding the compiled Tailwind CSS and
// rendering into a Shadow DOM, so it can neither leak into nor be broken by the
// surrounding Framer page.
//
// Requires (Framer resolves these automatically): framer-motion, lucide-react,
// jspdf (loaded lazily only when a report PDF is downloaded).
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"
import {
    AlertTriangle,
    RotateCcw,
    RefreshCw,
    Lock,
    ArrowUpRight,
    ArrowRight,
    ArrowLeft,
    Eye,
    Crosshair,
    FileDown,
    ScanLine,
    Plus,
    X,
    Mail,
    Layers,
    GitCompare,
    Check,
    Clock,
    Reply,
    ShieldAlert,
    Download,
    Gauge,
    Trophy,
    Lightbulb,
    Copy,
    CheckCheck,
    Sparkles,
} from "lucide-react"

// ============================================================================
// Types  (from lib/types.ts)
// ============================================================================
type CampaignMode = "single" | "sequence" | "variations"
type Status = "strong" | "ok" | "weak" | "critical"
type Severity = "high" | "medium" | "low"
type Impact = "high" | "medium" | "low"
type Band = "Very Low" | "Low" | "Moderate" | "Strong" | "High"

interface EmailInput {
    subject: string
    body: string
}
interface IntakeData {
    company: string
    website: string
    offering: string
    icpTitle: string
    icpIndustry: string
    icpCompanySize: string
    icpPain: string
    icpNotes: string
    goal: string
    mode: CampaignMode
    emails: EmailInput[]
}
interface ReplyLikelihood {
    band: Band
    range: string
    rationale: string
}
interface IcpRead {
    persona: string
    secondsToDecision: string
    firstReaction: string
    readThrough: string
    landsWell: string[]
    dropsOff: string[]
    wouldReply: boolean
    replyReasoning: string
    feeling: string
}
interface Dimension {
    key: string
    label: string
    score: number
    status: Status
    summary: string
}
interface LineNote {
    excerpt: string
    location: "subject" | "body"
    severity: Severity
    issue: string
    suggestion: string
}
interface PriorityFix {
    rank: number
    fix: string
    impact: Impact
    why: string
}
interface Rewrite {
    subjectOptions: string[]
    body: string
    rationale: string
}
interface Deliverability {
    score: number
    triggers: string[]
    note: string
}
interface Angle {
    lens: string
    read: string
}
interface EmailScore {
    label: string
    subject: string
    overallScore: number
    grade: string
    headline: string
    verdict: string
    replyLikelihood: ReplyLikelihood
    icp: IcpRead
    dimensions: Dimension[]
    lineNotes: LineNote[]
    deliverability: Deliverability
    strengths: string[]
    priorityFixes: PriorityFix[]
    rewrite: Rewrite
}
interface Campaign {
    overallScore: number
    grade: string
    headline: string
    verdict: string
    summary: string
    recommendation: string
    modeInsight: string
    winnerLabel: string
    angles: Angle[]
}
interface Analysis {
    mode: CampaignMode
    campaign: Campaign
    emails: EmailScore[]
}

// ============================================================================
// Brand  (from lib/brand.ts) — mutable so Framer props can override at runtime
// ============================================================================
const BRAND = {
    product: "Coldscore",
    company: "Side Kick",
    tagline: "Read your cold email the way your prospect does.",
    signoff: "Give your SDRs a Side Kick.",
    site: "https://get-sidekick.com",
    bookACall: "https://get-sidekick.com/demo#demopage",
    supportEmail: "support@get-sidekick.com",
}
const BRAND_HEX = "#FF6F30"

// ============================================================================
// Score helpers  (from lib/score.ts)
// ============================================================================
const COLORS = {
    good: "#16A34A",
    ok: "#D9831F",
    weak: "#E2622F",
    crit: "#D33A2C",
    gold: "#FF6F30",
    brand: "#FF6F30",
    bone: "#1A1B1E",
    boneDim: "#585E66",
    ink: "#FFFFFF",
}
function scoreColor(score: number): string {
    if (score >= 75) return COLORS.good
    if (score >= 55) return COLORS.ok
    if (score >= 40) return COLORS.weak
    return COLORS.crit
}
function statusColor(status: Status): string {
    switch (status) {
        case "strong":
            return COLORS.good
        case "ok":
            return COLORS.ok
        case "weak":
            return COLORS.weak
        case "critical":
            return COLORS.crit
    }
}
function severityColor(sev: Severity): string {
    switch (sev) {
        case "low":
            return COLORS.ok
        case "medium":
            return COLORS.weak
        case "high":
            return COLORS.crit
    }
}
function impactColor(impact: Impact): string {
    switch (impact) {
        case "high":
            return COLORS.crit
        case "medium":
            return COLORS.weak
        case "low":
            return COLORS.ok
    }
}
function bandColor(band: string): string {
    switch (band) {
        case "High":
        case "Strong":
            return COLORS.good
        case "Moderate":
            return COLORS.ok
        case "Low":
            return COLORS.weak
        default:
            return COLORS.crit
    }
}
function scoreLabel(score: number): string {
    if (score >= 85) return "Exceptional"
    if (score >= 70) return "Strong"
    if (score >= 55) return "Average"
    if (score >= 40) return "Weak"
    return "Critical"
}

// ============================================================================
// Sanitize  (from lib/sanitize.ts)
// ============================================================================
function clampScore(v: unknown): number {
    const n = typeof v === "number" ? v : Number(v)
    if (!Number.isFinite(n)) return 0
    return Math.max(0, Math.min(100, Math.round(n)))
}
function str(v: unknown, fallback = ""): string {
    if (typeof v === "string" && v.trim().length > 0) {
        return v.replace(/\s*[—–]\s*/g, ", ")
    }
    return fallback
}
function arr<T>(v: unknown): T[] {
    return Array.isArray(v) ? (v as T[]) : []
}
function strList(v: unknown): string[] {
    return arr<unknown>(v)
        .map((x) => str(x))
        .filter(Boolean)
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
    return typeof v === "string" && (allowed as readonly string[]).includes(v)
        ? (v as T)
        : fb
}
function obj(v: unknown): Record<string, unknown> {
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {}
}
function isObj(v: unknown): boolean {
    return !!v && typeof v === "object" && !Array.isArray(v)
}
const STATUSES = ["strong", "ok", "weak", "critical"] as const
const SEVERITIES = ["high", "medium", "low"] as const
const IMPACTS = ["high", "medium", "low"] as const
const BANDS = ["Very Low", "Low", "Moderate", "Strong", "High"] as const
const MODES = ["single", "sequence", "variations"] as const

function sReply(v: unknown): ReplyLikelihood {
    const r = obj(v)
    return {
        band: oneOf<Band>(r.band, BANDS, "Low"),
        range: str(r.range, "-"),
        rationale: str(r.rationale),
    }
}
function sIcp(v: unknown): IcpRead {
    const i = obj(v)
    return {
        persona: str(i.persona, "Your prospect"),
        secondsToDecision: str(i.secondsToDecision, "~5s"),
        firstReaction: str(i.firstReaction),
        readThrough: str(i.readThrough),
        landsWell: strList(i.landsWell),
        dropsOff: strList(i.dropsOff),
        wouldReply: Boolean(i.wouldReply),
        replyReasoning: str(i.replyReasoning),
        feeling: str(i.feeling),
    }
}
function sDims(v: unknown): Dimension[] {
    return arr<unknown>(v)
        .filter(isObj)
        .map((dd) => {
            const d = obj(dd)
            return {
                key: str(d.key, "dimension"),
                label: str(d.label, "Dimension"),
                score: clampScore(d.score),
                status: oneOf<Status>(d.status, STATUSES, "ok"),
                summary: str(d.summary),
            }
        })
}
function sNotes(v: unknown): LineNote[] {
    return arr<unknown>(v)
        .filter(isObj)
        .map((nn) => {
            const n = obj(nn)
            return {
                excerpt: str(n.excerpt),
                location: oneOf<"subject" | "body">(
                    n.location,
                    ["subject", "body"],
                    "body"
                ),
                severity: oneOf<Severity>(n.severity, SEVERITIES, "medium"),
                issue: str(n.issue),
                suggestion: str(n.suggestion),
            }
        })
        .filter((n) => n.excerpt.length > 0 || n.issue.length > 0)
}
function sFixes(v: unknown): PriorityFix[] {
    return arr<unknown>(v)
        .filter(isObj)
        .map((ff, i) => {
            const f = obj(ff)
            return {
                rank:
                    typeof f.rank === "number" && Number.isFinite(f.rank)
                        ? f.rank
                        : i + 1,
                fix: str(f.fix),
                impact: oneOf<Impact>(f.impact, IMPACTS, "medium"),
                why: str(f.why),
            }
        })
}
function sRewrite(v: unknown): Rewrite {
    const r = obj(v)
    return {
        subjectOptions: strList(r.subjectOptions),
        body: str(r.body),
        rationale: str(r.rationale),
    }
}
function sAngles(v: unknown): Angle[] {
    return arr<unknown>(v)
        .filter(isObj)
        .map((gg) => {
            const g = obj(gg)
            return { lens: str(g.lens, "Perspective"), read: str(g.read) }
        })
}
function sEmail(v: unknown, idx: number): EmailScore {
    const e = obj(v)
    const d = obj(e.deliverability)
    return {
        label: str(e.label, `Email ${idx + 1}`),
        subject: typeof e.subject === "string" ? e.subject : "",
        overallScore: clampScore(e.overallScore),
        grade: str(e.grade, "-"),
        headline: str(e.headline, "Analysis"),
        verdict: str(e.verdict),
        replyLikelihood: sReply(e.replyLikelihood),
        icp: sIcp(e.icp),
        dimensions: sDims(e.dimensions),
        lineNotes: sNotes(e.lineNotes),
        deliverability: {
            score: clampScore(d.score),
            triggers: strList(d.triggers),
            note: str(d.note),
        },
        strengths: strList(e.strengths),
        priorityFixes: sFixes(e.priorityFixes),
        rewrite: sRewrite(e.rewrite),
    }
}
function sCampaign(v: unknown): Campaign {
    const c = obj(v)
    return {
        overallScore: clampScore(c.overallScore),
        grade: str(c.grade, "-"),
        headline: str(c.headline, "Analysis complete"),
        verdict: str(c.verdict),
        summary: str(c.summary),
        recommendation: str(c.recommendation),
        modeInsight: str(c.modeInsight),
        winnerLabel: typeof c.winnerLabel === "string" ? c.winnerLabel : "",
        angles: sAngles(c.angles),
    }
}
function sanitizeAnalysis(
    raw: unknown,
    fallbackMode: CampaignMode = "single"
): Analysis {
    const a = obj(raw)
    let emails = arr<unknown>(a.emails)
        .filter(isObj)
        .map((e, i) => sEmail(e, i))
    if (emails.length === 0) emails = [sEmail({}, 0)]
    return {
        mode: oneOf<CampaignMode>(a.mode, MODES, fallbackMode),
        campaign: sCampaign(a.campaign),
        emails,
    }
}

// ============================================================================
// PDF report  (from lib/pdf.ts) — jspdf loaded lazily
// ============================================================================
type RGB = [number, number, number]
const PDF = {
    PAGE_W: 210,
    PAGE_H: 297,
    M: 16,
}
const CW = PDF.PAGE_W - PDF.M * 2
const BOTTOM = PDF.PAGE_H - 16
const INK: RGB = [24, 26, 30]
const DIM: RGB = [92, 98, 107]
const FAINT: RGB = [150, 156, 165]
const LINE: RGB = [228, 231, 236]
const PANEL: RGB = [247, 249, 252]
const GOOD: RGB = [42, 140, 92]
const CRIT: RGB = [198, 64, 52]
function hexToRgb(hex: string): RGB {
    const h = hex.replace("#", "")
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ]
}
const clampPdf = (n: number) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)))
function teaserOf(body: string): { teaser: string; locked: boolean } {
    const text = (body || "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{2,}/g, "\n")
        .trim()
    if (!text) return { teaser: "", locked: false }
    const cap = Math.max(160, Math.min(230, Math.floor(text.length * 0.4)))
    if (text.length <= cap) return { teaser: text, locked: false }
    const slice = text.slice(0, cap)
    const sentenceEnd = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? ")
    )
    let cut: number
    if (sentenceEnd > cap * 0.45) cut = sentenceEnd + 1
    else {
        const nl = slice.lastIndexOf("\n")
        const sp = slice.lastIndexOf(" ")
        cut = nl > cap * 0.5 ? nl : sp > 0 ? sp : cap
    }
    return { teaser: text.slice(0, cut).trim(), locked: true }
}
async function buildReportDoc(a: Analysis, intake: IntakeData) {
    const M = PDF.M
    const PAGE_W = PDF.PAGE_W
    const PAGE_H = PDF.PAGE_H
    const BRAND_RGB = hexToRgb(BRAND_HEX)
    const mod: any = await import("jspdf")
    const jsPDF = mod.jsPDF || mod.default
    const doc = new jsPDF({ unit: "mm", format: "a4" })
    let y = M

    const ensure = (h: number) => {
        if (y + h > BOTTOM) {
            doc.addPage()
            y = M
        }
    }
    type TextOpts = {
        size?: number
        color?: RGB
        font?: "normal" | "bold" | "italic"
        family?: "helvetica" | "courier"
        x?: number
        maxW?: number
        lh?: number
        gapAfter?: number
        align?: "left" | "right"
    }
    const text = (content: string, opts: TextOpts = {}) => {
        const size = opts.size ?? 10
        const color = opts.color ?? INK
        const x = opts.x ?? M
        const maxW = opts.maxW ?? CW
        const lh = opts.lh ?? size * 0.5
        doc.setFont(opts.family ?? "helvetica", opts.font ?? "normal")
        doc.setFontSize(size)
        doc.setTextColor(...color)
        const lines = doc.splitTextToSize(String(content ?? ""), maxW) as string[]
        for (const line of lines) {
            ensure(lh)
            if (opts.align === "right") doc.text(line, x, y, { align: "right" })
            else doc.text(line, x, y)
            y += lh
        }
        if (opts.gapAfter) y += opts.gapAfter
    }
    const rule = (gap = 4, color: RGB = LINE, weight = 0.3) => {
        ensure(gap + 1)
        doc.setDrawColor(...color)
        doc.setLineWidth(weight)
        doc.line(M, y, PAGE_W - M, y)
        y += gap
    }
    const eyebrow = (label: string, color: RGB = BRAND_RGB) => {
        ensure(6)
        text(label.toUpperCase(), {
            size: 7.5,
            color,
            family: "courier",
            gapAfter: 1.6,
        })
    }
    const sectionTitle = (label: string) => {
        ensure(11)
        y += 2.5
        eyebrow(label)
    }
    const bullets = (items: string[], dot: RGB = BRAND_RGB, color: RGB = DIM) => {
        items.forEach((it) => {
            doc.setFont("helvetica", "normal")
            doc.setFontSize(9.5)
            const lines = doc.splitTextToSize(String(it ?? ""), CW - 6) as string[]
            ensure(lines.length * 4.4)
            doc.setFillColor(...dot)
            doc.circle(M + 1.1, y - 1.3, 0.8, "F")
            text(lines.join("\n"), {
                x: M + 5,
                maxW: CW - 5,
                color,
                size: 9.5,
                gapAfter: 1,
            })
        })
    }
    const bar = (label: string, score: number, hex: string, sub?: string) => {
        const s = clampPdf(score)
        const c = hexToRgb(hex)
        ensure(11 + (sub ? 4 : 0))
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9.5)
        doc.setTextColor(...INK)
        doc.text(label, M, y)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(10)
        doc.setTextColor(...c)
        doc.text(`${s}`, PAGE_W - M, y, { align: "right" })
        y += 2.2
        const trackH = 2.4
        doc.setFillColor(...LINE)
        doc.rect(M, y, CW, trackH, "F")
        doc.setFillColor(...c)
        doc.rect(M, y, (CW * s) / 100, trackH, "F")
        y += trackH + 3
        if (sub) text(sub, { size: 8.8, color: DIM, gapAfter: 2.5, lh: 4 })
    }
    const scoreChip = (score: number, rightX: number, centerY: number) => {
        const s = clampPdf(score)
        const c = hexToRgb(scoreColor(s))
        const label = `${s}/100`
        doc.setFont("helvetica", "bold")
        doc.setFontSize(9)
        const w = doc.getTextWidth(label) + 7
        const hh = 6.6
        doc.setFillColor(c[0], c[1], c[2])
        doc.roundedRect(rightX - w, centerY - hh / 2, w, hh, hh / 2, hh / 2, "F")
        doc.setTextColor(255, 255, 255)
        doc.text(label, rightX - w / 2, centerY, {
            align: "center",
            baseline: "middle",
        })
    }

    doc.setFillColor(...BRAND_RGB)
    doc.rect(0, 0, PAGE_W, 2, "F")
    y = M + 2.5
    doc.setFont("helvetica", "bold")
    doc.setFontSize(15)
    doc.setTextColor(...INK)
    doc.text(BRAND.product, M, y)
    const pw = doc.getTextWidth(BRAND.product)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...FAINT)
    doc.text(`by ${BRAND.company}`, M + pw + 3, y)
    doc.setFont("courier", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...FAINT)
    doc.text(
        new Date().toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }),
        PAGE_W - M,
        y,
        { align: "right" }
    )
    y += 4.5
    rule(6)

    const modeLabel =
        a.mode === "sequence"
            ? "Follow-up sequence"
            : a.mode === "variations"
            ? "A/B/C variations"
            : intake.emails.length > 1
            ? "Standalone emails"
            : "Cold email diagnostic"
    eyebrow(modeLabel)
    text(intake.company || "Cold email analysis", {
        size: 20,
        font: "bold",
        gapAfter: 1.5,
    })
    const meta: string[] = []
    if (intake.icpTitle) meta.push(`ICP: ${intake.icpTitle}`)
    meta.push(`${intake.emails.length} email${intake.emails.length > 1 ? "s" : ""}`)
    if (intake.goal) meta.push(`Goal: ${intake.goal}`)
    text(meta.join("   ·   "), { size: 9.5, color: DIM, gapAfter: 3 })

    const cmp = a.campaign
    ensure(34)
    const boxY = y
    const CARD_H = 30
    doc.setFillColor(...PANEL)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.3)
    doc.roundedRect(M, boxY, CW, CARD_H, 2.5, 2.5, "FD")
    const cardMid = boxY + CARD_H / 2
    const csc = hexToRgb(scoreColor(cmp.overallScore))
    const numStr = `${clampPdf(cmp.overallScore)}`
    const numBaseline = cardMid + 2.5
    doc.setFont("helvetica", "bold")
    doc.setFontSize(34)
    doc.setTextColor(...csc)
    doc.text(numStr, M + 10, numBaseline)
    const numW = doc.getTextWidth(numStr)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9.5)
    doc.setTextColor(...FAINT)
    doc.text("/100", M + 10 + numW + 1.5, numBaseline)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.setTextColor(...csc)
    doc.text(`GRADE ${cmp.grade}`, M + 10, boxY + CARD_H - 5)
    const rx = M + 50
    const rw = CW - 50 - 9
    const headLine =
        (doc.splitTextToSize(cmp.headline || "Summary", rw) as string[])[0] ?? ""
    const vLines = (
        doc.splitTextToSize(cmp.verdict || "", rw) as string[]
    ).slice(0, 4)
    const HEAD_GAP = 6.2
    const V_LH = 4.4
    const rightBlockH = HEAD_GAP + vLines.length * V_LH
    const ry0 = boxY + (CARD_H - rightBlockH) / 2
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12.5)
    doc.setTextColor(...INK)
    doc.text(headLine, rx, ry0, { baseline: "top" })
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9.3)
    doc.setTextColor(...DIM)
    let vy = ry0 + HEAD_GAP
    vLines.forEach((l) => {
        doc.text(l, rx, vy, { baseline: "top" })
        vy += V_LH
    })
    y = boxY + CARD_H + 5

    if (cmp.recommendation) {
        ensure(14)
        const ry = y
        const padX = 5
        const padTop = 4.6
        const padBot = 4.6
        const eyeH = 2.8
        const eyeGap = 3
        const bodyLh = 4.4
        const recLines = doc.splitTextToSize(
            cmp.recommendation,
            CW - padX * 2 - 1
        ) as string[]
        const h = padTop + eyeH + eyeGap + recLines.length * bodyLh + padBot
        doc.setFillColor(237, 243, 255)
        doc.setDrawColor(...BRAND_RGB)
        doc.setLineWidth(0.3)
        doc.roundedRect(M, ry, CW, h, 2, 2, "FD")
        doc.setFillColor(...BRAND_RGB)
        doc.rect(M, ry, 1.4, h, "F")
        doc.setFont("courier", "normal")
        doc.setFontSize(7)
        doc.setTextColor(...BRAND_RGB)
        doc.text("DO THIS FIRST", M + padX, ry + padTop, { baseline: "top" })
        doc.setFont("helvetica", "normal")
        doc.setFontSize(9.6)
        doc.setTextColor(...INK)
        let by = ry + padTop + eyeH + eyeGap
        recLines.forEach((l) => {
            doc.text(l, M + padX, by, { baseline: "top" })
            by += bodyLh
        })
        y = ry + h + 4
    }

    if (cmp.modeInsight) {
        sectionTitle(
            a.mode === "variations"
                ? "Why the winner wins"
                : a.mode === "sequence"
                ? "Sequence flow"
                : "Across the set"
        )
        if (a.mode === "variations" && cmp.winnerLabel) {
            text(`Winner: ${cmp.winnerLabel}`, {
                size: 10,
                font: "bold",
                color: BRAND_RGB,
                gapAfter: 1,
            })
        }
        text(cmp.modeInsight, { size: 9.5, color: DIM, gapAfter: 1 })
    }
    if (cmp.angles?.length) {
        sectionTitle("Read from every angle")
        cmp.angles.forEach((ang) => {
            text(ang.lens, { size: 9.5, font: "bold", gapAfter: 0.6 })
            text(ang.read, { size: 9.3, color: DIM, gapAfter: 2 })
        })
    }

    a.emails.forEach((em: EmailScore, idx) => {
        if (idx === 0) {
            y += 1
            rule(5, LINE, 0.4)
        } else {
            doc.addPage()
            y = M
        }
        ensure(16)
        const hy = y
        const STRIP_H = 11
        const stripMid = hy + STRIP_H / 2
        doc.setFillColor(...INK)
        doc.roundedRect(M, hy, CW, STRIP_H, 2, 2, "F")
        doc.setFont("helvetica", "bold")
        doc.setFontSize(11)
        doc.setTextColor(255, 255, 255)
        doc.text(em.label || `Email ${idx + 1}`, M + 5, stripMid, {
            baseline: "middle",
        })
        scoreChip(em.overallScore, PAGE_W - M - 4, stripMid)
        y = hy + STRIP_H + 4

        if (em.subject)
            text(`Subject: ${em.subject}`, {
                size: 9.5,
                family: "courier",
                color: INK,
                gapAfter: 1.5,
            })
        text(`${em.headline ? em.headline + ". " : ""}${em.verdict}`, {
            size: 9.6,
            color: DIM,
            gapAfter: 2.5,
        })
        text(
            `Predicted reply: ${em.replyLikelihood.band}  ·  est. ${em.replyLikelihood.range}`,
            {
                size: 9.6,
                font: "bold",
                color: hexToRgb(scoreColor(em.overallScore)),
                gapAfter: 0.8,
            }
        )
        text(em.replyLikelihood.rationale, { size: 9, color: DIM, gapAfter: 2.5 })

        sectionTitle("Through your prospect's eyes")
        text(
            `${em.icp.persona}  ·  decides in ${em.icp.secondsToDecision}`,
            { size: 8.5, family: "courier", color: FAINT, gapAfter: 1.8 }
        )
        text(`"${em.icp.firstReaction}"`, {
            size: 10.5,
            font: "italic",
            color: INK,
            gapAfter: 2.2,
        })
        text(em.icp.readThrough, { size: 9.3, color: DIM, gapAfter: 2.5 })
        if (em.icp.landsWell.length) {
            text("What lands", { size: 9, font: "bold", color: GOOD, gapAfter: 1.2 })
            bullets(em.icp.landsWell, GOOD)
        }
        if (em.icp.dropsOff.length) {
            text("Where they drop off", {
                size: 9,
                font: "bold",
                color: CRIT,
                gapAfter: 1.2,
            })
            bullets(em.icp.dropsOff, CRIT)
        }
        text(
            `${em.icp.wouldReply ? "Would reply. " : "Would not reply. "}${em.icp.replyReasoning}`,
            { size: 9.4, font: "bold", color: INK, gapAfter: 2.5 }
        )

        if (em.dimensions.length) {
            sectionTitle("Dimension scores")
            em.dimensions.forEach((dm) =>
                bar(dm.label, dm.score, statusColor(dm.status), dm.summary)
            )
        }
        if (em.lineNotes.length) {
            sectionTitle("Line-by-line notes")
            em.lineNotes.forEach((ln, i) => {
                const c = hexToRgb(severityColor(ln.severity))
                ensure(15)
                text(`${i + 1}.  "${ln.excerpt}"`, {
                    size: 9,
                    font: "bold",
                    family: "courier",
                    color: c,
                    gapAfter: 1,
                    lh: 4.2,
                })
                text(`Issue: ${ln.issue}`, {
                    size: 9,
                    color: INK,
                    x: M + 5,
                    maxW: CW - 5,
                    gapAfter: 0.8,
                    lh: 4.2,
                })
                text(`Fix: ${ln.suggestion}`, {
                    size: 9,
                    color: DIM,
                    x: M + 5,
                    maxW: CW - 5,
                    gapAfter: 2.4,
                    lh: 4.2,
                })
            })
        }

        sectionTitle("Deliverability")
        bar(
            "Inbox safety",
            em.deliverability.score,
            scoreColor(em.deliverability.score),
            em.deliverability.note
        )
        if (em.deliverability.triggers.length) {
            text("Flags", { size: 9, font: "bold", color: CRIT, gapAfter: 1.2 })
            bullets(em.deliverability.triggers, CRIT)
        }
        if (em.strengths.length) {
            sectionTitle("What's working")
            bullets(em.strengths, GOOD, INK)
        }
        if (em.priorityFixes.length) {
            sectionTitle("Priority fixes")
            em.priorityFixes
                .slice()
                .sort((x, z) => x.rank - z.rank)
                .forEach((pf) => {
                    const c = hexToRgb(impactColor(pf.impact))
                    ensure(13)
                    const cy = y - 1.4
                    doc.setFillColor(c[0], c[1], c[2])
                    doc.circle(M + 2, cy, 2.2, "F")
                    doc.setFont("helvetica", "bold")
                    doc.setFontSize(8)
                    doc.setTextColor(255, 255, 255)
                    doc.text(`${pf.rank}`, M + 2, cy, {
                        align: "center",
                        baseline: "middle",
                    })
                    text(pf.fix, {
                        size: 9.8,
                        font: "bold",
                        x: M + 7,
                        maxW: CW - 7,
                        gapAfter: 0.6,
                        lh: 4.4,
                    })
                    text(`${pf.impact.toUpperCase()} IMPACT · ${pf.why}`, {
                        size: 8.8,
                        color: DIM,
                        x: M + 7,
                        maxW: CW - 7,
                        gapAfter: 2.4,
                        lh: 4,
                    })
                })
        }

        sectionTitle("Suggested rewrite")
        text("Subject options", { size: 9, font: "bold", gapAfter: 1.2 })
        em.rewrite.subjectOptions.forEach((s, i) => {
            text(`${String.fromCharCode(65 + i)}.  ${s}`, {
                size: 9.4,
                family: "courier",
                color: INK,
                x: M + 4,
                maxW: CW - 4,
                gapAfter: 0.8,
                lh: 4.2,
            })
        })
        y += 1.5
        const { teaser, locked } = teaserOf(em.rewrite.body)
        text("Rewritten body", { size: 9, font: "bold", gapAfter: 1.5 })
        const bodyTop = y
        if (teaser) {
            text(teaser + (locked ? " …" : ""), {
                size: 9.4,
                color: INK,
                x: M + 4,
                maxW: CW - 8,
                lh: 4.6,
            })
            doc.setDrawColor(...BRAND_RGB)
            doc.setLineWidth(0.8)
            doc.line(M + 1, bodyTop - 3, M + 1, Math.min(y, BOTTOM))
        }
        y += 2
        if (locked) {
            const padX = 6
            const padTop = 5
            const padBot = 5
            const titleH = 4.4
            const gap1 = 2.4
            const explLh = 3.9
            const gap2 = 2.8
            const linkH = 3.8
            const explainer = `You're seeing the opening. ${BRAND.company} walks you through the complete, ready-to-send rewrite on a quick call:`
            const ll = doc.splitTextToSize(explainer, CW - padX * 2) as string[]
            const h =
                padTop + titleH + gap1 + ll.length * explLh + gap2 + linkH + padBot
            ensure(h + 2)
            const ly = y
            doc.setFillColor(237, 243, 255)
            doc.setDrawColor(...BRAND_RGB)
            doc.setLineWidth(0.3)
            doc.roundedRect(M, ly, CW, h, 2.5, 2.5, "FD")
            doc.setFont("helvetica", "bold")
            doc.setFontSize(10.5)
            doc.setTextColor(...INK)
            doc.text("The full rewrite is one call away", M + padX, ly + padTop, {
                baseline: "top",
            })
            doc.setFont("helvetica", "normal")
            doc.setFontSize(8.8)
            doc.setTextColor(...DIM)
            let ey = ly + padTop + titleH + gap1
            ll.forEach((l) => {
                doc.text(l, M + padX, ey, { baseline: "top" })
                ey += explLh
            })
            const linkTop = ly + padTop + titleH + gap1 + ll.length * explLh + gap2
            doc.setFont("helvetica", "bold")
            doc.setFontSize(9)
            doc.setTextColor(...BRAND_RGB)
            doc.textWithLink(BRAND.bookACall, M + padX, linkTop + 2.5, {
                url: BRAND.bookACall,
            })
            y = ly + h + 4
        }
        if (em.rewrite.rationale) {
            text(`Why this approach: ${em.rewrite.rationale}`, {
                size: 8.6,
                font: "italic",
                color: DIM,
                gapAfter: 1,
                lh: 4,
            })
        }
    })

    const pages = doc.getNumberOfPages()
    for (let p = 1; p <= pages; p++) {
        doc.setPage(p)
        doc.setDrawColor(...LINE)
        doc.setLineWidth(0.2)
        doc.line(M, PAGE_H - 11, PAGE_W - M, PAGE_H - 11)
        doc.setFont("courier", "normal")
        doc.setFontSize(7.5)
        doc.setTextColor(...FAINT)
        doc.text(`${BRAND.product} · ${BRAND.company}`, M, PAGE_H - 7)
        doc.text(`${p} / ${pages}`, PAGE_W - M, PAGE_H - 7, { align: "right" })
    }
    return doc
}
async function downloadReport(a: Analysis, intake: IntakeData) {
    const doc = await buildReportDoc(a, intake)
    const safe = (intake.company || "email")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()
    doc.save(`coldscore-${safe}.pdf`)
}

// ============================================================================
// UI primitives  (from components/ui.tsx)
// ============================================================================
function AnimatedNumber({
    value,
    duration = 1200,
    delay = 0,
    decimals = 0,
}: {
    value: number
    duration?: number
    delay?: number
    decimals?: number
}) {
    const [display, setDisplay] = useState(0)
    const ref = useRef<HTMLSpanElement>(null)
    const inView = useInView(ref, { once: true, margin: "-40px" })
    useEffect(() => {
        if (!inView) return
        let raf = 0
        let start: number | null = null
        const startVal = 0
        const timeout = setTimeout(() => {
            const tick = (t: number) => {
                if (start === null) start = t
                const p = Math.min((t - start) / duration, 1)
                const eased = 1 - Math.pow(1 - p, 3)
                setDisplay(startVal + (value - startVal) * eased)
                if (p < 1) raf = requestAnimationFrame(tick)
                else setDisplay(value)
            }
            raf = requestAnimationFrame(tick)
        }, delay)
        return () => {
            clearTimeout(timeout)
            cancelAnimationFrame(raf)
        }
    }, [inView, value, duration, delay])
    return (
        <span ref={ref}>
            {decimals > 0 ? display.toFixed(decimals) : Math.round(display)}
        </span>
    )
}

function RadialGauge({
    score,
    size = 220,
    stroke = 12,
    delay = 0.2,
}: {
    score: number
    size?: number
    stroke?: number
    delay?: number
}) {
    const ref = useRef<SVGSVGElement>(null)
    const inView = useInView(ref, { once: true, margin: "-40px" })
    const r = (size - stroke) / 2
    const c = 2 * Math.PI * r
    const color = scoreColor(score)
    const offset = c - (Math.min(score, 100) / 100) * c
    return (
        <svg ref={ref} width={size} height={size} className="-rotate-90">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="rgba(20,20,24,0.09)"
                strokeWidth={stroke}
            />
            <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                initial={{ strokeDashoffset: c }}
                animate={
                    inView
                        ? { strokeDashoffset: offset }
                        : { strokeDashoffset: c }
                }
                transition={{ duration: 1.4, delay, ease: [0.22, 1, 0.36, 1] }}
                style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
            />
        </svg>
    )
}

function Bar({
    value,
    color,
    delay = 0,
    height = 8,
}: {
    value: number
    color: string
    delay?: number
    height?: number
}) {
    const ref = useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { once: true, margin: "-30px" })
    return (
        <div
            ref={ref}
            className="w-full overflow-hidden rounded-full bg-bone/[0.07]"
            style={{ height }}
        >
            <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={inView ? { width: `${Math.min(value, 100)}%` } : { width: 0 }}
                transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }}
            />
        </div>
    )
}

function Eyebrow({
    children,
    className = "",
}: {
    children: React.ReactNode
    className?: string
}) {
    return <div className={`eyebrow ${className}`}>{children}</div>
}

function Tag({
    children,
    color,
    subtle = false,
}: {
    children: React.ReactNode
    color: string
    subtle?: boolean
}) {
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.64rem] uppercase tracking-[0.14em]"
            style={{
                color,
                background: subtle ? "transparent" : `${color}1A`,
                border: `1px solid ${color}40`,
            }}
        >
            {children}
        </span>
    )
}

function Button({
    children,
    onClick,
    variant = "primary",
    type = "button",
    disabled = false,
    className = "",
}: {
    children: React.ReactNode
    onClick?: () => void
    variant?: "primary" | "ghost"
    type?: "button" | "submit"
    disabled?: boolean
    className?: string
}) {
    const base =
        "group relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-mono text-[0.78rem] uppercase tracking-[0.16em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 focusable"
    const styles =
        variant === "primary"
            ? "bg-gold text-ink hover:bg-gold-soft hover:shadow-glow active:scale-[0.98]"
            : "bg-transparent text-bone-dim border border-bone/15 hover:text-bone hover:border-bone/35 active:scale-[0.98]"
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${base} ${styles} ${className}`}
        >
            {children}
        </button>
    )
}

function Field({
    label,
    hint,
    value,
    onChange,
    placeholder,
    textarea = false,
    rows = 4,
    required = false,
    optional = false,
    mono = false,
}: {
    label: string
    hint?: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    textarea?: boolean
    rows?: number
    required?: boolean
    optional?: boolean
    mono?: boolean
}) {
    const shared =
        "focusable w-full rounded-xl border border-bone/12 bg-ink-2/70 px-4 py-3 text-bone placeholder:text-bone-faint transition-colors duration-200 hover:border-bone/20"
    return (
        <label className="block">
            <div className="mb-2 flex items-baseline justify-between">
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-bone-dim">
                    {label}
                    {required && <span className="ml-1 text-gold">*</span>}
                </span>
                {optional && (
                    <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-bone-faint">
                        optional
                    </span>
                )}
            </div>
            {textarea ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={rows}
                    className={`${shared} ${
                        mono ? "font-mono text-[0.86rem] leading-relaxed" : ""
                    }`}
                />
            ) : (
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={shared}
                />
            )}
            {hint && (
                <p className="mt-1.5 text-[0.78rem] leading-snug text-bone-faint">
                    {hint}
                </p>
            )}
        </label>
    )
}

// ============================================================================
// Wordmark  (from components/Wordmark.tsx)
// ============================================================================
function Wordmark({ small = false }: { small?: boolean }) {
    const c = "#FF6F30"
    return (
        <div className="flex items-center gap-2.5 select-none">
            <span className="relative inline-flex">
                <svg
                    width={small ? 22 : 26}
                    height={small ? 22 : 26}
                    viewBox="0 0 32 32"
                    fill="none"
                >
                    <circle cx="16" cy="16" r="9" stroke={c} strokeWidth="2.2" />
                    <circle cx="16" cy="16" r="2.8" fill={c} />
                    <line x1="16" y1="2.5" x2="16" y2="6.5" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
                    <line x1="16" y1="25.5" x2="16" y2="29.5" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
                    <line x1="2.5" y1="16" x2="6.5" y2="16" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
                    <line x1="25.5" y1="16" x2="29.5" y2="16" stroke={c} strokeWidth="2.2" strokeLinecap="round" />
                </svg>
            </span>
            <div className="flex items-center gap-2 leading-none">
                <span
                    className={`font-display font-semibold tracking-tight text-bone ${
                        small ? "text-base" : "text-lg"
                    }`}
                >
                    Side&nbsp;Kick
                </span>
                <span className="h-3 w-px bg-bone/20" />
                <span
                    className={`font-mono uppercase tracking-[0.18em] text-brand ${
                        small ? "text-[0.58rem]" : "text-[0.64rem]"
                    }`}
                >
                    Coldscore
                </span>
            </div>
        </div>
    )
}

// ============================================================================
// Background  (from components/Background.tsx)
// ============================================================================
function Background() {
    return (
        <>
            <div className="field" aria-hidden />
            <div className="drift" aria-hidden style={{ top: "-10%", left: "10%" }} />
            <div
                className="drift"
                aria-hidden
                style={{
                    bottom: "-20%",
                    right: "0%",
                    animationDelay: "-13s",
                    opacity: 0.7,
                }}
            />
            <div className="grain" aria-hidden />
        </>
    )
}

// ============================================================================
// Access-link parsing — prospects paste their own quota-limited link.
// Accepts a full URL (…/veloka-x7k2), a bare slug, or anything in between.
// ============================================================================
function parseSlug(input: string): string {
    let s = (input || "").trim()
    if (!s) return ""
    try {
        if (/^https?:\/\//i.test(s)) {
            const u = new URL(s)
            const parts = u.pathname.split("/").filter(Boolean)
            s = parts[parts.length - 1] || ""
        } else if (s.includes("/")) {
            const parts = s.split(/[?#]/)[0].split("/").filter(Boolean)
            s = parts[parts.length - 1] || ""
        }
    } catch {
        /* fall through to sanitising the raw string */
    }
    s = s.split(/[?#]/)[0]
    return s.replace(/[^a-z0-9-]/gi, "").toLowerCase()
}

// ============================================================================
// Hero  (from components/Hero.tsx)
// ============================================================================
const EASE = [0.22, 1, 0.36, 1] as const

function Stagger({
    children,
    delay = 0,
}: {
    children: React.ReactNode
    delay?: number
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay, ease: EASE }}
        >
            {children}
        </motion.div>
    )
}

function HeroMark({
    children,
    sev,
}: {
    children: React.ReactNode
    sev: "weak" | "crit"
}) {
    const color = sev === "crit" ? "#E04A3C" : "#E66B47"
    return (
        <span
            className="rounded px-0.5"
            style={{
                background: `${color}22`,
                boxShadow: `inset 0 -1.5px 0 ${color}`,
            }}
        >
            {children}
        </span>
    )
}

function Corner({ className }: { className: string }) {
    return (
        <span
            className={`absolute z-30 h-4 w-4 border-gold/50 ${className}`}
            aria-hidden
        />
    )
}

function Specimen() {
    return (
        <div className="relative mx-auto w-full max-w-md">
            <Corner className="-left-2 -top-2 border-l border-t" />
            <Corner className="-right-2 -top-2 border-r border-t" />
            <Corner className="-bottom-2 -left-2 border-b border-l" />
            <Corner className="-bottom-2 -right-2 border-b border-r" />
            <div className="panel relative overflow-hidden p-6 shadow-panel">
                <div
                    className="pointer-events-none absolute inset-x-0 z-20 h-24"
                    style={{
                        background:
                            "linear-gradient(180deg, transparent, rgba(255,111,48,0.16) 60%, rgba(255,111,48,0.5))",
                        borderBottom: "1.5px solid rgba(255,111,48,0.8)",
                        animation: "sweep 4.2s ease-in-out infinite",
                    }}
                />
                <div className="mb-4 flex items-center justify-between border-b border-bone/10 pb-3">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-bone/20" />
                        <span className="font-mono text-[0.66rem] text-bone-faint">
                            specimen.eml
                        </span>
                    </div>
                    <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gold">
                        analysing
                    </span>
                </div>
                <div className="space-y-1.5 font-mono text-[0.72rem] text-bone-faint">
                    <p>
                        <span className="text-bone-dim">from</span> rep@vendor.io
                    </p>
                    <p>
                        <span className="text-bone-dim">subj</span>{" "}
                        <span className="text-bone">Quick question about Acme</span>
                    </p>
                </div>
                <div className="mt-4 space-y-3 text-[0.86rem] leading-relaxed text-bone-dim">
                    <p>
                        <HeroMark sev="weak">Hi {"{first_name}"},</HeroMark> I hope
                        this email finds you well.
                    </p>
                    <p>
                        I&apos;m reaching out because we help companies{" "}
                        <HeroMark sev="crit">10x their revenue</HeroMark> with our{" "}
                        <HeroMark sev="weak">
                            revolutionary AI-powered platform
                        </HeroMark>
                        .
                    </p>
                    <p>
                        Would you be open to a quick 15-minute call sometime this
                        week to explore synergies?
                    </p>
                </div>
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.4, duration: 0.6 }}
                    className="mt-5 flex items-center justify-between rounded-lg border border-crit/30 bg-crit/10 px-3 py-2"
                >
                    <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-crit">
                        3 issues flagged
                    </span>
                    <span className="font-mono text-[0.7rem] text-crit">
                        score 31/100
                    </span>
                </motion.div>
            </div>
        </div>
    )
}

function Hero({
    onStart,
    onDemo,
}: {
    onStart: (slug: string) => void
    onDemo: () => void
}) {
    const [link, setLink] = useState("")
    const [touched, setTouched] = useState(false)
    const slug = parseSlug(link)
    const invalid = touched && link.trim().length > 0 && !slug
    const submit = () => {
        if (slug) onStart(slug)
        else setTouched(true)
    }
    return (
        <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-7">
            <Stagger>
                <header className="flex items-center justify-between">
                    <Wordmark />
                    <div className="hidden items-center gap-2 sm:flex">
                        <span className="h-1.5 w-1.5 rounded-full bg-good shadow-[0_0_8px_#5FC98A]" />
                        <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-bone-faint">
                            Engine online
                        </span>
                    </div>
                </header>
            </Stagger>

            <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_0.95fr]">
                <div>
                    <Stagger delay={0.05}>
                        <Eyebrow>Cold email diagnostics</Eyebrow>
                    </Stagger>
                    <Stagger delay={0.12}>
                        <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-bone sm:text-[3.4rem] lg:text-[3.7rem]">
                            Read your cold email
                            <br />
                            the way your{" "}
                            <span className="relative whitespace-nowrap text-gold">
                                prospect
                                <svg
                                    className="absolute -bottom-2 left-0 w-full"
                                    height="10"
                                    viewBox="0 0 200 10"
                                    fill="none"
                                    preserveAspectRatio="none"
                                >
                                    <motion.path
                                        d="M2 7C40 3 160 3 198 6"
                                        stroke="#FF6F30"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        transition={{
                                            duration: 0.9,
                                            delay: 0.8,
                                            ease: EASE,
                                        }}
                                    />
                                </svg>
                            </span>{" "}
                            will.
                        </h1>
                    </Stagger>
                    <Stagger delay={0.2}>
                        <p className="mt-7 max-w-md text-[1.02rem] leading-relaxed text-bone-dim">
                            Coldscore drops your email in front of your exact ICP
                            and shows you what they see in the first three seconds,
                            where they lose interest, and whether they&apos;d ever
                            reply, then rewrites it sharper. Score a single email, a
                            follow-up sequence, or A/B/C variations.
                        </p>
                    </Stagger>
                    <Stagger delay={0.28}>
                        <div className="mt-9 max-w-md">
                            <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-bone-dim">
                                Received a link from us? Paste it here
                            </div>
                            <div className="flex flex-col gap-2.5 sm:flex-row">
                                <input
                                    value={link}
                                    onChange={(e) => setLink(e.target.value)}
                                    onBlur={() => setTouched(true)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") submit()
                                    }}
                                    placeholder="Paste your Coldscore link or code"
                                    aria-label="Your Coldscore access link"
                                    className="focusable w-full rounded-xl border border-bone/12 bg-ink-2/70 px-4 py-3 text-bone placeholder:text-bone-faint transition-colors duration-200 hover:border-bone/20"
                                />
                                <Button onClick={submit} disabled={!slug}>
                                    Start
                                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                                </Button>
                            </div>
                            {invalid ? (
                                <p className="mt-2 text-[0.78rem] leading-snug text-crit">
                                    That doesn&rsquo;t look like a valid link.
                                    Paste the full link we sent you.
                                </p>
                            ) : (
                                <p className="mt-2 text-[0.78rem] leading-snug text-bone-faint">
                                    Your link is limited to a few emails, so
                                    scores stay yours alone.
                                </p>
                            )}
                            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                                <button
                                    type="button"
                                    onClick={onDemo}
                                    className="focusable group inline-flex items-center gap-1.5 rounded-full font-mono text-[0.66rem] uppercase tracking-[0.16em] text-brand transition-colors hover:text-brand-deep"
                                >
                                    See a sample report
                                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                                </button>
                                <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone-faint">
                                    No link yet?{" "}
                                    <a
                                        href={BRAND.bookACall}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="focusable rounded text-bone-dim transition-colors hover:text-brand"
                                    >
                                        Request access
                                    </a>
                                </span>
                            </div>
                        </div>
                    </Stagger>
                    <Stagger delay={0.36}>
                        <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3">
                            {[
                                { icon: Eye, label: "ICP point-of-view" },
                                {
                                    icon: Crosshair,
                                    label: "Sequences & variations",
                                },
                                { icon: FileDown, label: "Downloadable report" },
                            ].map(({ icon: Icon, label }) => (
                                <div
                                    key={label}
                                    className="flex items-center gap-2"
                                >
                                    <Icon className="h-3.5 w-3.5 text-gold" />
                                    <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-bone-dim">
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Stagger>
                </div>

                <Stagger delay={0.3}>
                    <Specimen />
                </Stagger>
            </div>

            <Stagger delay={0.45}>
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-bone/10 py-5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone-faint">
                    <span>{BRAND.signoff}</span>
                    <a
                        href={BRAND.bookACall}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focusable rounded-full text-bone-dim transition-colors hover:text-brand"
                    >
                        Book a demo →
                    </a>
                </footer>
            </Stagger>
        </div>
    )
}

// ============================================================================
// Wizard  (from components/Wizard.tsx)
// ============================================================================
const GOALS = ["Book a meeting", "Get a reply", "Drive a signup", "Build awareness"]
const SIZES = ["1-10", "11-50", "51-200", "201-1k", "1k+"]
const STEPS = [
    { id: 0, label: "Your offer" },
    { id: 1, label: "Your ICP" },
    { id: 2, label: "The emails" },
]
const WIZARD_MODES: {
    id: CampaignMode
    title: string
    desc: string
    icon: typeof Mail
}[] = [
    {
        id: "single",
        title: "Standalone",
        desc: "1 to 3 separate emails, each scored on its own.",
        icon: Mail,
    },
    {
        id: "sequence",
        title: "Follow-up sequence",
        desc: "Up to 3 emails to the same prospect. We judge the flow too.",
        icon: Layers,
    },
    {
        id: "variations",
        title: "A/B/C variations",
        desc: "Up to 3 versions of one email. We pick the winner.",
        icon: GitCompare,
    },
]
function emailLabel(mode: CampaignMode, i: number) {
    if (mode === "variations") return `Variation ${String.fromCharCode(65 + i)}`
    if (mode === "sequence") return `Step ${i + 1}`
    return `Email ${i + 1}`
}
function Chips({
    options,
    value,
    onChange,
    label,
}: {
    options: string[]
    value: string
    onChange: (v: string) => void
    label: string
}) {
    return (
        <div>
            <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-bone-dim">
                {label}
            </div>
            <div className="flex flex-wrap gap-2">
                {options.map((o) => {
                    const active = value === o
                    return (
                        <button
                            key={o}
                            type="button"
                            onClick={() => onChange(active ? "" : o)}
                            className={`focusable rounded-full border px-3.5 py-1.5 font-mono text-[0.72rem] tracking-[0.04em] transition-all duration-150 ${
                                active
                                    ? "border-brand/60 bg-brand/15 text-brand"
                                    : "border-bone/12 text-bone-dim hover:border-bone/30 hover:text-bone"
                            }`}
                        >
                            {o}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
function StepIntro({ k, title, sub }: { k: string; title: string; sub: string }) {
    return (
        <div className="mb-2">
            <Eyebrow>Step {k}</Eyebrow>
            <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-bone sm:text-[1.7rem]">
                {title}
            </h2>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-bone-dim">
                {sub}
            </p>
        </div>
    )
}
function Wizard({
    onComplete,
    onBack,
    maxEmails = 3,
}: {
    onComplete: (data: IntakeData) => void
    onBack: () => void
    maxEmails?: number
}) {
    const cap = Math.max(1, Math.min(3, maxEmails))
    const [step, setStep] = useState(0)
    const [dir, setDir] = useState(1)
    const [d, setD] = useState<IntakeData>({
        company: "",
        website: "",
        offering: "",
        icpTitle: "",
        icpIndustry: "",
        icpCompanySize: "",
        icpPain: "",
        icpNotes: "",
        goal: "",
        mode: "single",
        emails: [{ subject: "", body: "" }],
    })
    const set = (k: keyof IntakeData) => (v: string) =>
        setD((p) => ({ ...p, [k]: v }))
    const setEmail = (i: number, k: "subject" | "body", v: string) =>
        setD((p) => ({
            ...p,
            emails: p.emails.map((e, idx) =>
                idx === i ? { ...e, [k]: v } : e
            ),
        }))
    const addEmail = () =>
        setD((p) =>
            p.emails.length >= cap
                ? p
                : { ...p, emails: [...p.emails, { subject: "", body: "" }] }
        )
    const removeEmail = (i: number) =>
        setD((p) =>
            p.emails.length <= 1
                ? p
                : { ...p, emails: p.emails.filter((_, idx) => idx !== i) }
        )
    const setMode = (m: CampaignMode) => setD((p) => ({ ...p, mode: m }))
    const canNext =
        step === 0
            ? d.company.trim().length > 0 && d.offering.trim().length > 0
            : step === 1
            ? d.icpTitle.trim().length > 0 || d.icpNotes.trim().length > 0
            : d.emails.some((e) => e.body.trim().length >= 20)
    const go = (next: number) => {
        setDir(next > step ? 1 : -1)
        setStep(next)
    }
    const handlePrimary = () => {
        if (step < 2) go(step + 1)
        else {
            const emails = d.emails.filter((e) => e.body.trim() || e.subject.trim())
            onComplete({
                ...d,
                emails: emails.length ? emails : d.emails.slice(0, 1),
            })
        }
    }
    return (
        <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-7">
            <header className="flex items-center justify-between">
                <button onClick={onBack} className="focusable rounded-full">
                    <Wordmark small />
                </button>
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-bone-faint">
                    Intake · {step + 1}/3
                </span>
            </header>

            <div className="mt-8 flex gap-2">
                {STEPS.map((s) => (
                    <div key={s.id} className="flex-1">
                        <div className="h-1 overflow-hidden rounded-full bg-bone/10">
                            <motion.div
                                className="h-full rounded-full bg-brand"
                                initial={false}
                                animate={{
                                    width:
                                        step > s.id
                                            ? "100%"
                                            : step === s.id
                                            ? "50%"
                                            : "0%",
                                }}
                                transition={{ duration: 0.5, ease: EASE }}
                            />
                        </div>
                        <div
                            className={`mt-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] transition-colors ${
                                step >= s.id ? "text-bone-dim" : "text-bone-faint"
                            }`}
                        >
                            {s.label}
                        </div>
                    </div>
                ))}
            </div>

            <div className="relative flex-1 overflow-hidden py-10">
                <AnimatePresence mode="wait" custom={dir}>
                    <motion.div
                        key={step}
                        custom={dir}
                        initial={{ opacity: 0, x: dir * 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: dir * -40 }}
                        transition={{ duration: 0.4, ease: EASE }}
                    >
                        {step === 0 && (
                            <div className="space-y-6">
                                <StepIntro
                                    k="01"
                                    title="Who's sending this?"
                                    sub="A little context sharpens the read. Nothing here is stored."
                                />
                                <Field
                                    label="Company name"
                                    required
                                    value={d.company}
                                    onChange={set("company")}
                                    placeholder="Acme Inc"
                                />
                                <Field
                                    label="Website"
                                    optional
                                    value={d.website}
                                    onChange={set("website")}
                                    placeholder="acme.com"
                                />
                                <Field
                                    label="What you sell"
                                    required
                                    textarea
                                    rows={3}
                                    value={d.offering}
                                    onChange={set("offering")}
                                    placeholder="What you do and for whom."
                                    hint="One or two lines is plenty."
                                />
                                <Chips
                                    label="Campaign goal"
                                    options={GOALS}
                                    value={d.goal}
                                    onChange={set("goal")}
                                />
                            </div>
                        )}

                        {step === 1 && (
                            <div className="space-y-6">
                                <StepIntro
                                    k="02"
                                    title="Who is this email for?"
                                    sub="This is the persona Coldscore becomes when it reads your email."
                                />
                                <Field
                                    label="Target title / persona"
                                    required
                                    value={d.icpTitle}
                                    onChange={set("icpTitle")}
                                    placeholder="VP of Sales at a Series B SaaS"
                                />
                                <div className="grid gap-6 sm:grid-cols-2">
                                    <Field
                                        label="Industry / market"
                                        optional
                                        value={d.icpIndustry}
                                        onChange={set("icpIndustry")}
                                        placeholder="B2B SaaS"
                                    />
                                    <div className="self-start">
                                        <Chips
                                            label="Company size"
                                            options={SIZES}
                                            value={d.icpCompanySize}
                                            onChange={set("icpCompanySize")}
                                        />
                                    </div>
                                </div>
                                <Field
                                    label="Core pain you solve for them"
                                    optional
                                    textarea
                                    rows={2}
                                    value={d.icpPain}
                                    onChange={set("icpPain")}
                                    placeholder="Reps spend hours on manual prospecting instead of selling."
                                />
                                <Field
                                    label="Paste a full ICP (if you have one)"
                                    optional
                                    textarea
                                    rows={4}
                                    value={d.icpNotes}
                                    onChange={set("icpNotes")}
                                    placeholder="Drop any ICP doc, persona notes, or qualification criteria here."
                                    hint="Either fill the fields above or paste a profile."
                                />
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6">
                                <StepIntro
                                    k="03"
                                    title="What are we scoring?"
                                    sub="Pick how your emails relate, then paste up to three."
                                />
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {WIZARD_MODES.map((m) => {
                                        const active = d.mode === m.id
                                        const Icon = m.icon
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setMode(m.id)}
                                                className={`focusable rounded-2xl border p-4 text-left transition-all duration-150 ${
                                                    active
                                                        ? "border-brand/60 bg-brand/[0.08]"
                                                        : "border-bone/12 hover:border-bone/30"
                                                }`}
                                            >
                                                <Icon
                                                    size={18}
                                                    className={
                                                        active
                                                            ? "text-brand"
                                                            : "text-bone-dim"
                                                    }
                                                />
                                                <div
                                                    className={`mt-2 text-[0.95rem] font-medium ${
                                                        active
                                                            ? "text-bone"
                                                            : "text-bone-dim"
                                                    }`}
                                                >
                                                    {m.title}
                                                </div>
                                                <div className="mt-1 text-[0.78rem] leading-snug text-bone-faint">
                                                    {m.desc}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>

                                <div className="space-y-4">
                                    {d.emails.map((e, i) => (
                                        <div
                                            key={i}
                                            className="rounded-2xl border border-bone/12 bg-ink-2/40 p-4"
                                        >
                                            <div className="mb-3 flex items-center justify-between">
                                                <span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-brand">
                                                    {emailLabel(d.mode, i)}
                                                </span>
                                                {d.emails.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeEmail(i)
                                                        }
                                                        className="focusable rounded-full p-1 text-bone-faint transition-colors hover:text-crit"
                                                        aria-label="Remove email"
                                                    >
                                                        <X size={15} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="space-y-3">
                                                <Field
                                                    label="Subject line"
                                                    value={e.subject}
                                                    onChange={(v) =>
                                                        setEmail(i, "subject", v)
                                                    }
                                                    placeholder="Quick question about {company}"
                                                    mono
                                                />
                                                <Field
                                                    label="Email body"
                                                    textarea
                                                    rows={8}
                                                    mono
                                                    value={e.body}
                                                    onChange={(v) =>
                                                        setEmail(i, "body", v)
                                                    }
                                                    placeholder={`Hi {first_name},\n\nI noticed your team is hiring SDRs...\n\nWorth a quick look?\n\nBest, Name`}
                                                    hint={`${e.body.trim().length} chars · keep your merge tags, we read them too.`}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {d.emails.length < cap && (
                                        <button
                                            type="button"
                                            onClick={addEmail}
                                            className="focusable flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-bone/20 py-3 font-mono text-[0.74rem] uppercase tracking-[0.14em] text-bone-dim transition-colors hover:border-brand/50 hover:text-brand"
                                        >
                                            <Plus size={15} />
                                            Add{" "}
                                            {d.mode === "variations"
                                                ? "a variation"
                                                : d.mode === "sequence"
                                                ? "a step"
                                                : "an email"}
                                        </button>
                                    )}
                                    {cap < 3 && (
                                        <p className="text-center font-mono text-[0.62rem] uppercase tracking-[0.14em] text-bone-faint">
                                            {cap === 1
                                                ? "1 email"
                                                : `${cap} emails`}{" "}
                                            left on this link
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="flex items-center justify-between border-t border-bone/10 pt-5">
                {step > 0 ? (
                    <Button variant="ghost" onClick={() => go(step - 1)}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                ) : (
                    <Button variant="ghost" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4" />
                        Home
                    </Button>
                )}
                <Button onClick={handlePrimary} disabled={!canNext}>
                    {step < 2 ? (
                        <>
                            Continue
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                    ) : (
                        <>
                            Score{" "}
                            {d.emails.length > 1
                                ? `${d.emails.length} emails`
                                : "the email"}
                            <ScanLine className="h-4 w-4" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}

// ============================================================================
// Scanning  (from components/Scanning.tsx)
// ============================================================================
const SCAN_STAGES = [
    "Parsing structure & merge tags",
    "Loading ICP persona",
    "Simulating the 3-second skim",
    "Reading the email line by line",
    "Checking deliverability & spam risk",
    "Scoring across dimensions",
    "Compiling the diagnostic",
]
const STAGE_MS = 760
const MIN_TOTAL = SCAN_STAGES.length * STAGE_MS + 500

function Scanning({
    data,
    onMinComplete,
}: {
    data: IntakeData
    onMinComplete: () => void
}) {
    const [active, setActive] = useState(0)
    const [pct, setPct] = useState(0)
    const firedRef = useRef(false)
    useEffect(() => {
        const interval = setInterval(() => {
            setActive((a) => Math.min(a + 1, SCAN_STAGES.length - 1))
        }, STAGE_MS)
        let raf = 0
        const start = performance.now()
        const tick = (t: number) => {
            const p = Math.min((t - start) / MIN_TOTAL, 1)
            setPct(Math.min(Math.round(p * 100), 99))
            if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        const done = setTimeout(() => {
            if (!firedRef.current) {
                firedRef.current = true
                onMinComplete()
            }
        }, MIN_TOTAL)
        return () => {
            clearInterval(interval)
            cancelAnimationFrame(raf)
            clearTimeout(done)
        }
    }, [onMinComplete])
    return (
        <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-7">
            <header className="flex items-center justify-between">
                <Wordmark small />
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-gold">
                    scanning
                </span>
            </header>
            <div className="grid flex-1 items-center gap-10 py-10 md:grid-cols-[1fr_0.85fr]">
                <div className="panel relative overflow-hidden p-6 shadow-panel">
                    <div
                        className="pointer-events-none absolute inset-x-0 z-20 h-28"
                        style={{
                            background:
                                "linear-gradient(180deg, transparent, rgba(255,111,48,0.14) 55%, rgba(255,111,48,0.45))",
                            borderBottom: "1.5px solid rgba(255,111,48,0.85)",
                            animation: "sweep 2.4s ease-in-out infinite",
                        }}
                    />
                    <div className="mb-3 flex items-center justify-between border-b border-bone/10 pb-3 font-mono text-[0.66rem] text-bone-faint">
                        <span>{data.company || "specimen"}.eml</span>
                        <span className="text-brand">{pct}%</span>
                    </div>
                    {data.emails[0]?.subject && (
                        <p className="mb-3 font-mono text-[0.74rem] text-bone">
                            <span className="text-bone-faint">subj </span>
                            {data.emails[0].subject}
                        </p>
                    )}
                    <pre className="max-h-[16rem] overflow-hidden whitespace-pre-wrap font-mono text-[0.78rem] leading-relaxed text-bone-dim">
                        {(data.emails[0]?.body || "").slice(0, 620)}
                    </pre>
                    {data.emails.length > 1 && (
                        <div className="mt-3 font-mono text-[0.66rem] text-bone-faint">
                            + {data.emails.length - 1} more email
                            {data.emails.length - 1 > 1 ? "s" : ""} in this{" "}
                            {data.mode === "variations"
                                ? "test"
                                : data.mode === "sequence"
                                ? "sequence"
                                : "batch"}
                        </div>
                    )}
                </div>
                <div>
                    <div className="mb-5">
                        <div className="font-display text-4xl font-semibold tracking-tight text-bone">
                            {pct}
                            <span className="text-gold">%</span>
                        </div>
                        <div className="mt-1 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-bone-faint">
                            running diagnostic
                        </div>
                    </div>
                    <div className="space-y-3">
                        {SCAN_STAGES.map((s, i) => {
                            const isDone = i < active
                            const isCurrent = i === active
                            return (
                                <div key={s} className="flex items-center gap-3">
                                    <span
                                        className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors duration-300 ${
                                            isDone
                                                ? "border-good bg-good/20"
                                                : isCurrent
                                                ? "border-gold"
                                                : "border-bone/15"
                                        }`}
                                    >
                                        {isDone ? (
                                            <Check
                                                className="h-2.5 w-2.5 text-good"
                                                strokeWidth={3}
                                            />
                                        ) : isCurrent ? (
                                            <motion.span
                                                className="h-1.5 w-1.5 rounded-full bg-gold"
                                                animate={{ opacity: [1, 0.2, 1] }}
                                                transition={{
                                                    duration: 0.9,
                                                    repeat: Infinity,
                                                }}
                                            />
                                        ) : null}
                                    </span>
                                    <span
                                        className={`font-mono text-[0.78rem] transition-colors duration-300 ${
                                            isDone
                                                ? "text-bone-dim"
                                                : isCurrent
                                                ? "text-bone"
                                                : "text-bone-faint"
                                        }`}
                                    >
                                        {s}
                                        {isCurrent && (
                                            <span className="caret ml-1 text-gold">
                                                ▍
                                            </span>
                                        )}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// EmailMarkup  (from components/EmailMarkup.tsx)
// ============================================================================
type NumberedNote = LineNote & { n: number }
interface Seg {
    text: string
    note?: NumberedNote
}
function buildSegments(text: string, notes: NumberedNote[]): Seg[] {
    if (!text) return []
    const lower = text.toLowerCase()
    const matches: { start: number; end: number; note: NumberedNote }[] = []
    notes.forEach((note) => {
        const ex = note.excerpt.trim()
        if (!ex) return
        const idx = lower.indexOf(ex.toLowerCase())
        if (idx === -1) return
        matches.push({ start: idx, end: idx + ex.length, note })
    })
    matches.sort((a, b) => a.start - b.start)
    const accepted: typeof matches = []
    let lastEnd = -1
    for (const m of matches) {
        if (m.start >= lastEnd) {
            accepted.push(m)
            lastEnd = m.end
        }
    }
    const segs: Seg[] = []
    let cursor = 0
    for (const m of accepted) {
        if (m.start > cursor) segs.push({ text: text.slice(cursor, m.start) })
        segs.push({ text: text.slice(m.start, m.end), note: m.note })
        cursor = m.end
    }
    if (cursor < text.length) segs.push({ text: text.slice(cursor) })
    return segs
}
function Highlighted({
    segs,
    active,
    setActive,
}: {
    segs: Seg[]
    active: number | null
    setActive: (n: number | null) => void
}) {
    return (
        <>
            {segs.map((s, i) => {
                if (!s.note) return <span key={i}>{s.text}</span>
                const c = severityColor(s.note.severity)
                const isActive = active === s.note.n
                return (
                    <span
                        key={i}
                        onMouseEnter={() => setActive(s.note!.n)}
                        onMouseLeave={() => setActive(null)}
                        className="relative cursor-help rounded px-0.5 transition-shadow duration-150"
                        style={{
                            background: `${c}${isActive ? "33" : "1f"}`,
                            boxShadow: isActive
                                ? `inset 0 -2px 0 ${c}, 0 0 0 1px ${c}66`
                                : `inset 0 -2px 0 ${c}`,
                        }}
                    >
                        {s.text}
                        <sup
                            className="ml-0.5 font-mono text-[0.6em] font-semibold"
                            style={{ color: c }}
                        >
                            {s.note.n}
                        </sup>
                    </span>
                )
            })}
        </>
    )
}
function EmailMarkup({
    subject,
    body,
    notes,
}: {
    subject: string
    body: string
    notes: LineNote[]
}) {
    const [active, setActive] = useState<number | null>(null)
    const numbered: NumberedNote[] = notes.map((n, i) => ({ ...n, n: i + 1 }))
    const subjNotes = numbered.filter((n) => n.location === "subject")
    const bodyNotes = numbered.filter((n) => n.location === "body")
    const subjSegs = buildSegments(subject, subjNotes)
    const bodySegs = buildSegments(body, bodyNotes)
    return (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="panel overflow-hidden p-6 shadow-panel">
                <div className="mb-4 flex items-center justify-between border-b border-bone/10 pb-3">
                    <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-bone-faint">
                        your email, marked up
                    </span>
                    <span className="font-mono text-[0.66rem] text-bone-faint">
                        {notes.length} notes
                    </span>
                </div>
                {subject && (
                    <div className="mb-4">
                        <div className="mb-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-bone-faint">
                            subject
                        </div>
                        <div className="whitespace-pre-wrap font-mono text-[0.9rem] text-bone">
                            {subjSegs.length ? (
                                <Highlighted
                                    segs={subjSegs}
                                    active={active}
                                    setActive={setActive}
                                />
                            ) : (
                                subject
                            )}
                        </div>
                    </div>
                )}
                <div className="whitespace-pre-wrap text-[0.92rem] leading-[1.7] text-bone-dim">
                    <Highlighted
                        segs={bodySegs}
                        active={active}
                        setActive={setActive}
                    />
                </div>
            </div>
            <div className="space-y-3">
                {numbered.length === 0 && (
                    <div className="rounded-xl border border-good/20 bg-good/[0.05] p-4 text-[0.86rem] leading-snug text-bone-dim">
                        No line-level issues were flagged. Nothing in the wording
                        tripped a specific red flag. Check the breakdown and
                        priority fixes below for the bigger-picture read.
                    </div>
                )}
                {numbered.map((note, i) => {
                    const c = severityColor(note.severity)
                    const isActive = active === note.n
                    return (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: 16 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: "-30px" }}
                            transition={{ duration: 0.5, delay: i * 0.06 }}
                            onMouseEnter={() => setActive(note.n)}
                            onMouseLeave={() => setActive(null)}
                            className="rounded-xl border p-3.5 transition-all duration-200"
                            style={{
                                borderColor: isActive
                                    ? `${c}66`
                                    : "rgba(20,20,24,0.12)",
                                background: isActive
                                    ? `${c}0d`
                                    : "rgba(245,244,242,0.85)",
                            }}
                        >
                            <div className="flex items-center gap-2.5">
                                <span
                                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[0.66rem] font-semibold"
                                    style={{ background: `${c}22`, color: c }}
                                >
                                    {note.n}
                                </span>
                                <span
                                    className="font-mono text-[0.58rem] uppercase tracking-[0.14em]"
                                    style={{ color: c }}
                                >
                                    {note.severity} · {note.location}
                                </span>
                            </div>
                            <p className="mt-2 text-[0.86rem] font-medium leading-snug text-bone">
                                {note.issue}
                            </p>
                            <p className="mt-1.5 text-[0.82rem] leading-snug text-bone-dim">
                                {note.suggestion}
                            </p>
                        </motion.div>
                    )
                })}
            </div>
        </div>
    )
}

// ============================================================================
// LockedRewrite  (from components/LockedRewrite.tsx)
// ============================================================================
function buildTeaser(body: string): { teaser: string; locked: boolean } {
    const text = (body || "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{2,}/g, "\n")
        .trim()
    if (!text) return { teaser: "", locked: false }
    const cap = Math.max(160, Math.min(230, Math.floor(text.length * 0.4)))
    if (text.length <= cap) return { teaser: text, locked: false }
    const slice = text.slice(0, cap)
    const sentenceEnd = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? ")
    )
    let cut: number
    if (sentenceEnd > cap * 0.45) cut = sentenceEnd + 1
    else {
        const nl = slice.lastIndexOf("\n")
        const sp = slice.lastIndexOf(" ")
        cut = nl > cap * 0.5 ? nl : sp > 0 ? sp : cap
    }
    return { teaser: text.slice(0, cut).trim(), locked: true }
}
function CopyButton({ text }: { text: string }) {
    const [done, setDone] = useState(false)
    return (
        <button
            onClick={() => {
                navigator.clipboard?.writeText(text)
                setDone(true)
                setTimeout(() => setDone(false), 1500)
            }}
            className="focusable inline-flex items-center gap-1.5 rounded-full border border-bone/14 bg-ink-2 px-3 py-1.5 text-xs text-bone-dim transition-colors hover:border-brand/40 hover:text-bone"
        >
            {done ? (
                <>
                    <CheckCheck size={13} className="text-good" /> Copied
                </>
            ) : (
                <>
                    <Copy size={13} /> Copy
                </>
            )}
        </button>
    )
}
function LockedRewrite({ rewrite }: { rewrite: Rewrite }) {
    const { teaser, locked } = buildTeaser(rewrite.body)
    return (
        <div className="panel overflow-hidden rounded-3xl">
            <div className="border-b border-bone/8 p-6">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                    Subject lines to test
                </div>
                <div className="space-y-2.5">
                    {rewrite.subjectOptions.length === 0 && (
                        <p className="text-sm text-bone-faint">
                            No subject suggestions.
                        </p>
                    )}
                    {rewrite.subjectOptions.map((s, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between gap-3 rounded-xl border border-bone/10 bg-ink-2/60 px-4 py-3"
                        >
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-xs text-brand">
                                    {String.fromCharCode(65 + i)}
                                </span>
                                <span className="text-sm text-bone">{s}</span>
                            </div>
                            <CopyButton text={s} />
                        </div>
                    ))}
                </div>
            </div>
            <div className="relative p-6">
                <div
                    className="absolute left-0 top-6 h-[calc(100%-3rem)] w-0.5 rounded-full"
                    style={{ background: BRAND_HEX }}
                />
                <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                    Rewritten body
                </div>
                {teaser && (
                    <div className="relative">
                        <div className="whitespace-pre-wrap pl-4 font-mono text-[13.5px] leading-relaxed text-bone">
                            {teaser}
                            {locked && <span className="text-bone-dim">…</span>}
                        </div>
                        {locked && (
                            <div
                                className="pointer-events-none absolute inset-x-0 bottom-0 h-14"
                                style={{
                                    background:
                                        "linear-gradient(180deg, transparent, var(--ink, #ffffff))",
                                }}
                            />
                        )}
                    </div>
                )}
                {locked && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="mt-4 rounded-2xl border border-brand/30 bg-brand/[0.06] p-5 sm:p-6"
                    >
                        <div className="flex items-start gap-4">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand/40 bg-brand/10 text-brand">
                                <Lock size={17} />
                            </div>
                            <div className="min-w-0">
                                <div className="font-display text-lg tracking-tight text-bone">
                                    The full rewrite is one call away
                                </div>
                                <p className="mt-1.5 text-[13.5px] leading-relaxed text-bone-dim">
                                    You&rsquo;re seeing the opening. On a quick
                                    call, {BRAND.company} walks you through the
                                    complete, ready-to-send rewrite, and shows how
                                    we&rsquo;d build the system that writes emails
                                    like this at scale.
                                </p>
                                <a
                                    href={BRAND.bookACall}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="focusable mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.02]"
                                >
                                    Book a call to unlock it
                                    <ArrowUpRight size={16} />
                                </a>
                            </div>
                        </div>
                    </motion.div>
                )}
                {!teaser && (
                    <div className="pl-4 text-sm text-bone-faint">
                        No rewrite generated.
                    </div>
                )}
            </div>
            {rewrite.rationale && (
                <div className="border-t border-bone/8 bg-ink-2/40 p-5">
                    <div className="flex items-start gap-3">
                        <Sparkles
                            size={15}
                            className="mt-0.5 shrink-0 text-brand"
                        />
                        <p className="text-[13px] leading-relaxed text-bone-dim">
                            <span className="text-bone">Why this approach: </span>
                            {rewrite.rationale}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

// ============================================================================
// Report  (from components/Report.tsx)
// ============================================================================
const MODE_META: Record<
    CampaignMode,
    { label: string; icon: typeof Mail; insight: string }
> = {
    single: { label: "Standalone emails", icon: Mail, insight: "Portfolio read" },
    sequence: {
        label: "Follow-up sequence",
        icon: Layers,
        insight: "Sequence flow",
    },
    variations: {
        label: "A/B/C variations",
        icon: GitCompare,
        insight: "Why the winner wins",
    },
}
function Reveal({
    children,
    delay = 0,
    y = 18,
    className = "",
}: {
    children: React.ReactNode
    delay?: number
    y?: number
    className?: string
}) {
    const ref = useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { once: true, margin: "-60px" })
    return (
        <motion.div
            ref={ref}
            className={className}
            initial={{ opacity: 0, y }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
        >
            {children}
        </motion.div>
    )
}
function SectionHead({
    index,
    eyebrow,
    title,
    sub,
    icon,
}: {
    index: string
    eyebrow: string
    title: string
    sub?: string
    icon: React.ReactNode
}) {
    return (
        <Reveal>
            <div className="flex items-start gap-4">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-bone/12 bg-ink-3 text-brand">
                    {icon}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] tracking-widest text-bone-faint">
                            {index}
                        </span>
                        <Eyebrow>{eyebrow}</Eyebrow>
                    </div>
                    <h2 className="mt-1 font-display text-2xl tracking-tight text-bone sm:text-[28px]">
                        {title}
                    </h2>
                    {sub && (
                        <p className="mt-1 max-w-2xl text-sm text-bone-dim">
                            {sub}
                        </p>
                    )}
                </div>
            </div>
        </Reveal>
    )
}
function EmailDetail({
    email,
    originalBody,
    isWinner,
}: {
    email: EmailScore
    originalBody: string
    isWinner: boolean
}) {
    const c = scoreColor(email.overallScore)
    return (
        <div className="space-y-10">
            <div className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-bone/10 bg-ink-2/40 p-6">
                <div className="flex items-center gap-5">
                    <div className="relative grid h-20 w-20 place-items-center">
                        <RadialGauge
                            score={email.overallScore}
                            size={80}
                            stroke={6}
                        />
                        <span
                            className="absolute font-display text-xl"
                            style={{ color: c }}
                        >
                            <AnimatedNumber value={email.overallScore} />
                        </span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] uppercase tracking-widest text-bone-faint">
                                {email.label}
                            </span>
                            {isWinner && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-good/40 bg-good/10 px-2 py-0.5 text-[10px] font-medium text-good">
                                    <Trophy size={10} /> Winner
                                </span>
                            )}
                        </div>
                        <div className="mt-0.5 font-display text-2xl tracking-tight text-bone">
                            {email.headline}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-sm text-bone-dim">
                            <span style={{ color: c }} className="font-medium">
                                Grade {email.grade}
                            </span>
                            <span className="text-bone-faint">·</span>
                            <span>{scoreLabel(email.overallScore)}</span>
                        </div>
                    </div>
                </div>
                <div
                    className="inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2.5"
                    style={{
                        borderColor: `${bandColor(email.replyLikelihood.band)}40`,
                        background: `${bandColor(email.replyLikelihood.band)}12`,
                    }}
                >
                    <Reply
                        size={16}
                        style={{ color: bandColor(email.replyLikelihood.band) }}
                    />
                    <div className="leading-tight">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                            Reply likelihood
                        </div>
                        <div className="text-sm">
                            <span
                                className="font-semibold"
                                style={{
                                    color: bandColor(email.replyLikelihood.band),
                                }}
                            >
                                {email.replyLikelihood.band}
                            </span>{" "}
                            <span className="font-mono text-bone-dim">
                                {email.replyLikelihood.range}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {email.verdict && (
                <p className="-mt-4 max-w-3xl text-[15px] leading-relaxed text-bone-dim">
                    {email.verdict}
                </p>
            )}

            <div className="panel rounded-3xl p-6 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-full border border-brand/30 bg-brand/10 text-brand">
                            <Eye size={17} />
                        </div>
                        <div>
                            <div className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                                Reading as
                            </div>
                            <div className="font-display text-base tracking-tight text-bone">
                                {email.icp.persona}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-bone/12 bg-ink-2 px-3.5 py-2">
                        <Clock size={14} className="text-brand" />
                        <span className="font-mono text-xs text-bone-dim">
                            decides in
                        </span>
                        <span className="font-display text-sm text-bone">
                            {email.icp.secondsToDecision}
                        </span>
                    </div>
                </div>
                {email.icp.firstReaction && (
                    <p className="mt-5 font-display text-lg italic leading-snug text-bone">
                        &ldquo;{email.icp.firstReaction}&rdquo;
                    </p>
                )}
                {email.icp.feeling && (
                    <div className="mt-2 inline-flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                        <span className="text-sm text-bone-dim">
                            {email.icp.feeling}
                        </span>
                    </div>
                )}
                {email.icp.readThrough && (
                    <p className="mt-4 text-[15px] leading-relaxed text-bone-dim">
                        {email.icp.readThrough}
                    </p>
                )}
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-good/20 bg-good/[0.05] p-4">
                        <div className="mb-2 flex items-center gap-2">
                            <Check size={14} className="text-good" />
                            <span className="font-mono text-[10px] uppercase tracking-widest text-good">
                                What lands
                            </span>
                        </div>
                        <ul className="space-y-2">
                            {email.icp.landsWell.length === 0 && (
                                <li className="text-sm text-bone-faint">
                                    Nothing landed cleanly.
                                </li>
                            )}
                            {email.icp.landsWell.map((s, i) => (
                                <li
                                    key={i}
                                    className="flex gap-2 text-sm text-bone-dim"
                                >
                                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-good" />
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="rounded-2xl border border-crit/20 bg-crit/[0.05] p-4">
                        <div className="mb-2 flex items-center gap-2">
                            <X size={14} className="text-crit" />
                            <span className="font-mono text-[10px] uppercase tracking-widest text-crit">
                                Where they drop off
                            </span>
                        </div>
                        <ul className="space-y-2">
                            {email.icp.dropsOff.length === 0 && (
                                <li className="text-sm text-bone-faint">
                                    No major drop-off.
                                </li>
                            )}
                            {email.icp.dropsOff.map((s, i) => (
                                <li
                                    key={i}
                                    className="flex gap-2 text-sm text-bone-dim"
                                >
                                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-crit" />
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                {email.icp.replyReasoning && (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-bone/10 bg-ink-2/40 p-4">
                        <Reply
                            size={15}
                            className={`mt-0.5 shrink-0 ${
                                email.icp.wouldReply ? "text-good" : "text-crit"
                            }`}
                        />
                        <p className="text-sm leading-relaxed text-bone-dim">
                            <span className="text-bone">
                                {email.icp.wouldReply
                                    ? "Would reply. "
                                    : "Would not reply. "}
                            </span>
                            {email.icp.replyReasoning}
                        </p>
                    </div>
                )}
            </div>

            <div>
                <div className="mb-4">
                    <Eyebrow>Line by line</Eyebrow>
                    <h3 className="mt-1 font-display text-xl tracking-tight text-bone">
                        The email, marked up
                    </h3>
                </div>
                <EmailMarkup
                    subject={email.subject}
                    body={originalBody}
                    notes={email.lineNotes}
                />
            </div>

            {email.dimensions.length > 0 && (
                <div>
                    <div className="mb-4">
                        <Eyebrow>The breakdown</Eyebrow>
                        <h3 className="mt-1 font-display text-xl tracking-tight text-bone">
                            Scored on what matters
                        </h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {email.dimensions.map((d, i) => {
                            const dc = statusColor(d.status)
                            return (
                                <Reveal key={d.key + i} delay={i * 0.04}>
                                    <div className="panel h-full rounded-2xl p-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-[15px] font-medium text-bone">
                                                {d.label}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="font-display text-lg"
                                                    style={{ color: dc }}
                                                >
                                                    <AnimatedNumber
                                                        value={d.score}
                                                    />
                                                </span>
                                                <Tag color={dc} subtle>
                                                    {d.status}
                                                </Tag>
                                            </div>
                                        </div>
                                        <div className="mt-3">
                                            <Bar
                                                value={d.score}
                                                color={dc}
                                                delay={i * 0.04 + 0.1}
                                            />
                                        </div>
                                        <p className="mt-3 text-[13px] leading-relaxed text-bone-dim">
                                            {d.summary}
                                        </p>
                                    </div>
                                </Reveal>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
                <div className="panel rounded-2xl p-6">
                    <div className="mb-4 flex items-center gap-2">
                        <ShieldAlert size={16} className="text-brand" />
                        <Eyebrow>Deliverability</Eyebrow>
                    </div>
                    <div className="flex items-center gap-5">
                        <div className="relative grid h-24 w-24 shrink-0 place-items-center">
                            <RadialGauge
                                score={email.deliverability.score}
                                size={96}
                                stroke={7}
                            />
                            <span
                                className="absolute font-display text-xl"
                                style={{
                                    color: scoreColor(
                                        email.deliverability.score
                                    ),
                                }}
                            >
                                <AnimatedNumber
                                    value={email.deliverability.score}
                                />
                            </span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm leading-relaxed text-bone-dim">
                                {email.deliverability.note}
                            </p>
                            {email.deliverability.triggers.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {email.deliverability.triggers.map((t, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-weak/30 bg-weak/10 px-2.5 py-1 text-xs text-bone"
                                        >
                                            <ShieldAlert
                                                size={11}
                                                className="text-weak"
                                            />
                                            {t}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="panel rounded-2xl p-6">
                    <div className="mb-4 flex items-center gap-2">
                        <Check size={16} className="text-good" />
                        <Eyebrow>What&rsquo;s working</Eyebrow>
                    </div>
                    {email.strengths.length === 0 ? (
                        <p className="text-sm text-bone-faint">
                            Nothing notable to keep. Start from the rewrite.
                        </p>
                    ) : (
                        <ul className="space-y-2.5">
                            {email.strengths.map((s, i) => (
                                <li
                                    key={i}
                                    className="flex items-start gap-2.5 text-sm text-bone-dim"
                                >
                                    <Check
                                        size={15}
                                        className="mt-0.5 shrink-0 text-good"
                                    />
                                    {s}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {email.priorityFixes.length > 0 && (
                <div>
                    <div className="mb-4">
                        <Eyebrow>If you change a few things</Eyebrow>
                        <h3 className="mt-1 font-display text-xl tracking-tight text-bone">
                            Priority fixes
                        </h3>
                    </div>
                    <div className="space-y-3">
                        {email.priorityFixes
                            .slice()
                            .sort((a, b) => a.rank - b.rank)
                            .map((f, i) => {
                                const fc = impactColor(f.impact)
                                return (
                                    <Reveal key={i} delay={i * 0.04}>
                                        <div className="panel flex items-start gap-4 rounded-2xl p-5">
                                            <div
                                                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display text-lg"
                                                style={{
                                                    color: fc,
                                                    background: `${fc}14`,
                                                    border: `1px solid ${fc}35`,
                                                }}
                                            >
                                                {f.rank}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-[15px] font-medium text-bone">
                                                        {f.fix}
                                                    </span>
                                                    <Tag color={fc} subtle>
                                                        {f.impact} impact
                                                    </Tag>
                                                </div>
                                                <p className="mt-1.5 text-[13px] leading-relaxed text-bone-dim">
                                                    {f.why}
                                                </p>
                                            </div>
                                        </div>
                                    </Reveal>
                                )
                            })}
                    </div>
                </div>
            )}

            <div>
                <div className="mb-4">
                    <Eyebrow>Our take</Eyebrow>
                    <h3 className="mt-1 font-display text-xl tracking-tight text-bone">
                        A version we&rsquo;d send
                    </h3>
                </div>
                <LockedRewrite rewrite={email.rewrite} />
            </div>
        </div>
    )
}
function Report({
    analysis,
    intake,
    onReset,
    demo = false,
}: {
    analysis: Analysis
    intake: IntakeData
    onReset: () => void
    demo?: boolean
}) {
    const { mode, campaign, emails } = analysis
    const [downloading, setDownloading] = useState(false)
    const [dlError, setDlError] = useState("")
    const [active, setActive] = useState(0)
    const oColor = scoreColor(campaign.overallScore)
    const meta = MODE_META[mode] || MODE_META.single
    const ModeIcon = meta.icon
    const multi = emails.length > 1
    async function handleDownload() {
        setDownloading(true)
        setDlError("")
        try {
            await downloadReport(analysis, intake)
        } catch (e) {
            console.error("[pdf] generation failed:", e)
            setDlError("Couldn't generate the PDF. Please try again.")
            setTimeout(() => setDlError(""), 4000)
        } finally {
            setTimeout(() => setDownloading(false), 600)
        }
    }
    const activeEmail = emails[active] || emails[0]
    const activeBody = intake.emails[active]?.body ?? ""
    return (
        <div className="relative z-10 mx-auto max-w-5xl px-5 pb-28 pt-7 sm:px-8">
            {dlError && (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-crit/40 bg-ink-2 px-4 py-2 text-sm text-bone shadow-panel"
                    role="alert"
                >
                    {dlError}
                </motion.div>
            )}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="sticky top-0 z-30 -mx-5 mb-2 flex items-center justify-between gap-3 border-b border-bone/8 bg-ink/70 px-5 py-3 backdrop-blur-xl sm:-mx-8 sm:px-8"
            >
                <Wordmark small />
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={onReset}>
                        <span className="inline-flex items-center gap-1.5">
                            <RotateCcw size={14} />{" "}
                            {demo ? "Back" : "Scan another"}
                        </span>
                    </Button>
                    <Button onClick={handleDownload} disabled={downloading}>
                        <span className="inline-flex items-center gap-1.5">
                            <Download size={15} />
                            {downloading ? "Preparing…" : "Download report"}
                        </span>
                    </Button>
                </div>
            </motion.div>

            {demo && (
                <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/[0.06] px-4 py-3"
                >
                    <div className="flex items-center gap-2.5">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/15 text-brand">
                            <Eye size={13} />
                        </span>
                        <span className="text-[13.5px] leading-snug text-bone-dim">
                            <span className="text-bone">Sample report.</span> This
                            is a simulation on a made-up email, showing exactly
                            what you&rsquo;d get on your own.
                        </span>
                    </div>
                    <a
                        href={BRAND.bookACall}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focusable inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-medium text-white transition-transform hover:scale-[1.02]"
                    >
                        Get your own link
                        <ArrowUpRight size={14} />
                    </a>
                </motion.div>
            )}

            <section className="mt-7 grid gap-8 sm:mt-10 lg:grid-cols-[auto_1fr] lg:gap-12">
                <Reveal className="flex flex-col items-center lg:items-start">
                    <div className="relative grid place-items-center">
                        <RadialGauge
                            score={campaign.overallScore}
                            size={208}
                            stroke={12}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div
                                className="font-display text-[58px] leading-none tracking-tight"
                                style={{ color: oColor }}
                            >
                                <AnimatedNumber
                                    value={campaign.overallScore}
                                    duration={1500}
                                />
                            </div>
                            <div className="mt-0.5 font-mono text-[11px] tracking-widest text-bone-faint">
                                OUT OF 100
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <span
                            className="grid h-9 min-w-9 place-items-center rounded-lg px-2 font-display text-lg"
                            style={{
                                color: oColor,
                                background: `${oColor}1A`,
                                border: `1px solid ${oColor}40`,
                            }}
                        >
                            {campaign.grade}
                        </span>
                        <span className="text-sm text-bone-dim">
                            {scoreLabel(campaign.overallScore)}
                        </span>
                    </div>
                </Reveal>

                <Reveal delay={0.12} className="flex flex-col justify-center">
                    <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-bone/12 bg-ink-2 px-3 py-1.5">
                        <ModeIcon size={13} className="text-brand" />
                        <span className="font-mono text-[11px] uppercase tracking-widest text-bone-dim">
                            {meta.label} · {emails.length} email
                            {emails.length > 1 ? "s" : ""}
                        </span>
                    </div>
                    <h1 className="font-display text-3xl leading-[1.1] tracking-tight text-bone sm:text-[40px]">
                        {campaign.headline}
                    </h1>
                    <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-bone-dim">
                        {campaign.verdict}
                    </p>
                    {campaign.summary && (
                        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-bone-faint">
                            {campaign.summary}
                        </p>
                    )}
                    {mode === "variations" && campaign.winnerLabel && (
                        <div className="mt-5 inline-flex w-fit items-center gap-2 rounded-2xl border border-good/40 bg-good/10 px-4 py-2.5">
                            <Trophy size={16} className="text-good" />
                            <span className="text-sm text-bone">
                                Winner:{" "}
                                <span className="font-semibold text-good">
                                    {campaign.winnerLabel}
                                </span>
                            </span>
                        </div>
                    )}
                </Reveal>
            </section>

            {(campaign.modeInsight || campaign.recommendation) && (
                <section className="mt-14 sm:mt-20">
                    <SectionHead
                        index="01"
                        eyebrow={meta.insight}
                        title={
                            mode === "sequence"
                                ? "How the sequence flows"
                                : mode === "variations"
                                ? "Why the winner wins"
                                : "The portfolio read"
                        }
                        icon={<ModeIcon size={18} />}
                    />
                    <div className="mt-7 grid gap-5 lg:grid-cols-2">
                        {campaign.modeInsight && (
                            <Reveal>
                                <div className="panel h-full rounded-2xl p-6">
                                    <div className="mb-3 flex items-center gap-2">
                                        <Layers
                                            size={15}
                                            className="text-brand"
                                        />
                                        <span className="font-mono text-[10px] uppercase tracking-widest text-bone-faint">
                                            {meta.insight}
                                        </span>
                                    </div>
                                    <p className="text-[15px] leading-relaxed text-bone-dim">
                                        {campaign.modeInsight}
                                    </p>
                                </div>
                            </Reveal>
                        )}
                        {campaign.recommendation && (
                            <Reveal delay={0.08}>
                                <div className="h-full rounded-2xl border border-brand/30 bg-brand/[0.06] p-6">
                                    <div className="mb-3 flex items-center gap-2">
                                        <Lightbulb
                                            size={15}
                                            className="text-brand"
                                        />
                                        <span className="font-mono text-[10px] uppercase tracking-widest text-brand">
                                            Do this first
                                        </span>
                                    </div>
                                    <p className="text-[15px] leading-relaxed text-bone">
                                        {campaign.recommendation}
                                    </p>
                                </div>
                            </Reveal>
                        )}
                    </div>
                </section>
            )}

            {campaign.angles.length > 0 && (
                <section className="mt-14 sm:mt-20">
                    <SectionHead
                        index="02"
                        eyebrow="Different desks, different reads"
                        title="How each persona sees it"
                        sub="The same submission, judged through the lenses that decide its fate."
                        icon={<Eye size={18} />}
                    />
                    <div className="mt-7 grid gap-4 md:grid-cols-3">
                        {campaign.angles.map((ang, i) => (
                            <Reveal key={i} delay={i * 0.07}>
                                <div className="panel relative h-full overflow-hidden rounded-2xl p-5">
                                    <div className="absolute right-4 top-4 font-display text-4xl text-bone/[0.06]">
                                        0{i + 1}
                                    </div>
                                    <div className="mb-3 inline-flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                                        <span className="font-display text-base tracking-tight text-bone">
                                            {ang.lens}
                                        </span>
                                    </div>
                                    <p className="text-sm leading-relaxed text-bone-dim">
                                        {ang.read}
                                    </p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </section>
            )}

            <section className="mt-14 sm:mt-20">
                <SectionHead
                    index="03"
                    eyebrow={multi ? "Email by email" : "The email"}
                    title={multi ? "Each email, in detail" : "Full diagnostic"}
                    icon={<Gauge size={18} />}
                />
                {multi && (
                    <Reveal>
                        <div className="mt-6 flex flex-wrap gap-2">
                            {emails.map((e, i) => {
                                const isActive = active === i
                                const ec = scoreColor(e.overallScore)
                                const isWinner =
                                    mode === "variations" &&
                                    campaign.winnerLabel === e.label
                                return (
                                    <button
                                        key={i}
                                        onClick={() => setActive(i)}
                                        className={`focusable flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 transition-all ${
                                            isActive
                                                ? "border-brand/50 bg-brand/[0.08]"
                                                : "border-bone/12 hover:border-bone/30"
                                        }`}
                                    >
                                        <span
                                            className="font-display text-sm"
                                            style={{
                                                color: isActive ? ec : undefined,
                                            }}
                                        >
                                            {e.overallScore}
                                        </span>
                                        <span
                                            className={`text-sm ${
                                                isActive
                                                    ? "text-bone"
                                                    : "text-bone-dim"
                                            }`}
                                        >
                                            {e.label}
                                        </span>
                                        {isWinner && (
                                            <Trophy
                                                size={12}
                                                className="text-good"
                                            />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </Reveal>
                )}
                <div className="mt-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={active}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.35 }}
                        >
                            <EmailDetail
                                email={activeEmail}
                                originalBody={activeBody}
                                isWinner={
                                    mode === "variations" &&
                                    campaign.winnerLabel ===
                                        (activeEmail?.label || "")
                                }
                            />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </section>

            <Reveal>
                <div className="mt-16 flex flex-col items-center gap-5 rounded-3xl border border-bone/10 bg-gradient-to-b from-ink-2/60 to-transparent p-8 text-center">
                    <div className="font-display text-xl tracking-tight text-bone">
                        Want emails that score like this, on autopilot?
                    </div>
                    <p className="max-w-md text-sm leading-relaxed text-bone-dim">
                        {BRAND.signoff} Side Kick builds the AI SDR system that
                        finds intent, writes the email, and books the meeting.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <a
                            href={BRAND.bookACall}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="focusable inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.02]"
                        >
                            Book a demo
                            <ArrowUpRight size={16} />
                        </a>
                        <Button
                            variant="ghost"
                            onClick={handleDownload}
                            disabled={downloading}
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <Download size={15} />
                                {downloading ? "Preparing…" : "Download report"}
                            </span>
                        </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-bone-faint">
                        <span>Scored by</span>
                        <Wordmark small />
                    </div>
                </div>
            </Reveal>
        </div>
    )
}

// ============================================================================
// Demo dataset — a prefilled simulation so prospects without a link can see
// exactly what they'd get, without spending a scan. Mirrors the hero specimen.
// ============================================================================
const DEMO_INTAKE: IntakeData = {
    company: "Acme",
    website: "acme.io",
    offering: "An AI platform that helps revenue teams automate prospecting.",
    icpTitle: "VP of Sales at a Series B SaaS",
    icpIndustry: "B2B SaaS",
    icpCompanySize: "201-1k",
    icpPain: "Reps spend hours on manual prospecting instead of selling.",
    icpNotes: "",
    goal: "Book a meeting",
    mode: "single",
    emails: [
        {
            subject: "Quick question about Acme",
            body: "Hi {first_name}, I hope this email finds you well.\n\nI'm reaching out because we help companies 10x their revenue with our revolutionary AI-powered platform.\n\nWould you be open to a quick 15-minute call sometime this week to explore synergies?\n\nBest,\nJordan",
        },
    ],
}
const DEMO_ANALYSIS: Analysis = {
    mode: "single",
    campaign: {
        overallScore: 31,
        grade: "D",
        headline: "Generic and skippable",
        verdict:
            "This reads like a template your prospect has deleted a hundred times. It leads with the sender, makes an unbelievable claim, and asks for time before earning any. A busy VP archives it in the first two seconds.",
        summary:
            "Nothing here is specific to the recipient or their world, so there is no reason to keep reading.",
        recommendation:
            "Cut the greeting filler and the '10x revenue' claim. Open with one specific, true observation about their team, then make a smaller ask.",
        modeInsight:
            "As a standalone, this email carries no signal that it was written for this person. The opening line is interchangeable with any vendor's.",
        winnerLabel: "",
        angles: [
            {
                lens: "The Skeptic",
                read: "'Revolutionary AI-powered platform' with no proof reads as hype. I don't believe the 10x claim, so I don't believe the rest.",
            },
            {
                lens: "The Busy Executive",
                read: "No specific reason this is about me. I get twenty of these a day, and this one gives me nothing to hold onto in the first line.",
            },
            {
                lens: "The Deliverability Filter",
                read: "'10x their revenue', 'quick 15-minute call' and merge-tag-only personalisation are classic spam-adjacent patterns that hurt inbox placement.",
            },
        ],
    },
    emails: [
        {
            label: "Email 1",
            subject: "Quick question about Acme",
            overallScore: 31,
            grade: "D",
            headline: "Generic and skippable",
            verdict:
                "A textbook spray-and-pray cold email: sender-first, claim-heavy, and asking for a call before giving a single reason to take one.",
            replyLikelihood: {
                band: "Very Low",
                range: "0-1%",
                rationale:
                    "There is no relevance hook and the ask is too big for a first touch, so almost no one in this ICP replies.",
            },
            icp: {
                persona: "VP of Sales, Series B SaaS",
                secondsToDecision: "~2s",
                firstReaction:
                    "Another vendor promising to 10x my revenue. Archive.",
                readThrough:
                    "I open on a phone between meetings. The greeting tells me nothing, the second line is a claim I've heard from ten other tools this month, and the ask is a call I have no reason to take. I'm gone before the sign-off.",
                landsWell: ["The subject is short and low-pressure."],
                dropsOff: [
                    "'I hope this email finds you well' signals a template.",
                    "'10x their revenue' is an unbelievable, unproven claim.",
                    "The 15-minute-call ask comes before any value.",
                ],
                wouldReply: false,
                replyReasoning:
                    "Nothing connects to my actual situation, so there's no reason to spend a reply on it.",
                feeling: "Mildly annoyed, mostly indifferent.",
            },
            dimensions: [
                {
                    key: "relevance",
                    label: "Relevance to me",
                    score: 18,
                    status: "critical",
                    summary:
                        "Zero signal it was written for this person or company. Fully interchangeable.",
                },
                {
                    key: "hook",
                    label: "Opening hook",
                    score: 22,
                    status: "critical",
                    summary:
                        "Opens with filler and the sender, not with the reader.",
                },
                {
                    key: "credibility",
                    label: "Credibility",
                    score: 30,
                    status: "weak",
                    summary:
                        "The '10x' claim with no proof actively lowers trust.",
                },
                {
                    key: "cta",
                    label: "Call to action",
                    score: 40,
                    status: "weak",
                    summary:
                        "A 15-minute call is too big an ask for a cold first touch.",
                },
                {
                    key: "clarity",
                    label: "Clarity & brevity",
                    score: 58,
                    status: "ok",
                    summary:
                        "It's short and readable, which is the one thing going for it.",
                },
            ],
            lineNotes: [
                {
                    excerpt: "I hope this email finds you well",
                    location: "body",
                    severity: "medium",
                    issue: "Template filler that signals a mass send.",
                    suggestion:
                        "Delete it. Open with a specific observation about their team instead.",
                },
                {
                    excerpt: "10x their revenue",
                    location: "body",
                    severity: "high",
                    issue: "An unbelievable, unproven claim that kills credibility.",
                    suggestion:
                        "Replace with a concrete, verifiable outcome tied to a comparable company.",
                },
                {
                    excerpt: "revolutionary AI-powered platform",
                    location: "body",
                    severity: "medium",
                    issue: "Vague hype language every vendor uses.",
                    suggestion:
                        "Say what it actually does in plain words, specific to their pain.",
                },
                {
                    excerpt: "quick 15-minute call sometime this week",
                    location: "body",
                    severity: "medium",
                    issue: "The ask is too large before any value is given.",
                    suggestion:
                        "Ask a low-friction question, or offer something useful before requesting time.",
                },
            ],
            deliverability: {
                score: 52,
                triggers: ["10x claim", "generic merge tag only", "'synergies'"],
                note: "Hype phrasing and template patterns nudge this toward promotions/spam filtering.",
            },
            strengths: [
                "Short and easy to read.",
                "Subject line is low-pressure and non-spammy.",
            ],
            priorityFixes: [
                {
                    rank: 1,
                    fix: "Open with one specific, true line about the prospect.",
                    impact: "high",
                    why: "Relevance in the first line is the single biggest driver of whether they keep reading.",
                },
                {
                    rank: 2,
                    fix: "Cut the '10x revenue' claim.",
                    impact: "high",
                    why: "An unproven mega-claim destroys trust and triggers filters.",
                },
                {
                    rank: 3,
                    fix: "Shrink the ask.",
                    impact: "medium",
                    why: "A smaller, easier yes converts far better on a cold first touch.",
                },
            ],
            rewrite: {
                subjectOptions: [
                    "your SDRs + 6 hours a week",
                    "Acme's outbound, minus the manual part",
                    "a question about Acme's prospecting",
                ],
                body: "Hi {first_name},\n\nSaw Acme's hiring three SDRs this quarter, usually a sign the team's drowning in manual prospecting rather than selling.\n\nWe help RevOps teams hand that work to an AI system that finds intent and drafts the first touch, so reps start their day with warm accounts instead of a blank list. Two similar Series B teams cut prospecting time by roughly a third in the first month.\n\nWorth a two-line reply on whether this is even a priority for you right now?\n\nBest,\nJordan",
                rationale:
                    "Leads with a specific, true observation, replaces the hype claim with a concrete outcome from comparable teams, and swaps the call ask for a low-friction reply.",
            },
        },
    ],
}

// ============================================================================
// Coldscore orchestrator  (from components/Coldscore.tsx)
// ============================================================================
type Phase = "hero" | "intake" | "scanning" | "report" | "error" | "exhausted"
type ApiResult =
    | { ok: true; analysis: Analysis; remaining: number | null }
    | { ok: false; error: string; exhausted?: boolean }

const phaseVariants = {
    initial: { opacity: 0, y: 8 },
    enter: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
}

function ExhaustedScreen({ clientName }: { clientName?: string }) {
    return (
        <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-7">
            <header className="flex items-center justify-between">
                <Wordmark small />
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-bone-faint">
                    quota reached
                </span>
            </header>
            <div className="flex flex-1 flex-col items-center justify-center text-center">
                <motion.div
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="grid h-16 w-16 place-items-center rounded-2xl border border-brand/30 bg-brand/10 text-brand"
                >
                    <Lock size={26} />
                </motion.div>
                <h1 className="mt-6 font-display text-2xl tracking-tight text-bone">
                    You&rsquo;ve used all your scores
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-bone-dim">
                    {clientName ? `${clientName}, this` : "This"} link has scored
                    its full allowance of emails. To score more, or to see the full
                    rewrites and how {BRAND.company} would build outbound that
                    scores like this, let&rsquo;s talk.
                </p>
                <a
                    href={BRAND.bookACall}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focusable mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 font-mono text-[0.78rem] uppercase tracking-[0.16em] text-white transition-transform hover:scale-[1.02]"
                >
                    Book a call <ArrowUpRight size={16} />
                </a>
            </div>
        </div>
    )
}
function ErrorScreen({
    message,
    onRetry,
    onReset,
}: {
    message: string
    onRetry: () => void
    onReset: () => void
}) {
    return (
        <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-7">
            <header className="flex items-center justify-between">
                <button onClick={onReset} className="focusable rounded-full">
                    <Wordmark small />
                </button>
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-crit">
                    scan failed
                </span>
            </header>
            <div className="flex flex-1 flex-col items-center justify-center text-center">
                <motion.div
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="grid h-16 w-16 place-items-center rounded-2xl border border-crit/30 bg-crit/10 text-crit"
                >
                    <AlertTriangle size={28} />
                </motion.div>
                <h1 className="mt-6 font-display text-2xl tracking-tight text-bone">
                    The scan hit a snag
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-bone-dim">
                    {message}
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                    <Button onClick={onRetry}>
                        <span className="inline-flex items-center gap-1.5">
                            <RefreshCw size={15} /> Try the scan again
                        </span>
                    </Button>
                    <Button variant="ghost" onClick={onReset}>
                        <span className="inline-flex items-center gap-1.5">
                            <RotateCcw size={14} /> Start over
                        </span>
                    </Button>
                </div>
            </div>
        </div>
    )
}

function ColdscoreApp({
    apiBaseUrl,
    clientSlug,
    clientName,
}: {
    apiBaseUrl: string
    clientSlug?: string
    clientName?: string
}) {
    const [phase, setPhase] = useState<Phase>("hero")
    const [intake, setIntake] = useState<IntakeData | null>(null)
    const [analysis, setAnalysis] = useState<Analysis | null>(null)
    const [error, setError] = useState<string>("")
    const [minDone, setMinDone] = useState(false)
    const [result, setResult] = useState<ApiResult | null>(null)
    const [activeSlug, setActiveSlug] = useState<string>(clientSlug || "")
    const [demo, setDemo] = useState(false)
    const reqId = useRef(0)

    const scrollTop = () => {
        try {
            window.scrollTo({ top: 0, behavior: "auto" })
        } catch {}
    }

    const runScan = useCallback(
        async (data: IntakeData) => {
            const id = ++reqId.current
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 100_000)
            const base = (apiBaseUrl || "").replace(/\/+$/, "")
            try {
                const res = await fetch(`${base}/api/score`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...data, clientSlug: activeSlug }),
                    signal: controller.signal,
                })
                const json = await res.json().catch(() => ({}))
                if (id !== reqId.current) return
                if (!res.ok) {
                    const isQuota = res.status === 403 && Boolean(json?.quota)
                    setResult({
                        ok: false,
                        error:
                            json?.error ||
                            "The scan couldn't complete. Please try again in a moment.",
                        exhausted: isQuota,
                    })
                } else if (json?.analysis) {
                    setResult({
                        ok: true,
                        analysis: json.analysis as Analysis,
                        remaining:
                            typeof json.remaining === "number"
                                ? json.remaining
                                : null,
                    })
                } else {
                    setResult({
                        ok: false,
                        error:
                            "The scan returned an unexpected response. Please try again.",
                    })
                }
            } catch (err) {
                if (id !== reqId.current) return
                const aborted =
                    err instanceof DOMException && err.name === "AbortError"
                setResult({
                    ok: false,
                    error: aborted
                        ? "The scan took too long and timed out. Please try again."
                        : "Couldn't reach the scoring service. Check your connection and try again.",
                })
            } finally {
                clearTimeout(timer)
            }
        },
        [apiBaseUrl, activeSlug]
    )

    const startScan = useCallback(
        (data: IntakeData) => {
            setIntake(data)
            setResult(null)
            setMinDone(false)
            setError("")
            setPhase("scanning")
            runScan(data)
        },
        [runScan]
    )

    const startWithLink = useCallback((slug: string) => {
        setActiveSlug(slug)
        setDemo(false)
        setPhase("intake")
    }, [])

    const openDemo = useCallback(() => {
        setDemo(true)
        setIntake(DEMO_INTAKE)
        setAnalysis(sanitizeAnalysis(DEMO_ANALYSIS))
        setError("")
        setResult(null)
        setPhase("report")
        scrollTop()
    }, [])

    useEffect(() => {
        if (phase !== "scanning" || !minDone || !result) return
        if (result.ok) {
            setAnalysis(sanitizeAnalysis(result.analysis))
            setPhase("report")
            scrollTop()
        } else if (result.exhausted) {
            setPhase("exhausted")
            scrollTop()
        } else {
            setError(result.error)
            setPhase("error")
        }
    }, [phase, minDone, result])

    const reset = useCallback(() => {
        reqId.current++
        setIntake(null)
        setAnalysis(null)
        setResult(null)
        setMinDone(false)
        setError("")
        setDemo(false)
        setPhase("hero")
        scrollTop()
    }, [])

    const retry = useCallback(() => {
        if (!intake) return reset()
        setResult(null)
        setMinDone(false)
        setError("")
        setPhase("scanning")
        runScan(intake)
    }, [intake, runScan, reset])

    return (
        <main className="relative min-h-screen">
            <Background />
            <AnimatePresence mode="wait">
                {phase === "hero" && (
                    <motion.div
                        key="hero"
                        variants={phaseVariants}
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <Hero onStart={startWithLink} onDemo={openDemo} />
                    </motion.div>
                )}
                {phase === "intake" && (
                    <motion.div
                        key="intake"
                        variants={phaseVariants}
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <Wizard
                            onComplete={startScan}
                            onBack={() => setPhase("hero")}
                            maxEmails={3}
                        />
                    </motion.div>
                )}
                {phase === "scanning" && intake && (
                    <motion.div
                        key="scanning"
                        variants={phaseVariants}
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <Scanning
                            data={intake}
                            onMinComplete={() => setMinDone(true)}
                        />
                    </motion.div>
                )}
                {phase === "report" && analysis && intake && (
                    <motion.div
                        key="report"
                        variants={phaseVariants}
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <Report
                            analysis={analysis}
                            intake={intake}
                            onReset={reset}
                            demo={demo}
                        />
                    </motion.div>
                )}
                {phase === "error" && (
                    <motion.div
                        key="error"
                        variants={phaseVariants}
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <ErrorScreen
                            message={error}
                            onRetry={retry}
                            onReset={reset}
                        />
                    </motion.div>
                )}
                {phase === "exhausted" && (
                    <motion.div
                        key="exhausted"
                        variants={phaseVariants}
                        initial="initial"
                        animate="enter"
                        exit="exit"
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <ExhaustedScreen clientName={clientName} />
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    )
}

// ============================================================================
// Shadow-DOM style isolation + Google Fonts loader
// ============================================================================
// The compiled Tailwind CSS for the whole app. Filled in at build time.
const COLDSCORE_CSS: string = "*, ::before, ::after {\n  --tw-border-spacing-x: 0;\n  --tw-border-spacing-y: 0;\n  --tw-translate-x: 0;\n  --tw-translate-y: 0;\n  --tw-rotate: 0;\n  --tw-skew-x: 0;\n  --tw-skew-y: 0;\n  --tw-scale-x: 1;\n  --tw-scale-y: 1;\n  --tw-pan-x:  ;\n  --tw-pan-y:  ;\n  --tw-pinch-zoom:  ;\n  --tw-scroll-snap-strictness: proximity;\n  --tw-gradient-from-position:  ;\n  --tw-gradient-via-position:  ;\n  --tw-gradient-to-position:  ;\n  --tw-ordinal:  ;\n  --tw-slashed-zero:  ;\n  --tw-numeric-figure:  ;\n  --tw-numeric-spacing:  ;\n  --tw-numeric-fraction:  ;\n  --tw-ring-inset:  ;\n  --tw-ring-offset-width: 0px;\n  --tw-ring-offset-color: #fff;\n  --tw-ring-color: rgb(59 130 246 / 0.5);\n  --tw-ring-offset-shadow: 0 0 #0000;\n  --tw-ring-shadow: 0 0 #0000;\n  --tw-shadow: 0 0 #0000;\n  --tw-shadow-colored: 0 0 #0000;\n  --tw-blur:  ;\n  --tw-brightness:  ;\n  --tw-contrast:  ;\n  --tw-grayscale:  ;\n  --tw-hue-rotate:  ;\n  --tw-invert:  ;\n  --tw-saturate:  ;\n  --tw-sepia:  ;\n  --tw-drop-shadow:  ;\n  --tw-backdrop-blur:  ;\n  --tw-backdrop-brightness:  ;\n  --tw-backdrop-contrast:  ;\n  --tw-backdrop-grayscale:  ;\n  --tw-backdrop-hue-rotate:  ;\n  --tw-backdrop-invert:  ;\n  --tw-backdrop-opacity:  ;\n  --tw-backdrop-saturate:  ;\n  --tw-backdrop-sepia:  ;\n  --tw-contain-size:  ;\n  --tw-contain-layout:  ;\n  --tw-contain-paint:  ;\n  --tw-contain-style:  ;\n}\n\n::backdrop {\n  --tw-border-spacing-x: 0;\n  --tw-border-spacing-y: 0;\n  --tw-translate-x: 0;\n  --tw-translate-y: 0;\n  --tw-rotate: 0;\n  --tw-skew-x: 0;\n  --tw-skew-y: 0;\n  --tw-scale-x: 1;\n  --tw-scale-y: 1;\n  --tw-pan-x:  ;\n  --tw-pan-y:  ;\n  --tw-pinch-zoom:  ;\n  --tw-scroll-snap-strictness: proximity;\n  --tw-gradient-from-position:  ;\n  --tw-gradient-via-position:  ;\n  --tw-gradient-to-position:  ;\n  --tw-ordinal:  ;\n  --tw-slashed-zero:  ;\n  --tw-numeric-figure:  ;\n  --tw-numeric-spacing:  ;\n  --tw-numeric-fraction:  ;\n  --tw-ring-inset:  ;\n  --tw-ring-offset-width: 0px;\n  --tw-ring-offset-color: #fff;\n  --tw-ring-color: rgb(59 130 246 / 0.5);\n  --tw-ring-offset-shadow: 0 0 #0000;\n  --tw-ring-shadow: 0 0 #0000;\n  --tw-shadow: 0 0 #0000;\n  --tw-shadow-colored: 0 0 #0000;\n  --tw-blur:  ;\n  --tw-brightness:  ;\n  --tw-contrast:  ;\n  --tw-grayscale:  ;\n  --tw-hue-rotate:  ;\n  --tw-invert:  ;\n  --tw-saturate:  ;\n  --tw-sepia:  ;\n  --tw-drop-shadow:  ;\n  --tw-backdrop-blur:  ;\n  --tw-backdrop-brightness:  ;\n  --tw-backdrop-contrast:  ;\n  --tw-backdrop-grayscale:  ;\n  --tw-backdrop-hue-rotate:  ;\n  --tw-backdrop-invert:  ;\n  --tw-backdrop-opacity:  ;\n  --tw-backdrop-saturate:  ;\n  --tw-backdrop-sepia:  ;\n  --tw-contain-size:  ;\n  --tw-contain-layout:  ;\n  --tw-contain-paint:  ;\n  --tw-contain-style:  ;\n}\n\n/*\n! tailwindcss v3.4.15 | MIT License | https://tailwindcss.com\n*/\n\n/*\n1. Prevent padding and border from affecting element width. (https://github.com/mozdevs/cssremedy/issues/4)\n2. Allow adding a border to an element by just adding a border-width. (https://github.com/tailwindcss/tailwindcss/pull/116)\n*/\n\n*,\n::before,\n::after {\n  box-sizing: border-box;\n  /* 1 */\n  border-width: 0;\n  /* 2 */\n  border-style: solid;\n  /* 2 */\n  border-color: #e5e7eb;\n  /* 2 */\n}\n\n::before,\n::after {\n  --tw-content: '';\n}\n\n/*\n1. Use a consistent sensible line-height in all browsers.\n2. Prevent adjustments of font size after orientation changes in iOS.\n3. Use a more readable tab size.\n4. Use the user's configured `sans` font-family by default.\n5. Use the user's configured `sans` font-feature-settings by default.\n6. Use the user's configured `sans` font-variation-settings by default.\n7. Disable tap highlights on iOS\n*/\n\nhtml,\n:host {\n  line-height: 1.5;\n  /* 1 */\n  -webkit-text-size-adjust: 100%;\n  /* 2 */\n  -moz-tab-size: 4;\n  /* 3 */\n  -o-tab-size: 4;\n     tab-size: 4;\n  /* 3 */\n  font-family: ui-sans-serif, system-ui, sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\";\n  /* 4 */\n  font-feature-settings: normal;\n  /* 5 */\n  font-variation-settings: normal;\n  /* 6 */\n  -webkit-tap-highlight-color: transparent;\n  /* 7 */\n}\n\n/*\n1. Remove the margin in all browsers.\n2. Inherit line-height from `html` so users can set them as a class directly on the `html` element.\n*/\n\nbody {\n  margin: 0;\n  /* 1 */\n  line-height: inherit;\n  /* 2 */\n}\n\n/*\n1. Add the correct height in Firefox.\n2. Correct the inheritance of border color in Firefox. (https://bugzilla.mozilla.org/show_bug.cgi?id=190655)\n3. Ensure horizontal rules are visible by default.\n*/\n\nhr {\n  height: 0;\n  /* 1 */\n  color: inherit;\n  /* 2 */\n  border-top-width: 1px;\n  /* 3 */\n}\n\n/*\nAdd the correct text decoration in Chrome, Edge, and Safari.\n*/\n\nabbr:where([title]) {\n  -webkit-text-decoration: underline dotted;\n          text-decoration: underline dotted;\n}\n\n/*\nRemove the default font size and weight for headings.\n*/\n\nh1,\nh2,\nh3,\nh4,\nh5,\nh6 {\n  font-size: inherit;\n  font-weight: inherit;\n}\n\n/*\nReset links to optimize for opt-in styling instead of opt-out.\n*/\n\na {\n  color: inherit;\n  text-decoration: inherit;\n}\n\n/*\nAdd the correct font weight in Edge and Safari.\n*/\n\nb,\nstrong {\n  font-weight: bolder;\n}\n\n/*\n1. Use the user's configured `mono` font-family by default.\n2. Use the user's configured `mono` font-feature-settings by default.\n3. Use the user's configured `mono` font-variation-settings by default.\n4. Correct the odd `em` font sizing in all browsers.\n*/\n\ncode,\nkbd,\nsamp,\npre {\n  font-family: var(--font-mono), ui-monospace, monospace;\n  /* 1 */\n  font-feature-settings: normal;\n  /* 2 */\n  font-variation-settings: normal;\n  /* 3 */\n  font-size: 1em;\n  /* 4 */\n}\n\n/*\nAdd the correct font size in all browsers.\n*/\n\nsmall {\n  font-size: 80%;\n}\n\n/*\nPrevent `sub` and `sup` elements from affecting the line height in all browsers.\n*/\n\nsub,\nsup {\n  font-size: 75%;\n  line-height: 0;\n  position: relative;\n  vertical-align: baseline;\n}\n\nsub {\n  bottom: -0.25em;\n}\n\nsup {\n  top: -0.5em;\n}\n\n/*\n1. Remove text indentation from table contents in Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=999088, https://bugs.webkit.org/show_bug.cgi?id=201297)\n2. Correct table border color inheritance in all Chrome and Safari. (https://bugs.chromium.org/p/chromium/issues/detail?id=935729, https://bugs.webkit.org/show_bug.cgi?id=195016)\n3. Remove gaps between table borders by default.\n*/\n\ntable {\n  text-indent: 0;\n  /* 1 */\n  border-color: inherit;\n  /* 2 */\n  border-collapse: collapse;\n  /* 3 */\n}\n\n/*\n1. Change the font styles in all browsers.\n2. Remove the margin in Firefox and Safari.\n3. Remove default padding in all browsers.\n*/\n\nbutton,\ninput,\noptgroup,\nselect,\ntextarea {\n  font-family: inherit;\n  /* 1 */\n  font-feature-settings: inherit;\n  /* 1 */\n  font-variation-settings: inherit;\n  /* 1 */\n  font-size: 100%;\n  /* 1 */\n  font-weight: inherit;\n  /* 1 */\n  line-height: inherit;\n  /* 1 */\n  letter-spacing: inherit;\n  /* 1 */\n  color: inherit;\n  /* 1 */\n  margin: 0;\n  /* 2 */\n  padding: 0;\n  /* 3 */\n}\n\n/*\nRemove the inheritance of text transform in Edge and Firefox.\n*/\n\nbutton,\nselect {\n  text-transform: none;\n}\n\n/*\n1. Correct the inability to style clickable types in iOS and Safari.\n2. Remove default button styles.\n*/\n\nbutton,\ninput:where([type='button']),\ninput:where([type='reset']),\ninput:where([type='submit']) {\n  -webkit-appearance: button;\n  /* 1 */\n  background-color: transparent;\n  /* 2 */\n  background-image: none;\n  /* 2 */\n}\n\n/*\nUse the modern Firefox focus style for all focusable elements.\n*/\n\n:-moz-focusring {\n  outline: auto;\n}\n\n/*\nRemove the additional `:invalid` styles in Firefox. (https://github.com/mozilla/gecko-dev/blob/2f9eacd9d3d995c937b4251a5557d95d494c9be1/layout/style/res/forms.css#L728-L737)\n*/\n\n:-moz-ui-invalid {\n  box-shadow: none;\n}\n\n/*\nAdd the correct vertical alignment in Chrome and Firefox.\n*/\n\nprogress {\n  vertical-align: baseline;\n}\n\n/*\nCorrect the cursor style of increment and decrement buttons in Safari.\n*/\n\n::-webkit-inner-spin-button,\n::-webkit-outer-spin-button {\n  height: auto;\n}\n\n/*\n1. Correct the odd appearance in Chrome and Safari.\n2. Correct the outline style in Safari.\n*/\n\n[type='search'] {\n  -webkit-appearance: textfield;\n  /* 1 */\n  outline-offset: -2px;\n  /* 2 */\n}\n\n/*\nRemove the inner padding in Chrome and Safari on macOS.\n*/\n\n::-webkit-search-decoration {\n  -webkit-appearance: none;\n}\n\n/*\n1. Correct the inability to style clickable types in iOS and Safari.\n2. Change font properties to `inherit` in Safari.\n*/\n\n::-webkit-file-upload-button {\n  -webkit-appearance: button;\n  /* 1 */\n  font: inherit;\n  /* 2 */\n}\n\n/*\nAdd the correct display in Chrome and Safari.\n*/\n\nsummary {\n  display: list-item;\n}\n\n/*\nRemoves the default spacing and border for appropriate elements.\n*/\n\nblockquote,\ndl,\ndd,\nh1,\nh2,\nh3,\nh4,\nh5,\nh6,\nhr,\nfigure,\np,\npre {\n  margin: 0;\n}\n\nfieldset {\n  margin: 0;\n  padding: 0;\n}\n\nlegend {\n  padding: 0;\n}\n\nol,\nul,\nmenu {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n}\n\n/*\nReset default styling for dialogs.\n*/\n\ndialog {\n  padding: 0;\n}\n\n/*\nPrevent resizing textareas horizontally by default.\n*/\n\ntextarea {\n  resize: vertical;\n}\n\n/*\n1. Reset the default placeholder opacity in Firefox. (https://github.com/tailwindlabs/tailwindcss/issues/3300)\n2. Set the default placeholder color to the user's configured gray 400 color.\n*/\n\ninput::-moz-placeholder, textarea::-moz-placeholder {\n  opacity: 1;\n  /* 1 */\n  color: #9ca3af;\n  /* 2 */\n}\n\ninput::placeholder,\ntextarea::placeholder {\n  opacity: 1;\n  /* 1 */\n  color: #9ca3af;\n  /* 2 */\n}\n\n/*\nSet the default cursor for buttons.\n*/\n\nbutton,\n[role=\"button\"] {\n  cursor: pointer;\n}\n\n/*\nMake sure disabled buttons don't get the pointer cursor.\n*/\n\n:disabled {\n  cursor: default;\n}\n\n/*\n1. Make replaced elements `display: block` by default. (https://github.com/mozdevs/cssremedy/issues/14)\n2. Add `vertical-align: middle` to align replaced elements more sensibly by default. (https://github.com/jensimmons/cssremedy/issues/14#issuecomment-634934210)\n   This can trigger a poorly considered lint error in some tools but is included by design.\n*/\n\nimg,\nsvg,\nvideo,\ncanvas,\naudio,\niframe,\nembed,\nobject {\n  display: block;\n  /* 1 */\n  vertical-align: middle;\n  /* 2 */\n}\n\n/*\nConstrain images and videos to the parent width and preserve their intrinsic aspect ratio. (https://github.com/mozdevs/cssremedy/issues/14)\n*/\n\nimg,\nvideo {\n  max-width: 100%;\n  height: auto;\n}\n\n/* Make elements with the HTML hidden attribute stay hidden by default */\n\n[hidden]:where(:not([hidden=\"until-found\"])) {\n  display: none;\n}\n\n.pointer-events-none {\n  pointer-events: none;\n}\n\n.visible {\n  visibility: visible;\n}\n\n.collapse {\n  visibility: collapse;\n}\n\n.fixed {\n  position: fixed;\n}\n\n.absolute {\n  position: absolute;\n}\n\n.relative {\n  position: relative;\n}\n\n.sticky {\n  position: sticky;\n}\n\n.inset-0 {\n  inset: 0px;\n}\n\n.inset-x-0 {\n  left: 0px;\n  right: 0px;\n}\n\n.-bottom-2 {\n  bottom: -0.5rem;\n}\n\n.-left-2 {\n  left: -0.5rem;\n}\n\n.-right-2 {\n  right: -0.5rem;\n}\n\n.-top-2 {\n  top: -0.5rem;\n}\n\n.bottom-0 {\n  bottom: 0px;\n}\n\n.bottom-5 {\n  bottom: 1.25rem;\n}\n\n.bottom-6 {\n  bottom: 1.5rem;\n}\n\n.left-0 {\n  left: 0px;\n}\n\n.left-1 {\n  left: 0.25rem;\n}\n\n.left-1\\/2 {\n  left: 50%;\n}\n\n.right-4 {\n  right: 1rem;\n}\n\n.right-5 {\n  right: 1.25rem;\n}\n\n.top-0 {\n  top: 0px;\n}\n\n.top-4 {\n  top: 1rem;\n}\n\n.top-6 {\n  top: 1.5rem;\n}\n\n.z-10 {\n  z-index: 10;\n}\n\n.z-20 {\n  z-index: 20;\n}\n\n.z-30 {\n  z-index: 30;\n}\n\n.z-40 {\n  z-index: 40;\n}\n\n.z-50 {\n  z-index: 50;\n}\n\n.col-span-2 {\n  grid-column: span 2 / span 2;\n}\n\n.-mx-5 {\n  margin-left: -1.25rem;\n  margin-right: -1.25rem;\n}\n\n.-mx-8 {\n  margin-left: -2rem;\n  margin-right: -2rem;\n}\n\n.mx-auto {\n  margin-left: auto;\n  margin-right: auto;\n}\n\n.-mt-4 {\n  margin-top: -1rem;\n}\n\n.mb-1 {\n  margin-bottom: 0.25rem;\n}\n\n.mb-2 {\n  margin-bottom: 0.5rem;\n}\n\n.mb-3 {\n  margin-bottom: 0.75rem;\n}\n\n.mb-4 {\n  margin-bottom: 1rem;\n}\n\n.mb-5 {\n  margin-bottom: 1.25rem;\n}\n\n.ml-0 {\n  margin-left: 0px;\n}\n\n.ml-0\\.5 {\n  margin-left: 0.125rem;\n}\n\n.ml-1 {\n  margin-left: 0.25rem;\n}\n\n.mt-0 {\n  margin-top: 0px;\n}\n\n.mt-0\\.5 {\n  margin-top: 0.125rem;\n}\n\n.mt-1 {\n  margin-top: 0.25rem;\n}\n\n.mt-1\\.5 {\n  margin-top: 0.375rem;\n}\n\n.mt-10 {\n  margin-top: 2.5rem;\n}\n\n.mt-14 {\n  margin-top: 3.5rem;\n}\n\n.mt-16 {\n  margin-top: 4rem;\n}\n\n.mt-2 {\n  margin-top: 0.5rem;\n}\n\n.mt-2\\.5 {\n  margin-top: 0.625rem;\n}\n\n.mt-20 {\n  margin-top: 5rem;\n}\n\n.mt-3 {\n  margin-top: 0.75rem;\n}\n\n.mt-4 {\n  margin-top: 1rem;\n}\n\n.mt-5 {\n  margin-top: 1.25rem;\n}\n\n.mt-6 {\n  margin-top: 1.5rem;\n}\n\n.mt-7 {\n  margin-top: 1.75rem;\n}\n\n.mt-8 {\n  margin-top: 2rem;\n}\n\n.mt-9 {\n  margin-top: 2.25rem;\n}\n\n.block {\n  display: block;\n}\n\n.flex {\n  display: flex;\n}\n\n.inline-flex {\n  display: inline-flex;\n}\n\n.table {\n  display: table;\n}\n\n.grid {\n  display: grid;\n}\n\n.contents {\n  display: contents;\n}\n\n.hidden {\n  display: none;\n}\n\n.h-1 {\n  height: 0.25rem;\n}\n\n.h-1\\.5 {\n  height: 0.375rem;\n}\n\n.h-10 {\n  height: 2.5rem;\n}\n\n.h-14 {\n  height: 3.5rem;\n}\n\n.h-16 {\n  height: 4rem;\n}\n\n.h-2 {\n  height: 0.5rem;\n}\n\n.h-2\\.5 {\n  height: 0.625rem;\n}\n\n.h-20 {\n  height: 5rem;\n}\n\n.h-24 {\n  height: 6rem;\n}\n\n.h-28 {\n  height: 7rem;\n}\n\n.h-3 {\n  height: 0.75rem;\n}\n\n.h-3\\.5 {\n  height: 0.875rem;\n}\n\n.h-4 {\n  height: 1rem;\n}\n\n.h-5 {\n  height: 1.25rem;\n}\n\n.h-6 {\n  height: 1.5rem;\n}\n\n.h-9 {\n  height: 2.25rem;\n}\n\n.h-\\[46px\\] {\n  height: 46px;\n}\n\n.h-\\[calc\\(100\\%-3rem\\)\\] {\n  height: calc(100% - 3rem);\n}\n\n.h-full {\n  height: 100%;\n}\n\n.max-h-\\[16rem\\] {\n  max-height: 16rem;\n}\n\n.min-h-screen {\n  min-height: 100vh;\n}\n\n.w-0 {\n  width: 0px;\n}\n\n.w-0\\.5 {\n  width: 0.125rem;\n}\n\n.w-1 {\n  width: 0.25rem;\n}\n\n.w-1\\.5 {\n  width: 0.375rem;\n}\n\n.w-10 {\n  width: 2.5rem;\n}\n\n.w-16 {\n  width: 4rem;\n}\n\n.w-2 {\n  width: 0.5rem;\n}\n\n.w-2\\.5 {\n  width: 0.625rem;\n}\n\n.w-20 {\n  width: 5rem;\n}\n\n.w-24 {\n  width: 6rem;\n}\n\n.w-3 {\n  width: 0.75rem;\n}\n\n.w-3\\.5 {\n  width: 0.875rem;\n}\n\n.w-4 {\n  width: 1rem;\n}\n\n.w-5 {\n  width: 1.25rem;\n}\n\n.w-6 {\n  width: 1.5rem;\n}\n\n.w-9 {\n  width: 2.25rem;\n}\n\n.w-\\[46px\\] {\n  width: 46px;\n}\n\n.w-fit {\n  width: -moz-fit-content;\n  width: fit-content;\n}\n\n.w-full {\n  width: 100%;\n}\n\n.w-px {\n  width: 1px;\n}\n\n.min-w-0 {\n  min-width: 0px;\n}\n\n.min-w-9 {\n  min-width: 2.25rem;\n}\n\n.max-w-2xl {\n  max-width: 42rem;\n}\n\n.max-w-3xl {\n  max-width: 48rem;\n}\n\n.max-w-5xl {\n  max-width: 64rem;\n}\n\n.max-w-6xl {\n  max-width: 72rem;\n}\n\n.max-w-md {\n  max-width: 28rem;\n}\n\n.max-w-sm {\n  max-width: 24rem;\n}\n\n.max-w-xl {\n  max-width: 36rem;\n}\n\n.flex-1 {\n  flex: 1 1 0%;\n}\n\n.flex-shrink {\n  flex-shrink: 1;\n}\n\n.shrink-0 {\n  flex-shrink: 0;\n}\n\n.border-collapse {\n  border-collapse: collapse;\n}\n\n.-translate-x-1 {\n  --tw-translate-x: -0.25rem;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n\n.-translate-x-1\\/2 {\n  --tw-translate-x: -50%;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n\n.translate-x-0 {\n  --tw-translate-x: 0px;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n\n.-rotate-90 {\n  --tw-rotate: -90deg;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n\n.transform {\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n\n@keyframes spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n.animate-spin {\n  animation: spin 1s linear infinite;\n}\n\n.cursor-help {\n  cursor: help;\n}\n\n.select-none {\n  -webkit-user-select: none;\n     -moz-user-select: none;\n          user-select: none;\n}\n\n.resize {\n  resize: both;\n}\n\n.grid-cols-2 {\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n\n.grid-cols-3 {\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n}\n\n.flex-col {\n  flex-direction: column;\n}\n\n.flex-wrap {\n  flex-wrap: wrap;\n}\n\n.place-items-center {\n  place-items: center;\n}\n\n.items-start {\n  align-items: flex-start;\n}\n\n.items-center {\n  align-items: center;\n}\n\n.items-baseline {\n  align-items: baseline;\n}\n\n.justify-center {\n  justify-content: center;\n}\n\n.justify-between {\n  justify-content: space-between;\n}\n\n.gap-1 {\n  gap: 0.25rem;\n}\n\n.gap-1\\.5 {\n  gap: 0.375rem;\n}\n\n.gap-10 {\n  gap: 2.5rem;\n}\n\n.gap-12 {\n  gap: 3rem;\n}\n\n.gap-2 {\n  gap: 0.5rem;\n}\n\n.gap-2\\.5 {\n  gap: 0.625rem;\n}\n\n.gap-3 {\n  gap: 0.75rem;\n}\n\n.gap-4 {\n  gap: 1rem;\n}\n\n.gap-5 {\n  gap: 1.25rem;\n}\n\n.gap-6 {\n  gap: 1.5rem;\n}\n\n.gap-8 {\n  gap: 2rem;\n}\n\n.gap-x-5 {\n  -moz-column-gap: 1.25rem;\n       column-gap: 1.25rem;\n}\n\n.gap-x-7 {\n  -moz-column-gap: 1.75rem;\n       column-gap: 1.75rem;\n}\n\n.gap-y-2 {\n  row-gap: 0.5rem;\n}\n\n.gap-y-3 {\n  row-gap: 0.75rem;\n}\n\n.space-y-1 > :not([hidden]) ~ :not([hidden]) {\n  --tw-space-y-reverse: 0;\n  margin-top: calc(0.25rem * calc(1 - var(--tw-space-y-reverse)));\n  margin-bottom: calc(0.25rem * var(--tw-space-y-reverse));\n}\n\n.space-y-1\\.5 > :not([hidden]) ~ :not([hidden]) {\n  --tw-space-y-reverse: 0;\n  margin-top: calc(0.375rem * calc(1 - var(--tw-space-y-reverse)));\n  margin-bottom: calc(0.375rem * var(--tw-space-y-reverse));\n}\n\n.space-y-10 > :not([hidden]) ~ :not([hidden]) {\n  --tw-space-y-reverse: 0;\n  margin-top: calc(2.5rem * calc(1 - var(--tw-space-y-reverse)));\n  margin-bottom: calc(2.5rem * var(--tw-space-y-reverse));\n}\n\n.space-y-2 > :not([hidden]) ~ :not([hidden]) {\n  --tw-space-y-reverse: 0;\n  margin-top: calc(0.5rem * calc(1 - var(--tw-space-y-reverse)));\n  margin-bottom: calc(0.5rem * var(--tw-space-y-reverse));\n}\n\n.space-y-2\\.5 > :not([hidden]) ~ :not([hidden]) {\n  --tw-space-y-reverse: 0;\n  margin-top: calc(0.625rem * calc(1 - var(--tw-space-y-reverse)));\n  margin-bottom: calc(0.625rem * var(--tw-space-y-reverse));\n}\n\n.space-y-3 > :not([hidden]) ~ :not([hidden]) {\n  --tw-space-y-reverse: 0;\n  margin-top: calc(0.75rem * calc(1 - var(--tw-space-y-reverse)));\n  margin-bottom: calc(0.75rem * var(--tw-space-y-reverse));\n}\n\n.space-y-4 > :not([hidden]) ~ :not([hidden]) {\n  --tw-space-y-reverse: 0;\n  margin-top: calc(1rem * calc(1 - var(--tw-space-y-reverse)));\n  margin-bottom: calc(1rem * var(--tw-space-y-reverse));\n}\n\n.space-y-6 > :not([hidden]) ~ :not([hidden]) {\n  --tw-space-y-reverse: 0;\n  margin-top: calc(1.5rem * calc(1 - var(--tw-space-y-reverse)));\n  margin-bottom: calc(1.5rem * var(--tw-space-y-reverse));\n}\n\n.self-start {\n  align-self: flex-start;\n}\n\n.overflow-hidden {\n  overflow: hidden;\n}\n\n.overflow-y-auto {\n  overflow-y: auto;\n}\n\n.truncate {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.whitespace-nowrap {\n  white-space: nowrap;\n}\n\n.whitespace-pre-wrap {\n  white-space: pre-wrap;\n}\n\n.rounded {\n  border-radius: 0.25rem;\n}\n\n.rounded-2xl {\n  border-radius: 1rem;\n}\n\n.rounded-3xl {\n  border-radius: 1.5rem;\n}\n\n.rounded-full {\n  border-radius: 9999px;\n}\n\n.rounded-lg {\n  border-radius: 0.5rem;\n}\n\n.rounded-xl {\n  border-radius: 0.75rem;\n}\n\n.border {\n  border-width: 1px;\n}\n\n.border-b {\n  border-bottom-width: 1px;\n}\n\n.border-l {\n  border-left-width: 1px;\n}\n\n.border-r {\n  border-right-width: 1px;\n}\n\n.border-t {\n  border-top-width: 1px;\n}\n\n.border-dashed {\n  border-style: dashed;\n}\n\n.border-bone {\n  --tw-border-opacity: 1;\n  border-color: rgb(26 27 30 / var(--tw-border-opacity, 1));\n}\n\n.border-bone\\/10 {\n  border-color: rgb(26 27 30 / 0.1);\n}\n\n.border-bone\\/15 {\n  border-color: rgb(26 27 30 / 0.15);\n}\n\n.border-bone\\/20 {\n  border-color: rgb(26 27 30 / 0.2);\n}\n\n.border-brand {\n  --tw-border-opacity: 1;\n  border-color: rgb(255 111 48 / var(--tw-border-opacity, 1));\n}\n\n.border-brand\\/30 {\n  border-color: rgb(255 111 48 / 0.3);\n}\n\n.border-brand\\/40 {\n  border-color: rgb(255 111 48 / 0.4);\n}\n\n.border-brand\\/50 {\n  border-color: rgb(255 111 48 / 0.5);\n}\n\n.border-brand\\/60 {\n  border-color: rgb(255 111 48 / 0.6);\n}\n\n.border-crit {\n  --tw-border-opacity: 1;\n  border-color: rgb(211 58 44 / var(--tw-border-opacity, 1));\n}\n\n.border-crit\\/20 {\n  border-color: rgb(211 58 44 / 0.2);\n}\n\n.border-crit\\/30 {\n  border-color: rgb(211 58 44 / 0.3);\n}\n\n.border-crit\\/40 {\n  border-color: rgb(211 58 44 / 0.4);\n}\n\n.border-gold {\n  --tw-border-opacity: 1;\n  border-color: rgb(255 111 48 / var(--tw-border-opacity, 1));\n}\n\n.border-gold\\/50 {\n  border-color: rgb(255 111 48 / 0.5);\n}\n\n.border-good {\n  --tw-border-opacity: 1;\n  border-color: rgb(22 163 74 / var(--tw-border-opacity, 1));\n}\n\n.border-good\\/20 {\n  border-color: rgb(22 163 74 / 0.2);\n}\n\n.border-good\\/40 {\n  border-color: rgb(22 163 74 / 0.4);\n}\n\n.border-weak {\n  --tw-border-opacity: 1;\n  border-color: rgb(226 98 47 / var(--tw-border-opacity, 1));\n}\n\n.border-weak\\/30 {\n  border-color: rgb(226 98 47 / 0.3);\n}\n\n.bg-black {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1));\n}\n\n.bg-black\\/30 {\n  background-color: rgb(0 0 0 / 0.3);\n}\n\n.bg-bone {\n  --tw-bg-opacity: 1;\n  background-color: rgb(26 27 30 / var(--tw-bg-opacity, 1));\n}\n\n.bg-bone-faint {\n  --tw-bg-opacity: 1;\n  background-color: rgb(156 160 166 / var(--tw-bg-opacity, 1));\n}\n\n.bg-bone\\/10 {\n  background-color: rgb(26 27 30 / 0.1);\n}\n\n.bg-bone\\/20 {\n  background-color: rgb(26 27 30 / 0.2);\n}\n\n.bg-bone\\/\\[0\\.07\\] {\n  background-color: rgb(26 27 30 / 0.07);\n}\n\n.bg-brand {\n  --tw-bg-opacity: 1;\n  background-color: rgb(255 111 48 / var(--tw-bg-opacity, 1));\n}\n\n.bg-brand\\/10 {\n  background-color: rgb(255 111 48 / 0.1);\n}\n\n.bg-brand\\/15 {\n  background-color: rgb(255 111 48 / 0.15);\n}\n\n.bg-brand\\/\\[0\\.06\\] {\n  background-color: rgb(255 111 48 / 0.06);\n}\n\n.bg-brand\\/\\[0\\.08\\] {\n  background-color: rgb(255 111 48 / 0.08);\n}\n\n.bg-crit {\n  --tw-bg-opacity: 1;\n  background-color: rgb(211 58 44 / var(--tw-bg-opacity, 1));\n}\n\n.bg-crit\\/10 {\n  background-color: rgb(211 58 44 / 0.1);\n}\n\n.bg-crit\\/5 {\n  background-color: rgb(211 58 44 / 0.05);\n}\n\n.bg-crit\\/\\[0\\.05\\] {\n  background-color: rgb(211 58 44 / 0.05);\n}\n\n.bg-gold {\n  --tw-bg-opacity: 1;\n  background-color: rgb(255 111 48 / var(--tw-bg-opacity, 1));\n}\n\n.bg-good {\n  --tw-bg-opacity: 1;\n  background-color: rgb(22 163 74 / var(--tw-bg-opacity, 1));\n}\n\n.bg-good\\/10 {\n  background-color: rgb(22 163 74 / 0.1);\n}\n\n.bg-good\\/20 {\n  background-color: rgb(22 163 74 / 0.2);\n}\n\n.bg-good\\/\\[0\\.05\\] {\n  background-color: rgb(22 163 74 / 0.05);\n}\n\n.bg-ink {\n  --tw-bg-opacity: 1;\n  background-color: rgb(255 255 255 / var(--tw-bg-opacity, 1));\n}\n\n.bg-ink-2 {\n  --tw-bg-opacity: 1;\n  background-color: rgb(245 244 242 / var(--tw-bg-opacity, 1));\n}\n\n.bg-ink-2\\/40 {\n  background-color: rgb(245 244 242 / 0.4);\n}\n\n.bg-ink-2\\/60 {\n  background-color: rgb(245 244 242 / 0.6);\n}\n\n.bg-ink-2\\/70 {\n  background-color: rgb(245 244 242 / 0.7);\n}\n\n.bg-ink-3 {\n  --tw-bg-opacity: 1;\n  background-color: rgb(236 234 230 / var(--tw-bg-opacity, 1));\n}\n\n.bg-ink\\/70 {\n  background-color: rgb(255 255 255 / 0.7);\n}\n\n.bg-transparent {\n  background-color: transparent;\n}\n\n.bg-weak {\n  --tw-bg-opacity: 1;\n  background-color: rgb(226 98 47 / var(--tw-bg-opacity, 1));\n}\n\n.bg-weak\\/10 {\n  background-color: rgb(226 98 47 / 0.1);\n}\n\n.bg-gradient-to-b {\n  background-image: linear-gradient(to bottom, var(--tw-gradient-stops));\n}\n\n.from-ink-2 {\n  --tw-gradient-from: #F5F4F2 var(--tw-gradient-from-position);\n  --tw-gradient-to: rgb(245 244 242 / 0) var(--tw-gradient-to-position);\n  --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);\n}\n\n.from-ink-2\\/60 {\n  --tw-gradient-from: rgb(245 244 242 / 0.6) var(--tw-gradient-from-position);\n  --tw-gradient-to: rgb(245 244 242 / 0) var(--tw-gradient-to-position);\n  --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to);\n}\n\n.to-transparent {\n  --tw-gradient-to: transparent var(--tw-gradient-to-position);\n}\n\n.p-1 {\n  padding: 0.25rem;\n}\n\n.p-1\\.5 {\n  padding: 0.375rem;\n}\n\n.p-3 {\n  padding: 0.75rem;\n}\n\n.p-3\\.5 {\n  padding: 0.875rem;\n}\n\n.p-4 {\n  padding: 1rem;\n}\n\n.p-5 {\n  padding: 1.25rem;\n}\n\n.p-6 {\n  padding: 1.5rem;\n}\n\n.p-7 {\n  padding: 1.75rem;\n}\n\n.p-8 {\n  padding: 2rem;\n}\n\n.px-0 {\n  padding-left: 0px;\n  padding-right: 0px;\n}\n\n.px-0\\.5 {\n  padding-left: 0.125rem;\n  padding-right: 0.125rem;\n}\n\n.px-2 {\n  padding-left: 0.5rem;\n  padding-right: 0.5rem;\n}\n\n.px-2\\.5 {\n  padding-left: 0.625rem;\n  padding-right: 0.625rem;\n}\n\n.px-3 {\n  padding-left: 0.75rem;\n  padding-right: 0.75rem;\n}\n\n.px-3\\.5 {\n  padding-left: 0.875rem;\n  padding-right: 0.875rem;\n}\n\n.px-4 {\n  padding-left: 1rem;\n  padding-right: 1rem;\n}\n\n.px-5 {\n  padding-left: 1.25rem;\n  padding-right: 1.25rem;\n}\n\n.px-6 {\n  padding-left: 1.5rem;\n  padding-right: 1.5rem;\n}\n\n.px-8 {\n  padding-left: 2rem;\n  padding-right: 2rem;\n}\n\n.py-0 {\n  padding-top: 0px;\n  padding-bottom: 0px;\n}\n\n.py-0\\.5 {\n  padding-top: 0.125rem;\n  padding-bottom: 0.125rem;\n}\n\n.py-1 {\n  padding-top: 0.25rem;\n  padding-bottom: 0.25rem;\n}\n\n.py-1\\.5 {\n  padding-top: 0.375rem;\n  padding-bottom: 0.375rem;\n}\n\n.py-10 {\n  padding-top: 2.5rem;\n  padding-bottom: 2.5rem;\n}\n\n.py-12 {\n  padding-top: 3rem;\n  padding-bottom: 3rem;\n}\n\n.py-2 {\n  padding-top: 0.5rem;\n  padding-bottom: 0.5rem;\n}\n\n.py-2\\.5 {\n  padding-top: 0.625rem;\n  padding-bottom: 0.625rem;\n}\n\n.py-3 {\n  padding-top: 0.75rem;\n  padding-bottom: 0.75rem;\n}\n\n.py-4 {\n  padding-top: 1rem;\n  padding-bottom: 1rem;\n}\n\n.py-5 {\n  padding-top: 1.25rem;\n  padding-bottom: 1.25rem;\n}\n\n.py-6 {\n  padding-top: 1.5rem;\n  padding-bottom: 1.5rem;\n}\n\n.py-7 {\n  padding-top: 1.75rem;\n  padding-bottom: 1.75rem;\n}\n\n.pb-28 {\n  padding-bottom: 7rem;\n}\n\n.pb-3 {\n  padding-bottom: 0.75rem;\n}\n\n.pl-4 {\n  padding-left: 1rem;\n}\n\n.pt-5 {\n  padding-top: 1.25rem;\n}\n\n.pt-7 {\n  padding-top: 1.75rem;\n}\n\n.text-left {\n  text-align: left;\n}\n\n.text-center {\n  text-align: center;\n}\n\n.text-right {\n  text-align: right;\n}\n\n.font-display {\n  font-family: var(--font-display), system-ui, sans-serif;\n}\n\n.font-mono {\n  font-family: var(--font-mono), ui-monospace, monospace;\n}\n\n.text-2xl {\n  font-size: 1.5rem;\n  line-height: 2rem;\n}\n\n.text-3xl {\n  font-size: 1.875rem;\n  line-height: 2.25rem;\n}\n\n.text-4xl {\n  font-size: 2.25rem;\n  line-height: 2.5rem;\n}\n\n.text-\\[0\\.58rem\\] {\n  font-size: 0.58rem;\n}\n\n.text-\\[0\\.62rem\\] {\n  font-size: 0.62rem;\n}\n\n.text-\\[0\\.64rem\\] {\n  font-size: 0.64rem;\n}\n\n.text-\\[0\\.66rem\\] {\n  font-size: 0.66rem;\n}\n\n.text-\\[0\\.68rem\\] {\n  font-size: 0.68rem;\n}\n\n.text-\\[0\\.6em\\] {\n  font-size: 0.6em;\n}\n\n.text-\\[0\\.6rem\\] {\n  font-size: 0.6rem;\n}\n\n.text-\\[0\\.72rem\\] {\n  font-size: 0.72rem;\n}\n\n.text-\\[0\\.74rem\\] {\n  font-size: 0.74rem;\n}\n\n.text-\\[0\\.78rem\\] {\n  font-size: 0.78rem;\n}\n\n.text-\\[0\\.7rem\\] {\n  font-size: 0.7rem;\n}\n\n.text-\\[0\\.82rem\\] {\n  font-size: 0.82rem;\n}\n\n.text-\\[0\\.86rem\\] {\n  font-size: 0.86rem;\n}\n\n.text-\\[0\\.8rem\\] {\n  font-size: 0.8rem;\n}\n\n.text-\\[0\\.92rem\\] {\n  font-size: 0.92rem;\n}\n\n.text-\\[0\\.95rem\\] {\n  font-size: 0.95rem;\n}\n\n.text-\\[0\\.9rem\\] {\n  font-size: 0.9rem;\n}\n\n.text-\\[1\\.02rem\\] {\n  font-size: 1.02rem;\n}\n\n.text-\\[10px\\] {\n  font-size: 10px;\n}\n\n.text-\\[11px\\] {\n  font-size: 11px;\n}\n\n.text-\\[13\\.5px\\] {\n  font-size: 13.5px;\n}\n\n.text-\\[13px\\] {\n  font-size: 13px;\n}\n\n.text-\\[14px\\] {\n  font-size: 14px;\n}\n\n.text-\\[15px\\] {\n  font-size: 15px;\n}\n\n.text-\\[2\\.6rem\\] {\n  font-size: 2.6rem;\n}\n\n.text-\\[58px\\] {\n  font-size: 58px;\n}\n\n.text-base {\n  font-size: 1rem;\n  line-height: 1.5rem;\n}\n\n.text-lg {\n  font-size: 1.125rem;\n  line-height: 1.75rem;\n}\n\n.text-sm {\n  font-size: 0.875rem;\n  line-height: 1.25rem;\n}\n\n.text-xl {\n  font-size: 1.25rem;\n  line-height: 1.75rem;\n}\n\n.text-xs {\n  font-size: 0.75rem;\n  line-height: 1rem;\n}\n\n.font-bold {\n  font-weight: 700;\n}\n\n.font-medium {\n  font-weight: 500;\n}\n\n.font-semibold {\n  font-weight: 600;\n}\n\n.uppercase {\n  text-transform: uppercase;\n}\n\n.italic {\n  font-style: italic;\n}\n\n.leading-\\[1\\.02\\] {\n  line-height: 1.02;\n}\n\n.leading-\\[1\\.1\\] {\n  line-height: 1.1;\n}\n\n.leading-\\[1\\.7\\] {\n  line-height: 1.7;\n}\n\n.leading-none {\n  line-height: 1;\n}\n\n.leading-relaxed {\n  line-height: 1.625;\n}\n\n.leading-snug {\n  line-height: 1.375;\n}\n\n.leading-tight {\n  line-height: 1.25;\n}\n\n.tracking-\\[0\\.04em\\] {\n  letter-spacing: 0.04em;\n}\n\n.tracking-\\[0\\.12em\\] {\n  letter-spacing: 0.12em;\n}\n\n.tracking-\\[0\\.14em\\] {\n  letter-spacing: 0.14em;\n}\n\n.tracking-\\[0\\.16em\\] {\n  letter-spacing: 0.16em;\n}\n\n.tracking-\\[0\\.18em\\] {\n  letter-spacing: 0.18em;\n}\n\n.tracking-\\[0\\.2em\\] {\n  letter-spacing: 0.2em;\n}\n\n.tracking-tight {\n  letter-spacing: -0.025em;\n}\n\n.tracking-widest {\n  letter-spacing: 0.1em;\n}\n\n.text-bone {\n  --tw-text-opacity: 1;\n  color: rgb(26 27 30 / var(--tw-text-opacity, 1));\n}\n\n.text-bone-dim {\n  --tw-text-opacity: 1;\n  color: rgb(88 94 102 / var(--tw-text-opacity, 1));\n}\n\n.text-bone-faint {\n  --tw-text-opacity: 1;\n  color: rgb(156 160 166 / var(--tw-text-opacity, 1));\n}\n\n.text-bone\\/\\[0\\.06\\] {\n  color: rgb(26 27 30 / 0.06);\n}\n\n.text-brand {\n  --tw-text-opacity: 1;\n  color: rgb(255 111 48 / var(--tw-text-opacity, 1));\n}\n\n.text-crit {\n  --tw-text-opacity: 1;\n  color: rgb(211 58 44 / var(--tw-text-opacity, 1));\n}\n\n.text-gold {\n  --tw-text-opacity: 1;\n  color: rgb(255 111 48 / var(--tw-text-opacity, 1));\n}\n\n.text-good {\n  --tw-text-opacity: 1;\n  color: rgb(22 163 74 / var(--tw-text-opacity, 1));\n}\n\n.text-ink {\n  --tw-text-opacity: 1;\n  color: rgb(255 255 255 / var(--tw-text-opacity, 1));\n}\n\n.text-weak {\n  --tw-text-opacity: 1;\n  color: rgb(226 98 47 / var(--tw-text-opacity, 1));\n}\n\n.text-white {\n  --tw-text-opacity: 1;\n  color: rgb(255 255 255 / var(--tw-text-opacity, 1));\n}\n\n.underline {\n  text-decoration-line: underline;\n}\n\n.antialiased {\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n}\n\n.shadow {\n  --tw-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);\n  --tw-shadow-colored: 0 1px 3px 0 var(--tw-shadow-color), 0 1px 2px -1px var(--tw-shadow-color);\n  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);\n}\n\n.shadow-\\[0_0_8px_\\#5FC98A\\] {\n  --tw-shadow: 0 0 8px #5FC98A;\n  --tw-shadow-colored: 0 0 8px var(--tw-shadow-color);\n  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);\n}\n\n.shadow-panel {\n  --tw-shadow: 0 1px 2px rgba(17,17,17,0.04), 0 16px 40px -24px rgba(17,17,17,0.16);\n  --tw-shadow-colored: 0 1px 2px var(--tw-shadow-color), 0 16px 40px -24px var(--tw-shadow-color);\n  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);\n}\n\n.outline {\n  outline-style: solid;\n}\n\n.blur {\n  --tw-blur: blur(8px);\n  filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow);\n}\n\n.drop-shadow {\n  --tw-drop-shadow: drop-shadow(0 1px 2px rgb(0 0 0 / 0.1)) drop-shadow(0 1px 1px rgb(0 0 0 / 0.06));\n  filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow);\n}\n\n.filter {\n  filter: var(--tw-blur) var(--tw-brightness) var(--tw-contrast) var(--tw-grayscale) var(--tw-hue-rotate) var(--tw-invert) var(--tw-saturate) var(--tw-sepia) var(--tw-drop-shadow);\n}\n\n.backdrop-blur-sm {\n  --tw-backdrop-blur: blur(4px);\n  backdrop-filter: var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia);\n}\n\n.backdrop-blur-xl {\n  --tw-backdrop-blur: blur(24px);\n  backdrop-filter: var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia);\n}\n\n.backdrop-filter {\n  backdrop-filter: var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia);\n}\n\n.transition {\n  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n\n.transition-all {\n  transition-property: all;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n\n.transition-colors {\n  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n\n.transition-shadow {\n  transition-property: box-shadow;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n\n.transition-transform {\n  transition-property: transform;\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 150ms;\n}\n\n.duration-150 {\n  transition-duration: 150ms;\n}\n\n.duration-200 {\n  transition-duration: 200ms;\n}\n\n.duration-300 {\n  transition-duration: 300ms;\n}\n\n.ease-in-out {\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n}\n\n:host, .cs-root {\n  --ink: #ffffff;\n  --ink-2: #f5f4f2;\n  --ink-3: #eceae6;\n  --gold: #ff6f30;\n  --brand: #ff6f30;\n  --bone: #1a1b1e;\n  /* Google Fonts families (loaded into the document head at runtime) */\n  --font-display: \"Space Grotesk\", system-ui, sans-serif;\n  --font-body: \"Hanken Grotesk\", system-ui, sans-serif;\n  --font-mono: \"JetBrains Mono\", ui-monospace, \"SFMono-Regular\", monospace;\n}\n\n* {\n  -webkit-font-smoothing: antialiased;\n  text-rendering: optimizeLegibility;\n}\n\nhtml {\n  scroll-behavior: smooth;\n}\n\nbody {\n  color: var(--bone);\n  font-family: var(--font-body), system-ui, sans-serif;\n}\n\n.field {\n  position: fixed;\n  inset: 0;\n  z-index: 0;\n  pointer-events: none;\n  background-color: var(--ink);\n}\n\n.field::before {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  background-image: linear-gradient(\n      to right,\n      rgba(20, 20, 24, 0.028) 1px,\n      transparent 1px\n    ),\n    linear-gradient(to bottom, rgba(20, 20, 24, 0.028) 1px, transparent 1px);\n  background-size: 64px 64px;\n  -webkit-mask-image: radial-gradient(\n    ellipse 80% 70% at 50% 30%,\n    black 35%,\n    transparent 85%\n  );\n          mask-image: radial-gradient(\n    ellipse 80% 70% at 50% 30%,\n    black 35%,\n    transparent 85%\n  );\n}\n\n.field::after {\n  content: \"\";\n  position: absolute;\n  inset: 0;\n  background: radial-gradient(\n    120% 90% at 50% -10%,\n    rgba(255, 111, 48, 0.06),\n    transparent 55%\n  );\n}\n\n.grain {\n  position: fixed;\n  inset: 0;\n  z-index: 1;\n  pointer-events: none;\n  opacity: 0.022;\n  mix-blend-mode: multiply;\n  background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\");\n}\n\n.drift {\n  position: fixed;\n  z-index: 0;\n  pointer-events: none;\n  width: 60vw;\n  height: 60vw;\n  max-width: 820px;\n  max-height: 820px;\n  border-radius: 9999px;\n  background: radial-gradient(\n    circle,\n    rgba(255, 111, 48, 0.06),\n    transparent 62%\n  );\n  filter: blur(30px);\n  animation: drift 26s ease-in-out infinite alternate;\n}\n\n@keyframes drift {\n  0% {\n    transform: translate(-12%, -18%) scale(1);\n  }\n\n  100% {\n    transform: translate(14%, 10%) scale(1.18);\n  }\n}\n\n@keyframes sweep {\n  0% {\n    transform: translateY(-8%);\n    opacity: 0;\n  }\n\n  12% {\n    opacity: 1;\n  }\n\n  88% {\n    opacity: 1;\n  }\n\n  100% {\n    transform: translateY(108%);\n    opacity: 0;\n  }\n}\n\n@keyframes blink {\n  0%,\n  100% {\n    opacity: 1;\n  }\n\n  50% {\n    opacity: 0.15;\n  }\n}\n\n.caret {\n  animation: blink 1s steps(1) infinite;\n}\n\n@keyframes pulsering {\n  0% {\n    transform: scale(0.7);\n    opacity: 0.7;\n  }\n\n  100% {\n    transform: scale(1.8);\n    opacity: 0;\n  }\n}\n\n::-moz-selection {\n  background: rgba(255, 111, 48, 0.22);\n  color: #1a1b1e;\n}\n\n::selection {\n  background: rgba(255, 111, 48, 0.22);\n  color: #1a1b1e;\n}\n\n.eyebrow {\n  font-family: var(--font-mono), monospace;\n  text-transform: uppercase;\n  letter-spacing: 0.22em;\n  font-size: 0.68rem;\n  color: var(--gold);\n}\n\n.panel {\n  background: #ffffff;\n  border: 1px solid rgba(20, 20, 24, 0.08);\n  border-radius: 1.1rem;\n  box-shadow: 0 1px 2px rgba(17, 17, 17, 0.04),\n    0 18px 44px -28px rgba(17, 17, 17, 0.18);\n}\n\ninput,\ntextarea {\n  font-family: var(--font-body), system-ui, sans-serif;\n}\n\ntextarea {\n  resize: vertical;\n}\n\n.focusable:focus-visible {\n  outline: none;\n  box-shadow: 0 0 0 1px rgba(255, 111, 48, 0.55),\n    0 0 0 4px rgba(255, 111, 48, 0.14);\n  border-color: rgba(255, 111, 48, 0.55) !important;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  *,\n  *::before,\n  *::after {\n    animation-duration: 0.001ms !important;\n    animation-iteration-count: 1 !important;\n    transition-duration: 0.001ms !important;\n    scroll-behavior: auto !important;\n  }\n}\n\n/* Root wrapper inside the shadow tree — replaces body-level styling. */\n\n.cs-root {\n  color: var(--bone);\n  font-family: var(--font-body), system-ui, sans-serif;\n  min-height: 100vh;\n  overflow-x: hidden;\n}\n\n.placeholder\\:text-bone-faint::-moz-placeholder {\n  --tw-text-opacity: 1;\n  color: rgb(156 160 166 / var(--tw-text-opacity, 1));\n}\n\n.placeholder\\:text-bone-faint::placeholder {\n  --tw-text-opacity: 1;\n  color: rgb(156 160 166 / var(--tw-text-opacity, 1));\n}\n\n.hover\\:scale-\\[1\\.02\\]:hover {\n  --tw-scale-x: 1.02;\n  --tw-scale-y: 1.02;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n\n.hover\\:scale-\\[1\\.03\\]:hover {\n  --tw-scale-x: 1.03;\n  --tw-scale-y: 1.03;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n\n.hover\\:border-bone\\/20:hover {\n  border-color: rgb(26 27 30 / 0.2);\n}\n\n.hover\\:border-bone\\/30:hover {\n  border-color: rgb(26 27 30 / 0.3);\n}\n\n.hover\\:border-bone\\/35:hover {\n  border-color: rgb(26 27 30 / 0.35);\n}\n\n.hover\\:border-brand\\/40:hover {\n  border-color: rgb(255 111 48 / 0.4);\n}\n\n.hover\\:border-brand\\/50:hover {\n  border-color: rgb(255 111 48 / 0.5);\n}\n\n.hover\\:bg-gold-soft:hover {\n  --tw-bg-opacity: 1;\n  background-color: rgb(255 138 82 / var(--tw-bg-opacity, 1));\n}\n\n.hover\\:bg-ink-2:hover {\n  --tw-bg-opacity: 1;\n  background-color: rgb(245 244 242 / var(--tw-bg-opacity, 1));\n}\n\n.hover\\:text-bone:hover {\n  --tw-text-opacity: 1;\n  color: rgb(26 27 30 / var(--tw-text-opacity, 1));\n}\n\n.hover\\:text-brand:hover {\n  --tw-text-opacity: 1;\n  color: rgb(255 111 48 / var(--tw-text-opacity, 1));\n}\n\n.hover\\:text-brand-deep:hover {\n  --tw-text-opacity: 1;\n  color: rgb(232 93 30 / var(--tw-text-opacity, 1));\n}\n\n.hover\\:text-crit:hover {\n  --tw-text-opacity: 1;\n  color: rgb(211 58 44 / var(--tw-text-opacity, 1));\n}\n\n.hover\\:shadow-glow:hover {\n  --tw-shadow: 0 0 0 1px rgba(255,111,48,0.18), 0 10px 30px -10px rgba(255,111,48,0.40);\n  --tw-shadow-colored: 0 0 0 1px var(--tw-shadow-color), 0 10px 30px -10px var(--tw-shadow-color);\n  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);\n}\n\n.active\\:scale-\\[0\\.98\\]:active {\n  --tw-scale-x: 0.98;\n  --tw-scale-y: 0.98;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n\n.disabled\\:cursor-not-allowed:disabled {\n  cursor: not-allowed;\n}\n\n.disabled\\:opacity-40:disabled {\n  opacity: 0.4;\n}\n\n.group:hover .group-hover\\:translate-x-0\\.5 {\n  --tw-translate-x: 0.125rem;\n  transform: translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));\n}\n\n@media (min-width: 640px) {\n  .sm\\:-mx-8 {\n    margin-left: -2rem;\n    margin-right: -2rem;\n  }\n\n  .sm\\:mt-10 {\n    margin-top: 2.5rem;\n  }\n\n  .sm\\:mt-20 {\n    margin-top: 5rem;\n  }\n\n  .sm\\:flex {\n    display: flex;\n  }\n\n  .sm\\:grid-cols-2 {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .sm\\:grid-cols-3 {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n  }\n\n  .sm\\:flex-row {\n    flex-direction: row;\n  }\n\n  .sm\\:p-6 {\n    padding: 1.5rem;\n  }\n\n  .sm\\:p-7 {\n    padding: 1.75rem;\n  }\n\n  .sm\\:p-8 {\n    padding: 2rem;\n  }\n\n  .sm\\:px-8 {\n    padding-left: 2rem;\n    padding-right: 2rem;\n  }\n\n  .sm\\:text-\\[1\\.7rem\\] {\n    font-size: 1.7rem;\n  }\n\n  .sm\\:text-\\[28px\\] {\n    font-size: 28px;\n  }\n\n  .sm\\:text-\\[3\\.4rem\\] {\n    font-size: 3.4rem;\n  }\n\n  .sm\\:text-\\[40px\\] {\n    font-size: 40px;\n  }\n}\n\n@media (min-width: 768px) {\n  .md\\:grid-cols-3 {\n    grid-template-columns: repeat(3, minmax(0, 1fr));\n  }\n\n  .md\\:grid-cols-\\[1fr_0\\.85fr\\] {\n    grid-template-columns: 1fr 0.85fr;\n  }\n}\n\n@media (min-width: 1024px) {\n  .lg\\:grid-cols-2 {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .lg\\:grid-cols-\\[1\\.05fr_0\\.95fr\\] {\n    grid-template-columns: 1.05fr 0.95fr;\n  }\n\n  .lg\\:grid-cols-\\[1\\.15fr_0\\.85fr\\] {\n    grid-template-columns: 1.15fr 0.85fr;\n  }\n\n  .lg\\:grid-cols-\\[auto_1fr\\] {\n    grid-template-columns: auto 1fr;\n  }\n\n  .lg\\:items-start {\n    align-items: flex-start;\n  }\n\n  .lg\\:gap-12 {\n    gap: 3rem;\n  }\n\n  .lg\\:text-\\[3\\.7rem\\] {\n    font-size: 3.7rem;\n  }\n}\n"

const FONT_HREF =
    "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"

function useGoogleFonts() {
    useEffect(() => {
        if (typeof document === "undefined") return
        const id = "coldscore-fonts"
        if (document.getElementById(id)) return
        const pre1 = document.createElement("link")
        pre1.rel = "preconnect"
        pre1.href = "https://fonts.googleapis.com"
        const pre2 = document.createElement("link")
        pre2.rel = "preconnect"
        pre2.href = "https://fonts.gstatic.com"
        pre2.crossOrigin = "anonymous"
        const link = document.createElement("link")
        link.id = id
        link.rel = "stylesheet"
        link.href = FONT_HREF
        document.head.appendChild(pre1)
        document.head.appendChild(pre2)
        document.head.appendChild(link)
    }, [])
}

function ShadowHost({
    css,
    children,
}: {
    css: string
    children: React.ReactNode
}) {
    const hostRef = useRef<HTMLDivElement>(null)
    const [root, setRoot] = useState<ShadowRoot | null>(null)
    useEffect(() => {
        const el = hostRef.current
        if (el && !root) {
            const existing = (el as any).shadowRoot as ShadowRoot | null
            setRoot(existing ?? el.attachShadow({ mode: "open" }))
        }
    }, [root])
    return (
        <div ref={hostRef} style={{ width: "100%" }}>
            {root &&
                createPortal(
                    <>
                        <style
                            dangerouslySetInnerHTML={{
                                __html:
                                    // @font-face lives in the main document; expose the
                                    // families to the shadow tree via the root vars too.
                                    css,
                            }}
                        />
                        <div className="cs-root">{children}</div>
                    </>,
                    root as unknown as Element
                )}
        </div>
    )
}

// ============================================================================
// The exported Framer component
// ============================================================================
/**
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 900
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerDisableUnlink
 */
export default function Coldscore(props: {
    apiBaseUrl?: string
    clientSlug?: string
    clientName?: string
    companyName?: string
    bookACallUrl?: string
    siteUrl?: string
    style?: React.CSSProperties
}) {
    const {
        apiBaseUrl = "https://veloka-email.vercel.app",
        clientSlug = "",
        clientName = "",
        companyName,
        bookACallUrl,
        siteUrl,
        style,
    } = props

    // Thread Framer props into the brand singleton before the tree renders.
    if (companyName) BRAND.company = companyName
    if (bookACallUrl) BRAND.bookACall = bookACallUrl
    if (siteUrl) BRAND.site = siteUrl

    useGoogleFonts()

    return (
        <div style={{ width: "100%", minHeight: "100%", ...style }}>
            <ShadowHost css={COLDSCORE_CSS}>
                <ColdscoreApp
                    apiBaseUrl={apiBaseUrl}
                    clientSlug={clientSlug}
                    clientName={clientName}
                />
            </ShadowHost>
        </div>
    )
}

addPropertyControls(Coldscore, {
    apiBaseUrl: {
        type: ControlType.String,
        title: "API base URL",
        defaultValue: "https://veloka-email.vercel.app",
        description:
            "Your deployed Coldscore app. The OpenAI key stays server-side there; this component only calls its /api/score route.",
    },
    clientSlug: {
        type: ControlType.String,
        title: "Access link slug",
        defaultValue: "",
        placeholder: "e.g. veloka",
        description:
            "The client link slug that carries the scoring quota. Leave blank only if the backend allows open access.",
    },
    clientName: {
        type: ControlType.String,
        title: "Client name",
        defaultValue: "",
        placeholder: "Shown on the quota screen",
    },
    companyName: {
        type: ControlType.String,
        title: "Company",
        defaultValue: "Side Kick",
    },
    bookACallUrl: {
        type: ControlType.String,
        title: "Book-a-call URL",
        defaultValue: "https://get-sidekick.com/demo#demopage",
    },
    siteUrl: {
        type: ControlType.String,
        title: "Site URL",
        defaultValue: "https://get-sidekick.com",
    },
})
