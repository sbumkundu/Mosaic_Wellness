"use client";
import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  delta?: {
    value: string | number;
    direction: "up" | "down" | "neutral";
    /** Custom text after the delta value. Default: "vs yesterday" */
    context?: string;
  };
  /** Optional trend indicator or sub-metric */
  footer?: ReactNode;
  /** Icon shown to the left of the value */
  icon?: ReactNode;
  /** Accent color for the large value (e.g. "text-red-400") */
  valueColor?: string;
  className?: string;
}

/**
 * Single KPI display card with label, large value, delta change, and optional footer.
 *
 * Usage:
 *   <MetricCard
 *     label="Active Incidents"
 *     value={12}
 *     delta={{ value: 3, direction: "up", context: "vs yesterday" }}
 *     valueColor="text-red-400"
 *   />
 */
export function MetricCard({
  label,
  value,
  delta,
  footer,
  icon,
  valueColor = "text-white",
  className = "",
}: MetricCardProps) {
  const deltaColor =
    delta?.direction === "up"
      ? "text-red-400"
      : delta?.direction === "down"
      ? "text-green-400"
      : "text-gray-400";

  const deltaArrow = delta?.direction === "up" ? "▲" : delta?.direction === "down" ? "▼" : "—";

  return (
    <div className={`panel p-4 flex flex-col gap-1 ${className}`}>
      <span className="metric-label">{label}</span>
      <div className="flex items-center gap-2 mt-0.5">
        {icon && <span className="shrink-0">{icon}</span>}
        <span className={`text-2xl font-bold leading-none ${valueColor}`}>{value}</span>
      </div>
      {delta && (
        <span className={`text-[11px] font-medium ${deltaColor}`}>
          {deltaArrow} {typeof delta.value === "number" ? Math.abs(delta.value) : delta.value}
          {" "}
          <span className="text-gray-500 font-normal">{delta.context ?? "vs yesterday"}</span>
        </span>
      )}
      {footer && <div className="mt-1">{footer}</div>}
    </div>
  );
}
