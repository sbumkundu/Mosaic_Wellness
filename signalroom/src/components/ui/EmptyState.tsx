"use client";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** Optional hint text below action */
  hint?: string;
}

/**
 * Empty / no-data state with a centered icon, title, description, and optional CTA.
 *
 * Usage:
 *   <EmptyState
 *     icon={<AlertCircle className="w-6 h-6 text-gray-500" />}
 *     title="No incidents detected"
 *     description="Detect incidents from existing mention data by running incident detection."
 *     action={<button onClick={runDetect} className="nav-btn">Detect Incidents</button>}
 *   />
 */
export function EmptyState({ icon, title, description, action, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-800/60 border border-gray-700/40 flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-300 mb-1.5">{title}</p>
      <p className="text-xs text-gray-500 max-w-xs leading-relaxed mb-4">{description}</p>
      {action && <div className="mb-2">{action}</div>}
      {hint && <p className="text-[11px] text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}
