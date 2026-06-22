import type { Status, Severity, Impact } from "./types";

// Hex values mirror tailwind.config.ts semantic scale.
export const COLORS = {
  good: "#48C78E",
  ok: "#E8983A",
  weak: "#E66B47",
  crit: "#E0524A",
  gold: "#3D7BFF",
  brand: "#3D7BFF",
  bone: "#EDF1F7",
  boneDim: "#99A2B2",
  ink: "#0B0D12",
};

export function scoreColor(score: number): string {
  if (score >= 75) return COLORS.good;
  if (score >= 55) return COLORS.ok;
  if (score >= 40) return COLORS.weak;
  return COLORS.crit;
}

export function statusColor(status: Status): string {
  switch (status) {
    case "strong":
      return COLORS.good;
    case "ok":
      return COLORS.ok;
    case "weak":
      return COLORS.weak;
    case "critical":
      return COLORS.crit;
  }
}

export function severityColor(sev: Severity): string {
  switch (sev) {
    case "low":
      return COLORS.ok;
    case "medium":
      return COLORS.weak;
    case "high":
      return COLORS.crit;
  }
}

export function impactColor(impact: Impact): string {
  switch (impact) {
    case "high":
      return COLORS.crit;
    case "medium":
      return COLORS.weak;
    case "low":
      return COLORS.ok;
  }
}

export function bandColor(band: string): string {
  switch (band) {
    case "High":
    case "Strong":
      return COLORS.good;
    case "Moderate":
      return COLORS.ok;
    case "Low":
      return COLORS.weak;
    default:
      return COLORS.crit;
  }
}

export function scoreLabel(score: number): string {
  if (score >= 85) return "Exceptional";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Average";
  if (score >= 40) return "Weak";
  return "Critical";
}
