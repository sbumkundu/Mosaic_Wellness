"use client";
import { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Show a bottom border separator */
  divider?: boolean;
  className?: string;
}

/**
 * Consistent section heading above content groups.
 *
 * Usage:
 *   <SectionHeader
 *     title="Root Causes"
 *     subtitle="Clustered themes driving this incident"
 *     action={<button>See all</button>}
 *   />
 */
export function SectionHeader({ title, subtitle, action, divider = false, className = "" }: SectionHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-3 ${divider ? "pb-3 border-b border-gray-800" : ""} ${className}`}>
      <div>
        <h2 className="text-[15px] font-semibold text-gray-200 leading-tight">{title}</h2>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5 leading-snug">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
