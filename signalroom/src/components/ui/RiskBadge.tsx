"use client";

type Severity = "critical" | "high" | "medium" | "low" | "CRITICAL" | "HIGH" | "MED" | "LOW";

const SEVERITY_MAP: Record<string, { label: string; classes: string }> = {
  critical: {
    label: "CRITICAL",
    classes: "text-red-400 bg-red-900/20 border-red-700/60",
  },
  high: {
    label: "HIGH",
    classes: "text-orange-400 bg-orange-900/20 border-orange-700/60",
  },
  medium: {
    label: "MED",
    classes: "text-yellow-400 bg-yellow-900/20 border-yellow-700/40",
  },
  low: {
    label: "LOW",
    classes: "text-green-400 bg-green-900/20 border-green-800/30",
  },
  CRITICAL: {
    label: "CRITICAL",
    classes: "text-red-400 bg-red-900/20 border-red-700/60",
  },
  HIGH: {
    label: "HIGH",
    classes: "text-orange-400 bg-orange-900/20 border-orange-700/60",
  },
  MED: {
    label: "MED",
    classes: "text-yellow-400 bg-yellow-900/20 border-yellow-700/40",
  },
  LOW: {
    label: "LOW",
    classes: "text-green-400 bg-green-900/20 border-green-800/30",
  },
};

interface RiskBadgeProps {
  severity: Severity | string;
  score?: number;
  size?: "sm" | "md";
  tooltip?: string;
}

/**
 * Standardized severity / risk badge.
 * Shows a colored pill with the label and an optional numeric score.
 *
 * Usage:
 *   <RiskBadge severity="critical" score={87} />
 *   <RiskBadge severity="HIGH" />
 */
export function RiskBadge({ severity, score, size = "md", tooltip }: RiskBadgeProps) {
  const cfg = SEVERITY_MAP[severity] || SEVERITY_MAP.low;
  const textSize = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold ${textSize} ${cfg.classes}`}
      title={tooltip ?? `${cfg.label} severity${score != null ? ` — score: ${score}/100` : ""}`}
    >
      {cfg.label}
      {score != null && (
        <span className="opacity-70 font-normal">{score}</span>
      )}
    </span>
  );
}

/**
 * Dot-only severity indicator for compact contexts (table rows, etc.).
 */
export function SeverityDot({ severity }: { severity: string }) {
  const DOT_COLOR: Record<string, string> = {
    critical: "bg-red-400",
    high: "bg-orange-400",
    medium: "bg-yellow-400",
    low: "bg-green-400",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${DOT_COLOR[severity.toLowerCase()] ?? "bg-gray-500"}`}
      title={severity}
    />
  );
}
