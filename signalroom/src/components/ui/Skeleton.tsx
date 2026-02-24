"use client";

/** Single line placeholder — use for text rows */
export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div className={`h-4 bg-gray-800/70 rounded animate-pulse ${className}`} />
  );
}

/** Full card placeholder — matches .panel dimensions */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`panel p-4 space-y-3 animate-pulse ${className}`}>
      <div className="h-3 w-24 bg-gray-800/70 rounded" />
      <div className="h-8 w-16 bg-gray-800/70 rounded" />
      <div className="h-3 w-32 bg-gray-800/70 rounded" />
    </div>
  );
}

/** KPI strip skeleton — matches KPIStrip layout */
export function SkeletonKPIStrip() {
  return (
    <div className="panel px-4 py-3 flex items-center gap-5 overflow-x-auto animate-pulse">
      {/* Gauge circle */}
      <div className="w-14 h-14 rounded-full bg-gray-800/70 shrink-0" />
      <div className="w-px h-10 bg-gray-800" />
      {[80, 64, 72, 56, 96, 60].map((w, i) => (
        <div key={i} className="flex flex-col gap-2 min-w-max">
          <div className={`h-2.5 bg-gray-800/70 rounded w-${w > 80 ? 24 : 16}`} />
          <div className="h-6 w-12 bg-gray-800/70 rounded" />
          <div className="h-2 w-20 bg-gray-800/70 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Table row skeleton */
export function SkeletonTableRow({ cols = 7 }: { cols?: number }) {
  return (
    <tr className="border-b border-gray-800/60 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-800/70 rounded" style={{ width: `${50 + (i * 13) % 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

/** Generic rectangular block */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-gray-800/70 rounded animate-pulse ${className}`} />
  );
}
